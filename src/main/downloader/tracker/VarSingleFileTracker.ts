import { Artifact } from "../../types/Installation";
import { checksumFile } from "../../utils/checksums";
import { TrackerWriter, ArtifactType, TrackerReader } from "./ArtifactTracker";
import * as fs from 'fs';
import * as Path from 'path';
import { exists, resolveSegmentedPath } from "../../utils/fshelper";
import { withBufferReadMethods, withBufferWriteMethods } from "../../utils/buffer";
import log from 'electron-log';

export namespace VarSingleFileTracker {
    export class Writer extends TrackerWriter {
        public static getConstructor() {
            return withBufferWriteMethods(Writer);
        }

        public async trackSinglePath(finalLocation: string, version: number) {
            await this.openFile();

            try {
                await this.writeHeader(ArtifactType.VAR_SINGLE_FILE);

                // write version
                const buffer = Buffer.alloc(2); // 16 bit
                buffer.writeInt16LE(version);
                await this.writeBuffer(buffer);
    
                // always write paths last, as they are read indefinitely on deletion
                await this.writePath(finalLocation);
            } catch(err) {
                this.closeFile(); // be sure to close the file
                throw err;
            }

            this.closeFile();
        }
    }

    export class Reader extends TrackerReader {
        public static getConstructor() {
            return withBufferReadMethods(Reader);
        }

        public async isArtifactUpToDate(artifact: Artifact): Promise<boolean> {
            const extra = this.readBuffer(2);

            const oldPath = this.readString();
            if (this.hasArtifactPathChanged(artifact, oldPath)) {
                log.verbose('Artifact path has changed. Artifact needs an update.');
                return false;
            }
            // artifact will be at the same location

            if (!await exists(oldPath)) return false; // file does not exist anymore

            // check for artifact options
            if (artifact.options) {
                // check for variableBaseVersion
                if (artifact.options.variableBaseVersion !== undefined && extra) {
                    const localBaseVersion = extra.readInt16LE();

                    if (localBaseVersion < artifact.options.variableBaseVersion) {
                        log.verbose('Artifact base version is behind. Artifact needs an update.');
                        return false;
                    } else {
                        return true;
                    }
                }
            }

            // compare checksums
            const calculatedMd5 = await checksumFile(oldPath, 'md5').catch(() => undefined); // on error, return undefined
            if (calculatedMd5 === artifact.md5) return true;
            else await fs.promises.unlink(oldPath);

            return false;
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

            try {
                const extra = this.readBuffer(2);
                if (!extra) throw new Error('Could not read extra');
            } catch (err) {
                this.closeFile();
                throw err;
            }
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