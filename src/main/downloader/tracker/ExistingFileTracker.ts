import { withBufferReadMethods, withBufferWriteMethods } from "../../core/io/buffer";
import { exists, resolveSegmentedPath } from "../../core/io/fshelper";
import { Artifact } from "../../types/Installation";
import { ArtifactType, TrackerReader, TrackerWriter, UpdateCheckerArgs } from "./ArtifactTracker";
import { replaceArraySubstitutes } from '../../utils/substitute';

export namespace ExistingFileTracker {
    export class Writer extends TrackerWriter {
        public static getConstructor() {
            return withBufferWriteMethods(Writer);
        }

        public async trackSinglePath(finalLocation: string) {
            await this.openFile();
            try {
                await this.writeHeader(ArtifactType.EXISTING_FILE);
                await this.writePath(finalLocation);
            } catch (err) {
                this.closeFile();
                throw err;
            }
            this.closeFile();
        }
    }

    export class Reader extends TrackerReader {
        public static getConstructor() {
            return withBufferReadMethods(Reader);
        }

        public async isArtifactUpToDate(artifact: Artifact, args: UpdateCheckerArgs): Promise<boolean> {
            const oldPath = this.readString();
            if (!await exists(oldPath)) return false;

            // check if resultPath should be considered
            if (!artifact.extra?.resultPath) return true;

            const substPath = replaceArraySubstitutes(artifact.extra.resultPath, args.substition);
            const resultPath = resolveSegmentedPath(args.installDir, substPath);
            
            return await exists(resultPath);
        }

        protected cloneThisReader(): TrackerReader {
            return new Reader(this.artifactId, this.appId, this.vars);
        }

        public async readUntilEntries(headerRead?: boolean): Promise<void> {
            if (!headerRead) {
                this.ensureFileNotOpen();
                await this.openFile();
                try {
                    const header = this.readHeader();
                    if (!header) throw new Error('Header could not be read');
                } catch (err) {
                    this.closeFile();
                    throw err;
                }
            }
        }
    }
}