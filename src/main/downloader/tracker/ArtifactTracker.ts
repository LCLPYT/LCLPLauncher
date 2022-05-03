import { Artifact } from "../../types/Installation";
import { exists, getAppArtifactFile, isDirectory, rmdirRecusive, unlinkRemoveParentIfEmpty } from "../../utils/fshelper";
import * as fs from 'fs';
import { ERR_EOS } from "../../utils/constants";
import { withBufferWriteMethods } from "../../utils/buffer";
import { SimpleFile } from "../../utils/SimpleFile";
import log from 'electron-log';

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
const TRACKER_VERSION = 5;

export type ArtifactTrackerVariables = {
    installationDir: string;
    tmpDir: string;
}

export enum ArtifactType {
    SINGLE_FILE,
    EXTRACTED_ARCHIVE,
    EXISTING_FILE,
    VAR_SINGLE_FILE
}

export type TrackerHeader = {
    version: number;
    type: ArtifactType;
}

interface ArtifactTracker {
    readonly appId: number;
    readonly artifactId: string;
}

export class TrackerWriter extends SimpleFile.AbstractWriter<ArtifactTrackerVariables> implements ArtifactTracker {
    public readonly appId: number;
    public readonly artifactId: string;
    protected headerWritten = false;

    constructor(artifactId: string, appId: number, vars: ArtifactTrackerVariables, reuseStream?: fs.WriteStream) {
        super(getAppArtifactFile(appId, artifactId), vars, reuseStream);
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

export abstract class TrackerReader extends SimpleFile.AbstractReader<ArtifactTrackerVariables> implements ArtifactTracker {
    public readonly appId: number;
    public readonly artifactId: string;
    protected type?: ArtifactType;

    constructor(artifactId: string, appId: number, vars: ArtifactTrackerVariables, reuseStream?: fs.ReadStream) {
        super(getAppArtifactFile(appId, artifactId), vars, reuseStream);
        this.artifactId = artifactId;
        this.appId = appId;
    }

    public readHeader(): TrackerHeader | undefined {
        if (!this.stream) throw new Error('File is not opened (read)');
        if (this.type) throw new Error('Trying to read a header while there was already one read.');

        const versionBuffer = <Buffer | null>this.stream.read(2); // 16 bits; version is always the first two bytes
        if (versionBuffer === null) throw ERR_EOS;
        const version = versionBuffer.readInt16LE();
        if (version < TRACKER_VERSION) throw new VersionError(`Artifact tracker version is too old: ${version}; current: ${TRACKER_VERSION}`);
        else if (version > TRACKER_VERSION) throw new VersionError(`Artifact tracker version is too new: ${version}; current: ${TRACKER_VERSION}; Consider an upgrade.`);

        // version specific deserialization; above code should never break
        const lengthBuffer = <Buffer | null> this.stream.read(2); // 16 bits
        if (lengthBuffer === null) throw ERR_EOS;
        const type = <ArtifactType> lengthBuffer.readInt16LE();

        return {
            version: version,
            type: type
        };
    }

    public readPath() {
        return this.readString();
    }

    public abstract readUntilEntries(headerRead?: boolean): Promise<void>;

    protected abstract cloneThisReader(): TrackerReader;

    public abstract isArtifactUpToDate(artifact: Artifact): Promise<boolean>;

    /**
     * 
     * @param reuseReader A TrackerReader that should be reused for performance.
     * @param atBeginning Whether the passed reuse Tracker reader has it's cursor on the beginning of the entries.
     * @param skipPaths Optional paths that should not be deleted.
     * @returns A promise with a boolean result, indicating if all tracked files were deleted.
     */
    public async deleteEntries(reuseReader?: TrackerReader, atBeginning?: boolean, skipPaths?: string[]) {
        let didSkips = false;

        const deleteItems = async (trackerReader: TrackerReader) => {
            // delete all old files
            try {
                let deletedDirectories: string[] = [];

                // if there is no path remaining, the promise will throw ERR_EOS
                while (true) {
                    const path = trackerReader.readPath();
                    if (skipPaths && skipPaths.includes(path)) {
                        log.verbose(`Skipping '${path}', because it was registered as persistent.`);
                        didSkips = true;
                        continue;
                    }

                    if (!await exists(path)) {
                        // check if file was deleted previously by a recursive directory deletion, or not
                        if (!deletedDirectories.find(dir => path.startsWith(dir))) {
                            log.warn(`Could not find tracked file '${path}', ignoring it.`);
                        }
                        continue;
                    }

                    if (await isDirectory(path)) {
                        if ((await fs.promises.readdir(path)).length > 0) {
                            deletedDirectories.push(path);
                        }

                        await rmdirRecusive(path);
                        return;
                    }

                    await unlinkRemoveParentIfEmpty(path, this.vars.installationDir).catch();
                }
            } catch (err) {
                if (err !== ERR_EOS) throw err;
            }
        };

        if (reuseReader && !atBeginning) {
            // assumes the stream is at the beginning of the entries
            await deleteItems(reuseReader);
            this.closeFile();
        } else {
            // create a new reader and read it to the entries offset
            const reader = reuseReader ? reuseReader : this.cloneThisReader();
            await reader.readUntilEntries(reuseReader ? true : false);
            // actually delete the entries
            await deleteItems(reader);
            reader.closeFile();
        }

        return !didSkips;
    }
}

export class VersionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VersionError';
    }
}