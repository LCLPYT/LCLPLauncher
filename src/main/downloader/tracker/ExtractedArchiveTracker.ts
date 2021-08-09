import { Artifact, PostAction, SegmentedPath } from "../../types/Installation";
import { checksumFile } from "../../utils/checksums";
import { exists, resolveSegmentedPath } from "../../utils/fshelper";
import { ArtifactType, ERR_EOS, TrackerReader, TrackerWriter } from "./ArtifactTracker";

export namespace ExtractedArchiveTracker {
    export class Writer extends TrackerWriter {
        public async beginExtractedArchive(archiveFile: string, extractedRoot: string) {
            this.ensureFileNotOpen();
            await this.openFile();
            await this.writeHeader(ArtifactType.EXTRACTED_ARCHIVE);

            const md5 = await checksumFile(archiveFile, 'md5').catch(() => undefined); // on error, return undefined
            await this.writeBoolean(md5 !== undefined);
            if (md5) await this.writeString(md5);
            await this.writeString(extractedRoot);
        }

        public async pushArchivePath(path: string) {
            await this.writePath(path);
        }

        public finishExtractedArchive() {
            this.closeFile();
        }
    }

    export class Reader extends TrackerReader {
        public async isArtifactUpToDate(artifact: Artifact): Promise<boolean> {
            const hasOldMd5 = this.readBoolean();
            if (!hasOldMd5) return false; // if md5 matching can't be done, there is no point in further checking

            const oldMd5 = this.readString();
            if (oldMd5 !== artifact.md5) return false; // archive contents changed

            const oldExtractionRoot = this.readString();
            if(!this.isSameExtractionRoot(artifact, oldExtractionRoot)) return false; // archive extraction destination changed

            return await this.doAllArchiveItemsExist(); // TODO maybe add reuse reader (this)
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
            const md5Exists = this.readBoolean(); // md5 exists
            if (md5Exists) this.readString(); // md5 string
            this.readString(); // extraction root
        }

        protected isSameExtractionRoot(artifact: Artifact, oldExtractionRoot: string): boolean {
            const recurse: (postAction: PostAction | undefined) => SegmentedPath | null = postAction => {
                if(!postAction) return null;
                if(postAction.type === 'extractZip') return postAction.destination;
                if(postAction.post) return recurse(postAction.post);
                return null;
            };
            const rootSegments = recurse(artifact.post);
            if(!rootSegments) return false;
    
            const path = resolveSegmentedPath(this.vars.installationDir, rootSegments);
            return path === oldExtractionRoot;
        }

        protected async doAllArchiveItemsExist(reuseReader?: TrackerReader): Promise<boolean> {
            async function checkItems(trackerReader: TrackerReader): Promise<boolean> {
                try {
                    // for each extracted entry, check if it exists
                    while (true) {
                        if (!await exists(trackerReader.readPath())) return false;
                    }
                } catch (err) {
                    if (err !== ERR_EOS) throw err;
                }
                return true;
            }

            if (reuseReader) {
                // assumes the stream is at the beginning of the entries
                return await checkItems(reuseReader);
                // leave the closing of the file to caller
            } else {
                // create a new reader and read it to the entries offset
                const reader = this.cloneThisReader();
                await reader.readUntilEntries();
                // actually check the entries
                const allExist = await checkItems(reader);
                reader.closeFile();
                return allExist;
            }
        }
    }
}