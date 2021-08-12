import { Artifact } from "../../types/Installation";
import { exists, getInstallerAppDir, mkdirp, unlinkRemoveParentIfEmpty } from "../../utils/fshelper";
import * as fs from 'fs';
import * as Path from 'path';
import { ReadStreamContainer, WriteStreamContainer } from "../../utils/streams";
import { ERR_EOS } from "../../utils/constants";
import { MixinBufferReader, MixinBufferWriter, withBufferWriteMethods } from "../../utils/buffer";

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
const TRACKER_VERSION = 4;

export type ArtifactTrackerVariables = {
    installationDir: string;
    tmpDir: string;
}

export interface TrackerDescriptor {
    getTrackerFile(): string;
}

export abstract class AbstractTrackerBase<Vars> {
    protected readonly vars: Vars;
    protected readonly descriptor: TrackerDescriptor;

    constructor(descriptor: TrackerDescriptor, vars: Vars) {
        this.descriptor = descriptor;
        this.vars = vars;
    }

    protected abstract openFile(): Promise<void>;

    protected abstract closeFile(): void;

    protected abstract ensureFileNotOpen(): void;

    public getTrackerFile() {
        return this.descriptor.getTrackerFile();
    }

    public doesFileExist() {
        return exists(this.getTrackerFile());
    }
}

export interface AbstractTrackerWriter<Vars> extends MixinBufferWriter {} // make the compiler aware of the mixin with declaration merging
export abstract class AbstractTrackerWriter<Vars> extends AbstractTrackerBase<Vars> implements WriteStreamContainer {
    public stream?: fs.WriteStream;

    constructor(descriptor: TrackerDescriptor, vars: Vars, reuseStream?: fs.WriteStream) {
        super(descriptor, vars)
        if(reuseStream) this.stream = reuseStream;
    }

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
}

export interface AbstractTrackerReader<Vars> extends MixinBufferReader {} // make the compiler aware of the mixin with declaration merging
export abstract class AbstractTrackerReader<Vars> extends AbstractTrackerBase<Vars> implements ReadStreamContainer {
    public stream?: fs.ReadStream;

    constructor(descriptor: TrackerDescriptor, vars: Vars, reuseStream?: fs.ReadStream) {
        super(descriptor, vars);
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
}

export enum ArtifactType {
    SINGLE_FILE,
    EXTRACTED_ARCHIVE
}

type TrackerHeader = {
    version: number;
    type: ArtifactType;
}

interface ArtifactTracker {
    readonly appId: number;
    readonly artifactId: string;
}

class ArtifactDescriptor implements TrackerDescriptor {
    public readonly tracker: () => ArtifactTracker;

    constructor(tracker: () => ArtifactTracker) {
        this.tracker = tracker;
    }

    public getTrackerFile() {
        return Path.resolve(getInstallerAppDir(this.tracker().appId), 'artifacts', this.tracker().artifactId);
    }    
}

export class TrackerWriter extends AbstractTrackerWriter<ArtifactTrackerVariables> implements WriteStreamContainer, ArtifactTracker {
    public readonly appId: number;
    public readonly artifactId: string;
    protected headerWritten = false;

    constructor(artifactId: string, appId: number, vars: ArtifactTrackerVariables, reuseStream?: fs.WriteStream) {
        super(new ArtifactDescriptor(() => this), vars, reuseStream);
        this.artifactId = artifactId;
        this.appId = appId;
    }
    
    public static getConstructor() {
        return withBufferWriteMethods(TrackerWriter);
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
}

export abstract class TrackerReader extends AbstractTrackerReader<ArtifactTrackerVariables> implements ReadStreamContainer, ArtifactTracker {
    public readonly appId: number;
    public readonly artifactId: string;
    protected type?: ArtifactType;

    constructor(artifactId: string, appId: number, vars: ArtifactTrackerVariables, reuseStream?: fs.ReadStream) {
        super(new ArtifactDescriptor(() => this), vars, reuseStream);
        this.artifactId = artifactId;
        this.appId = appId;
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

    public abstract readUntilEntries(headerRead?: boolean): Promise<void>;

    protected abstract cloneThisReader(): TrackerReader;

    public abstract isArtifactUpToDate(artifact: Artifact): Promise<boolean>;

    public async deleteEntries(reuseReader?: TrackerReader, atBeginning?: boolean) {
        const deleteItems = async (trackerReader: TrackerReader) => {
            // delete all old files
            try {
                while (true) await unlinkRemoveParentIfEmpty(trackerReader.readPath()).catch(() => undefined);
            } catch (err) {
                if (err !== ERR_EOS) throw err;
            }
        };

        if (reuseReader && !atBeginning) {
            // assumes the stream is at the beginning of the entries
            await deleteItems(reuseReader);
            // leave the closing of the file to caller
        } else {
            // create a new reader and read it to the entries offset
            const reader = reuseReader ? reuseReader : this.cloneThisReader();
            await reader.readUntilEntries(reuseReader ? true : false);
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