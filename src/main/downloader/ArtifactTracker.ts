import { Artifact } from "../types/Installation";
import { exists, getInstallerAppDir, mkdirp, unlinkRemoveParentIfEmpty } from "../utils/fshelper";
import * as fs from 'fs';
import * as Path from 'path';
import App from "../../common/types/App";
import { checksumFile } from "../utils/checksums";

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
export const TRACKER_VERSION = 4;

const ERR_EOS = new Error('End of stream');

export enum ArtifactType {
    SINGLE_FILE,
    EXTRACTED_ARCHIVE
}

abstract class ArtifactTrackerBase {
    protected readonly artifact: Artifact;
    protected readonly app: App;

    constructor(app: App, artifact: Artifact) {
        this.app = app;
        this.artifact = artifact;
    }

    public abstract openFile(): Promise<void>;

    public abstract closeFile(): void;

    public getTrackerFile() {
        return Path.resolve(getInstallerAppDir(this.app), 'artifacts', this.artifact.id);
    }
}

class ArtifactTrackerWriter extends ArtifactTrackerBase {
    protected finished = false;
    protected writeStream?: fs.WriteStream;
    protected type?: ArtifactType;

    public isFinished() {
        return this.finished;
    }

    public async openFile() {
        if (this.writeStream) throw new Error('Trying to open an artifact tracker file twice (write)');
        this.ensureUnfinished();

        const file = this.getTrackerFile();
        await mkdirp(Path.dirname(file));
        this.writeStream = fs.createWriteStream(file);
    }

    public closeFile() {
        if (!this.writeStream) throw new Error('File is not opened (write)');
        this.writeStream.close();
        this.writeStream = undefined;
    }

    public async trackSinglePath(finalLocation: string) {
        this.ensureUnfinished();
        await this.openFile();
        await this.writeHeader(ArtifactType.SINGLE_FILE);
        await this.writePath(finalLocation);
        this.finished = true;
        this.closeFile();
    }

    public async beginExtractedArchive(archiveFile: string, extractedRoot: string) {
        this.ensureUnfinished();
        await this.openFile();
        await this.writeHeader(ArtifactType.EXTRACTED_ARCHIVE);

        const md5 = await checksumFile(archiveFile, 'md5').catch(() => undefined); // on error, return undefined
        await this.writeBoolean(md5 !== undefined);
        if (md5) await this.writeString(md5);
        await this.writeString(extractedRoot);
    }

    public async pushArchivePath(path: string) {
        if (this.type !== ArtifactType.EXTRACTED_ARCHIVE) throw new Error('Trying to push archive path before archive was begun.');
        await this.writePath(path);
    }

    public finishExtractedArchive() {
        this.ensureUnfinished();
        this.finished = true;
        this.closeFile();
    }

    protected async writeHeader(type: ArtifactType) {
        if (this.type) throw new Error('Trying to write a header while there was already one written.');
        this.type = type;

        const buffer = Buffer.alloc(4); // 32 bits
        buffer.writeInt16LE(TRACKER_VERSION); // the version must always be written first
        buffer.writeInt16LE(type, 2); // offset 2 bytes, because write always inserts at the beginning

        await this.writeBuffer(buffer);
    }

    protected async writePath(path: string) {
        if (!await exists(path)) throw new Error(`Trying to track a non-existing file: '${path}'`);
        await this.writeString(path);
    }

    protected async writeString(str: string) {
        const pathBuffer = Buffer.from(str, 'utf8');
        const lengthBuffer = Buffer.alloc(2); // 16 bits
        lengthBuffer.writeInt16LE(pathBuffer.length);

        await this.writeBuffer(Buffer.concat([lengthBuffer, pathBuffer]));
    }

    protected async writeBoolean(bool: boolean) {
        const buffer = Buffer.alloc(1); // 8 bits
        buffer.writeInt8(bool ? 1 : 0);
        await this.writeBuffer(buffer);
    }

    protected async writeBuffer(buffer: Buffer): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.writeStream) throw new Error('File is not opened (write)');
            this.writeStream.write(buffer, error => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    protected ensureUnfinished() {
        if (this.finished) throw new Error('Trying to manipulate a finished tracker');
    }
}

type TrackerHeader = {
    version: number;
    type: ArtifactType;
}

export class ArtifactTrackerReader extends ArtifactTrackerBase {
    protected readStream?: fs.ReadStream;
    protected type?: ArtifactType;

    public doesFileExist() {
        return exists(this.getTrackerFile());
    }

    public async openFile() {
        if (this.readStream) throw new Error('Trying to open an artifact tracker file twice (read)');

        const file = this.getTrackerFile();
        if (!await exists(file)) throw new Error(`Artifact tracker file does not exist: '${file}'`);

        this.readStream = fs.createReadStream(file);
        await new Promise<void>(resolve => {
            if (!this.readStream) throw new Error('File is not opened (read)');
            this.readStream.on('readable', () => resolve());
        });
    }

    public closeFile(): void {
        if (!this.readStream) throw new Error('File is not opened (read)');
        this.readStream.close();
        this.readStream = undefined;
    }

    public async deleteFile() {
        if (this.readStream) this.closeFile();
        await fs.promises.unlink(this.getTrackerFile());
    }

    public readHeader(): [header: TrackerHeader | undefined, error: any] {
        if (!this.readStream) throw new Error('File is not opened (read)');
        if (this.type) throw new Error('Trying to read a header while there was already one read.');

        const versionBuffer = <Buffer | null>this.readStream.read(2); // 16 bits; version is always the first two bytes
        if (!versionBuffer) throw ERR_EOS;
        const version = versionBuffer.readInt16LE();
        if (version < TRACKER_VERSION) return [undefined, new VersionError(`Artifact tracker version is to old: ${version}; current: ${TRACKER_VERSION}`)];
        else if (version > TRACKER_VERSION) throw [undefined, new VersionError(`Artifact tracker version is to new: ${version}; current: ${TRACKER_VERSION}; Consider an upgrade.`)];

        // version specific deserialization; above code should never break
        const lengthBuffer = <Buffer | null>this.readStream.read(2); // 16 bits
        if (!lengthBuffer) throw ERR_EOS;
        const type = <ArtifactType>lengthBuffer.readInt16LE();

        return [{
            version: version,
            type: type
        }, undefined];
    }

    public readPath() {
        return this.readString();
    }

    public readString() {
        if (!this.readStream) throw new Error('File is not opened (read)');

        const lengthBuffer = <Buffer | null>this.readStream.read(2); // 16 bits
        if (!lengthBuffer) throw ERR_EOS;
        const length = lengthBuffer.readInt16LE();
        const buffer = <Buffer | null>this.readStream.read(length);
        if (!buffer) throw ERR_EOS;
        return buffer.toString('utf8');
    }

    public readBoolean() {
        if (!this.readStream) throw new Error('File is not opened (read)');
        const buffer = <Buffer | null>this.readStream.read(1); // 16 bits
        if (!buffer) throw ERR_EOS;
        const boolNumber = buffer.readInt8();
        return boolNumber === 1;
    }

    private static async createEntryOffsetReader(app: App, artifact: Artifact) {
        const reader = new ArtifactTrackerReader(app, artifact);
        await reader.openFile();
        const [header, err] = reader.readHeader(); // header
        if (err) throw err;
        if (!header) throw new Error('Header could not be read');
        switch (header.type) {
            case ArtifactType.SINGLE_FILE:
                break;
            case ArtifactType.EXTRACTED_ARCHIVE:
                const md5Exists = reader.readBoolean(); // md5 exists
                if (md5Exists) reader.readString(); // md5 string
                reader.readString(); // extraction root
                break;
        }
        return reader;
    }

    static async deleteEntries(app: App, artifact: Artifact, reuseReader?: ArtifactTrackerReader) {
        const deleteItems = async (trackerReader: ArtifactTrackerReader) => {
            // delete all old files
            try {
                while (true) await unlinkRemoveParentIfEmpty(trackerReader.readPath()).catch(() => { });
            } catch (err) {
                if (err !== ERR_EOS) throw err;
            }
        };

        if (reuseReader) await deleteItems(reuseReader);
        else {
            // create a new reader and read it to the entries offset
            const reader = await ArtifactTrackerReader.createEntryOffsetReader(app, artifact);
            // actually delete the entries
            await deleteItems(reader);
            reader.closeFile();
        }
    }

    static async doAllArchiveItemsExist(app: App, artifact: Artifact, reuseReader?: ArtifactTrackerReader): Promise<boolean> {
        async function checkItems(trackerReader: ArtifactTrackerReader): Promise<boolean> {
            try {
                // for each extracted entry, check if it exists
                while (true) {
                    if (!await exists(trackerReader.readPath())) return false;
                }
            } catch (err) {
                if (err !== ERR_EOS) throw err;
            }
            return true;
        }

        if (reuseReader) {
            return await checkItems(reuseReader);
        } else {
            // create a new reader and read it to the entries offset
            const reader = await ArtifactTrackerReader.createEntryOffsetReader(app, artifact);
            // actually check the entries
            const allExist = await checkItems(reader);
            reader.closeFile();
            return allExist;
        }
    }
}

export class VersionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VersionError';
    }
}

export default ArtifactTrackerWriter;