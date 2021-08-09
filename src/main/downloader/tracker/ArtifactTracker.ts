import { Artifact } from "../../types/Installation";
import { exists, getInstallerAppDir, mkdirp, unlinkRemoveParentIfEmpty } from "../../utils/fshelper";
import * as fs from 'fs';
import * as Path from 'path';
import App from "../../../common/types/App";

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
export const TRACKER_VERSION = 4;

export const ERR_EOS = new Error('End of stream');

export enum ArtifactType {
    SINGLE_FILE,
    EXTRACTED_ARCHIVE
}

type TrackerHeader = {
    version: number;
    type: ArtifactType;
}

export type TrackerVariables = {
    installationDir: string;
    tmpDir: string;
}

abstract class TrackerBase {
    protected readonly artifact: Artifact;
    protected readonly app: App;
    protected readonly vars: TrackerVariables;

    constructor(artifact: Artifact, app: App, vars: TrackerVariables) {
        this.artifact = artifact;
        this.app = app;
        this.vars = vars;
    }

    protected abstract openFile(): Promise<void>;

    protected abstract closeFile(): void;

    protected abstract ensureFileNotOpen(): void;

    public getTrackerFile() {
        return Path.resolve(getInstallerAppDir(this.app), 'artifacts', this.artifact.id);
    }

    public doesFileExist() {
        return exists(this.getTrackerFile());
    }
}

export class TrackerWriter extends TrackerBase {
    protected stream?: fs.WriteStream;
    protected headerWritten = false;

    protected async openFile() {
        if (this.stream) throw new Error('Trying to open an artifact tracker file twice (write)');

        const file = this.getTrackerFile();
        await mkdirp(Path.dirname(file));
        this.stream = fs.createWriteStream(file);
    }

    protected closeFile() {
        if (!this.stream) throw new Error('File is not opened (write)');
        this.stream.close();
        this.stream = undefined;
    }

    protected ensureFileNotOpen() {
        if (this.stream) throw new Error('File is already open (write)');
    }

    protected async writeHeader(type: ArtifactType) {
        if (this.headerWritten) throw new Error('Trying to write a header while there was already one written.');

        const buffer = Buffer.alloc(4); // 32 bits
        buffer.writeInt16LE(TRACKER_VERSION); // the version must always be written first
        buffer.writeInt16LE(type, 2); // offset 2 bytes, because write always inserts at the beginning

        await this.writeBuffer(buffer);
        this.headerWritten = true;
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
            if (!this.stream) throw new Error('File is not opened (write)');
            this.stream.write(buffer, error => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
}

export abstract class TrackerReader extends TrackerBase {
    protected stream?: fs.ReadStream;
    protected type?: ArtifactType;

    constructor(artifact: Artifact, app: App, vars: TrackerVariables, reuseStream?: fs.ReadStream) {
        super(artifact, app, vars);
        if(reuseStream) this.stream = reuseStream;
    }

    public async openFile() {
        if (this.stream) throw new Error('Trying to open an artifact tracker file twice (read)');

        const file = this.getTrackerFile();
        if (!await exists(file)) throw new Error(`Artifact tracker file does not exist: '${file}'`);

        this.stream = fs.createReadStream(file);
        await new Promise<void>(resolve => {
            if (!this.stream) throw new Error('File is not opened (read)');
            this.stream.on('readable', () => resolve());
        });
    }

    public closeFile(): void {
        if (!this.stream) throw new Error('File is not opened (read)');
        this.stream.close();
        this.stream = undefined;
    }

    public isFileOpen(): boolean {
        return this.stream !== undefined;
    }

    protected ensureFileNotOpen() {
        if (this.stream) throw new Error('File is already open (read)');
    }

    public async deleteFile() {
        if (this.stream) this.closeFile();
        if(await exists(this.getTrackerFile())) await fs.promises.unlink(this.getTrackerFile());
    }

    public readHeader(): [header: TrackerHeader | undefined, error: any] {
        if (!this.stream) throw new Error('File is not opened (read)');
        if (this.type) throw new Error('Trying to read a header while there was already one read.');

        const versionBuffer = <Buffer | null>this.stream.read(2); // 16 bits; version is always the first two bytes
        if (!versionBuffer) throw ERR_EOS;
        const version = versionBuffer.readInt16LE();
        if (version < TRACKER_VERSION) return [undefined, new VersionError(`Artifact tracker version is to old: ${version}; current: ${TRACKER_VERSION}`)];
        else if (version > TRACKER_VERSION) throw [undefined, new VersionError(`Artifact tracker version is to new: ${version}; current: ${TRACKER_VERSION}; Consider an upgrade.`)];

        // version specific deserialization; above code should never break
        const lengthBuffer = <Buffer | null> this.stream.read(2); // 16 bits
        if (!lengthBuffer) throw ERR_EOS;
        const type = <ArtifactType> lengthBuffer.readInt16LE();

        return [{
            version: version,
            type: type
        }, undefined];
    }

    public readPath() {
        return this.readString();
    }

    public readString() {
        if (!this.stream) throw new Error('File is not opened (read)');

        const lengthBuffer = <Buffer | null>this.stream.read(2); // 16 bits
        if (!lengthBuffer) throw ERR_EOS;
        const length = lengthBuffer.readInt16LE();
        const buffer = <Buffer | null>this.stream.read(length);
        if (!buffer) throw ERR_EOS;
        return buffer.toString('utf8');
    }

    public readBoolean() {
        if (!this.stream) throw new Error('File is not opened (read)');
        const buffer = <Buffer | null>this.stream.read(1); // 16 bits
        if (!buffer) throw ERR_EOS;
        const boolNumber = buffer.readInt8();
        return boolNumber === 1;
    }

    public abstract readUntilEntries(): Promise<void>;

    protected abstract cloneThisReader(): TrackerReader;

    public abstract isArtifactUpToDate(artifact: Artifact): Promise<boolean>;

    public async deleteEntries(reuseReader?: TrackerReader) {
        const deleteItems = async (trackerReader: TrackerReader) => {
            // delete all old files
            try {
                while (true) await unlinkRemoveParentIfEmpty(trackerReader.readPath()).catch(() => undefined);
            } catch (err) {
                if (err !== ERR_EOS) throw err;
            }
        };

        if (reuseReader) {
            // assumes the stream is at the beginning of the entries
            await deleteItems(reuseReader);
            // leave the closing of the file to caller
        } else {
            // create a new reader and read it to the entries offset
            const reader = this.cloneThisReader();
            await reader.readUntilEntries();
            // actually delete the entries
            await deleteItems(reader);
            reader.closeFile();
        }
    }
}

export class VersionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VersionError';
    }
}