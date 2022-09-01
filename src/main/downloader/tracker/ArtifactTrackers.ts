import { ArtifactTrackerVariables, ArtifactType, TrackerHeader, TrackerReader } from "./ArtifactTracker";
import * as fs from 'fs';
import { SingleFileTracker } from "./SingleFileTracker";
import { ExtractedArchiveTracker } from "./ExtractedArchiveTracker";
import { ExistingFileTracker } from "./ExistingFileTracker";
import { withBufferReadMethods } from "../../core/io/buffer";
import { VarSingleFileTracker } from "./VarSingleFileTracker";

type TrackerFactory = (artifactId: string, appId: number, vars: ArtifactTrackerVariables, reuseStream?: fs.ReadStream) => TrackerReader;

const TRACKER_READERS = new Map<ArtifactType, TrackerFactory>([
    [
        ArtifactType.SINGLE_FILE,
        (artifactId, appId, vars, reuseStream) => new (SingleFileTracker.Reader.getConstructor())(artifactId, appId, vars, reuseStream)
    ],
    [
        ArtifactType.EXTRACTED_ARCHIVE,
        (artifactId, appId, vars, reuseStream) => new (ExtractedArchiveTracker.Reader.getConstructor())(artifactId, appId, vars, reuseStream)
    ],
    [
        ArtifactType.EXISTING_FILE,
        (artifactId, appId, vars, reuseStream) => new (ExistingFileTracker.Reader.getConstructor())(artifactId, appId, vars, reuseStream)
    ],
    [
        ArtifactType.VAR_SINGLE_FILE,
        (artifactId, appId, vars, reuseStream) => new (VarSingleFileTracker.Reader.getConstructor())(artifactId, appId, vars, reuseStream)
    ]
]);

/** Tracker reader to determine tracker type */
class DummyTrackerReader extends TrackerReader {
    public static getConstructor() {
        return withBufferReadMethods(DummyTrackerReader);
    }

    public async toActualReader<T extends TrackerReader>(): Promise<T> {
        await this.openFile();
        let header: TrackerHeader | undefined;
        try {
            header = this.readHeader();
        } catch (err) {
            await this.deleteFile();
            throw err;
        }

        if (!header) {
            await this.deleteFile();
            throw new Error('Could not read header.');
        }

        const readerFactory = TRACKER_READERS.get(header.type);
        if (!readerFactory) {
            this.closeFile();
            throw new TypeError(`No reader factory defined for artifact type '${header.type}'`);
        }

        return <T> readerFactory(this.artifactId, this.appId, this.vars, this.stream); // reuse this stream, therefore do not close the file here.
    }
    public isArtifactUpToDate(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    public readUntilEntries(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    protected cloneThisReader(): TrackerReader {
        throw new Error("Method not implemented.");
    }
}

export async function createReader<T extends TrackerReader>(appId: number, artifactId: string, vars: ArtifactTrackerVariables): Promise<T> {
    const constructor = DummyTrackerReader.getConstructor();
    const dummyReader = new constructor(artifactId, appId, vars);
    return await dummyReader.toActualReader<T>();
}