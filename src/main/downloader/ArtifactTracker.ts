import { Artifact } from "../types/Installation";
import { exists, getInstallerAppDir, mkdirp, unlink } from "../utils/fshelper";
import * as fs from 'fs';
import * as Path from 'path';
import App from "../../common/types/App";
import { checksumFile } from "../utils/checksums";

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
export const TRACKER_VERSION = 1;

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

    public async beginExtractedArchive(archiveFile: string) {
        this.ensureUnfinished();
        await this.openFile();
        await this.writeHeader(ArtifactType.EXTRACTED_ARCHIVE);

        const md5 = await checksumFile(archiveFile, 'md5').catch(() => undefined); // on error, return undefined
        await this.writeBoolean(md5 !== undefined);
        if (md5) await this.writeString(md5);
    }

    public async pushArchivePath(path: string) {
        if(this.type !== ArtifactType.EXTRACTED_ARCHIVE) throw new Error('Trying to push archive path before archive was begun.');
        await this.writePath(path);
    }

    public finishExtractedArchive() {
        this.ensureUnfinished();
        this.finished = true;
        this.closeFile();
    }

    protected async writeHeader(type: ArtifactType) {
        if(this.type) throw new Error('Trying to write a header while there was already one written.');
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
        await unlink(this.getTrackerFile());
    }

    public readHeader(): Promise<TrackerHeader> {
        return new Promise((resolve, reject) => {
            if (!this.readStream) throw new Error('File is not opened (read)');
            if (this.type) throw new Error('Trying to read a header while there was already one read.');

            const versionBuffer = <Buffer> this.readStream.read(2); // 16 bits; version is always the first two bytes
            const version = versionBuffer.readInt16LE();
            if(version < TRACKER_VERSION) {
                reject(new VersionError(`Artifact tracker version is to old: ${version}; current: ${TRACKER_VERSION}`));
                return;
            }
            else if(version > TRACKER_VERSION) {
                reject(new VersionError(`Artifact tracker version is to new: ${version}; current: ${TRACKER_VERSION}; Consider an upgrade.`));
                return;
            }

            // version specific deserialization; above code should never break
            const lengthBuffer = <Buffer> this.readStream.read(2); // 16 bits
            const type = <ArtifactType> lengthBuffer.readInt16LE();

            resolve({
                version: version,
                type: type
            });
        });
    }

    public readPath(): Promise<string> {
        return this.readString();
    }

    public readString(): Promise<string> {
        return new Promise(resolve => {
            if (!this.readStream) throw new Error('File is not opened (read)');

            const lengthBuffer = <Buffer> this.readStream.read(2); // 16 bits
            const length = lengthBuffer.readInt16LE();
            const buffer = <Buffer> this.readStream.read(length);
            resolve(buffer.toString('utf8'));
        });
    }

    public readBoolean(): Promise<boolean> {
        return new Promise(resolve => {
            if (!this.readStream) throw new Error('File is not opened (read)');

            const buffer = <Buffer> this.readStream.read(1); // 16 bits
            const boolNumber = buffer.readInt8();
            resolve(boolNumber === 1);
        });
    }
}

export class VersionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VersionError';
    }
}

export default ArtifactTrackerWriter;