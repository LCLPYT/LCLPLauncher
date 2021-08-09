import { Artifact } from "../../types/Installation";
import { checksumFile } from "../../utils/checksums";
import { TrackerWriter, ArtifactType, TrackerReader } from "./ArtifactTracker";
import * as fs from 'fs';
import * as Path from 'path';
import { resolveSegmentedPath } from "../../utils/fshelper";

export namespace SingleFileTracker {
    export class Writer extends TrackerWriter {
        public async trackSinglePath(finalLocation: string) {
            await this.openFile();
            await this.writeHeader(ArtifactType.SINGLE_FILE);
            await this.writePath(finalLocation);
            this.closeFile();
        }
    }

    export class Reader extends TrackerReader {
        public async isArtifactUpToDate(artifact: Artifact): Promise<boolean> {
            const oldPath = this.readString();
            if (this.hasArtifactPathChanged(artifact, oldPath)) {
                console.log('Artifact path has changed. Artifacts needs an update.');
                return false;
            }
            // artifact will be at the same location
            const calculatedMd5 = await checksumFile(oldPath, 'md5').catch(() => undefined); // on error, return undefined
            if (calculatedMd5 === artifact.md5) return true;
            else await fs.promises.unlink(oldPath);

            return false;
        }

        protected cloneThisReader(): TrackerReader {
            return new Reader(this.artifact, this.app, this.vars);
        }

        public async readUntilEntries(): Promise<void> {
            this.ensureFileNotOpen();
            await this.openFile();
            const [header, err] = this.readHeader(); // header
            if (err) throw err;
            if (!header) throw new Error('Header could not be read');
        }

        protected hasArtifactPathChanged(artifact: Artifact, oldPath: string): boolean {
            const finalDir = this.guessFinalDirectory(artifact);
            const finalName = this.guessFinalName(artifact);
            if (finalName) { // set final name
                const newPath = Path.resolve(finalDir, finalName);
                return newPath !== oldPath;
            } else { // unknown final name
                // check if directory is matching
                const oldDir = Path.dirname(oldPath);
                return finalDir !== oldDir;
            }
        }

        protected guessFinalDirectory(artifact: Artifact) {
            return artifact.destination ? resolveSegmentedPath(this.vars.installationDir, artifact.destination) : this.vars.tmpDir;
        }
    
        protected guessFinalName(artifact: Artifact) {
            return artifact.fileName ? artifact.fileName : undefined;
        }
    }
}