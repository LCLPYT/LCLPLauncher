import { ArtifactTrackerVariables, TrackerWriter } from "./ArtifactTracker";

export namespace DummyTracker {
    export class Writer extends TrackerWriter {
        constructor() {
            super('', -1, <ArtifactTrackerVariables> <unknown> {});
        }
    }
}