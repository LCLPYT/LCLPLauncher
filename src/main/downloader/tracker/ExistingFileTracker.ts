import { TrackerWriter, ArtifactType, TrackerReader } from "./ArtifactTracker";
import { exists } from "../../utils/fshelper";
import { withBufferReadMethods, withBufferWriteMethods } from "../../utils/buffer";

export namespace ExistingFileTracker {
    export class Writer extends TrackerWriter {
        public static getConstructor() {
            return withBufferWriteMethods(Writer);
        }

        public async trackSinglePath(finalLocation: string) {
            await this.openFile();
            await this.writeHeader(ArtifactType.EXISTING_FILE);
            await this.writePath(finalLocation);
            this.closeFile();
        }
    }

    export class Reader extends TrackerReader {
        public static getConstructor() {
            return withBufferReadMethods(Reader);
        }

        public async isArtifactUpToDate(): Promise<boolean> {
            const oldPath = this.readString();
            console.log(oldPath, await exists(oldPath));
            return await exists(oldPath);
        }

        protected cloneThisReader(): TrackerReader {
            return new Reader(this.artifactId, this.appId, this.vars);
        }

        public async readUntilEntries(headerRead?: boolean): Promise<void> {
            if(!headerRead) {
                this.ensureFileNotOpen();
                await this.openFile();
                const header = this.readHeader();
                if (!header) throw new Error('Header could not be read');
            }
        }
    }
}