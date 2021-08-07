import fetch, { Headers } from "electron-fetch";
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import Downloader from 'nodejs-file-downloader';
import * as Path from 'path';
import * as fs from 'fs';
import App from "../../common/types/App";
import Installation, { Artifact, Path as SegmentedPath, PostAction } from "../types/Installation";
import { rmdirRecusive } from "../utils/fshelper";
import { PostActionArgument, PostActionHandle, PostActionWrapper, ActionFactory } from "./postActions";
import ArtifactTrackerWriter, { ArtifactTrackerReader, ArtifactType } from "./ArtifactTracker";
import { checksumFile } from "../utils/checksums";

let currentInstaller: Installer | null = null;

export async function startInstallationProcess(app: App) {
    if (currentInstaller) throw new Error('Multiple installation processes are currently not supported.');
    console.log(`Starting installation process of '${app.title}'...`);

    const headers = new Headers();
    headers.append('pragma', 'no-cache');
    headers.append('cache-control', 'no-cache');

    const [err, result] = await fetch('http://localhost:8080/ls5.installation.jsonc', {
        headers: headers
    }).then(response => response.text())
        .then(text => jsoncSafe.parse(text));

    if (err) throw err;

    const installation = <Installation>result;
    const installationDir = Path.join('C:', 'Users', 'lukas', 'Documents', 'projects', 'misc', 'LCLPLauncher', '.temp', 'test');
    console.log('Installing to:', installationDir);

    const installer = new Installer(app, installationDir);
    currentInstaller = installer;
    installation.artifacts.forEach(artifact => installer.addToQueue(artifact));

    await installer.startDownloading();

    currentInstaller = null;
    console.log(`Installation of '${app.title}' finished successfully.`);
}

export class Installer {
    public readonly installationDirectory: string;
    public readonly tmpDir: string;
    public readonly app: App;
    protected downloadQueue: Artifact[] = [];
    protected actionQueue: PostActionWrapper[] = [];
    protected totalBytes: number = 0;
    protected active = false;
    protected actionWorkerActive = false;
    protected currentPostAction: PostActionHandle | null = null;

    constructor(app: App, installationDirectory: string) {
        this.app = app;
        this.installationDirectory = installationDirectory;
        this.tmpDir = Path.resolve(this.installationDirectory, '.tmp');
    }

    public addToQueue(artifact: Artifact) {
        this.downloadQueue.push(artifact);
    }

    public async startDownloading() {
        if (this.active) return;
        this.active = true;
        this.totalBytes = 0;
        this.downloadQueue.forEach(artifact => this.totalBytes += Math.max(0, artifact.size));
        await this.downloadNext();
        await this.completePostActions();
        await this.cleanUp();
    }

    protected async downloadNext() {
        if (this.downloadQueue.length <= 0) return;
        const artifact = this.downloadQueue[0];
        this.downloadQueue.splice(0, 1);

        console.log(`Resolving artifact '${artifact.id}...'`);

        // TODO remove old unused artifacts
        // TODO when doing the progress display, filter artifacts before starting the downloads
        if (!await this.doesArtifactNeedUpdate(artifact).catch((err: Error) => {
            if(err.name === 'VersionError') console.error(err.message);
            else console.error(err);
            return true;
        })) {
            // download next artifact
            await this.downloadNext();
            return;
        }

        // determine directory to place the downloaded file into; if md5 validation should be done, the file will be put in the .tmp dir first
        const dir = artifact.md5 || !artifact.destination ? this.tmpDir : this.toActualPath(artifact.destination);
        let downloadedName: string | null = null;

        const downloader = new Downloader({
            url: artifact.url,
            directory: dir,
            cloneFiles: false,
            onResponse: response => {
                const sizeHeader = response.headers['content-length'];
                if (sizeHeader) {
                    const size = Number(sizeHeader);
                    // correct total bytes, if the actual size deviates from the given size
                    if (artifact.size !== size) this.totalBytes -= artifact.size - size;
                }
            },
            onBeforeSave: deducedName => {
                return downloadedName = artifact.fileName ? artifact.fileName : deducedName;
            }
        });

        console.log(`Downloading '${artifact.url}'...`);
        await downloader.download();
        console.log(`Downloaded '${artifact.url}'.`);

        const downloadedPath = downloadedName ? Path.resolve(dir, downloadedName) : null;

        let postActionHandles = [];
        if (artifact.md5) {
            postActionHandles.push(ActionFactory.createMD5ActionHandle());

            // if md5 validation is done, the file is in the .tmp directory. The file needs to be moved to it's destination afterwards.
            if (artifact.destination && downloadedName) {
                const movedFile = Path.resolve(this.toActualPath(artifact.destination), downloadedName);
                postActionHandles.push(ActionFactory.createMoveActionHandle(movedFile));
            }
        }
        if (artifact.post) postActionHandles.push(ActionFactory.createPostActionHandle(this, artifact.post));

        if (postActionHandles.length > 0) {
            const firstAction = postActionHandles[0];
            postActionHandles.forEach((postAction, index) => {
                if (index > 0) firstAction.doLast(postAction);
            });

            firstAction.doLast(ActionFactory.createDefaultTrackerHandle())

            this.enqueuePostAction(firstAction, {
                artifact: artifact,
                result: downloadedPath,
                tracker: new ArtifactTrackerWriter(this.app, artifact)
            });
        }

        // download next artifact
        await this.downloadNext();
    }

    protected enqueuePostAction(action: PostActionHandle, argument: PostActionArgument) {
        this.actionQueue.push(new PostActionWrapper(action, argument));
        this.doNextPostAction();
    }

    protected async doNextPostAction() {
        if (this.actionQueue.length <= 0 || this.actionWorkerActive) return;
        this.actionWorkerActive = true;

        const action = this.actionQueue[0]; // get next post action
        this.currentPostAction = action.handle;
        this.actionQueue.splice(0, 1); // remove it from the queue

        await action.handle.call(action.argument); // wait for the action to complete
        this.currentPostAction = null;
        this.actionWorkerActive = false;
        this.doNextPostAction(); // start next post action, but do not wait for it to finish, so the causing artifact gets finished. 
        // Note: To ensure the installation to wait for all actions to finish, the completePostActions() function is used.
    }

    protected completePostActions() {
        // called after downloads have finished
        return new Promise<void>((resolve) => {
            // check if there are any queued actions left
            if (this.actionQueue.length <= 0) {
                // no enqueued actions, check if there is an action currently running
                if (this.currentPostAction) {
                    // resolve at completion of action chain
                    this.currentPostAction.lastChild().onCompleted = () => resolve();
                } else resolve();
            } else {
                // resolve at completion of the last action chain in queue
                const lastAction = this.actionQueue[this.actionQueue.length - 1]
                lastAction.handle.lastChild().onCompleted = () => resolve();
                this.doNextPostAction(); // start the post action worker, if it somehow died
            }
        });
    }

    protected async cleanUp() {
        console.log('Cleaning up...')
        await rmdirRecusive(this.tmpDir);
        console.log('Cleaned up.');
    }

    protected async doesArtifactNeedUpdate(artifact: Artifact): Promise<boolean> {
        if(!artifact.md5) {
            console.info('Artifact does not provide a MD5 checksum; cannot check if the artifact is already up-to-date. Artifact will be updated.');
            return true;
        }

        const reader = new ArtifactTrackerReader(this.app, artifact);
        if(!await reader.doesFileExist()) return true; // first download, defenitely needs update

        await reader.openFile();

        const [header, error] = reader.readHeader();
        if(error) {
            await reader.deleteFile();
            return await Promise.reject(error);
        }
        if(!header) return true;

        let needsUpdate = true;

        console.log(`Checking if '${artifact.id}' is already up-to-date...`);

        switch (header.type) {
            case ArtifactType.SINGLE_FILE:
                const oldPath = reader.readString();
                if (this.hasArtifactPathChanged(artifact, oldPath)) {
                    console.log('Artifact path has changed. Artifacts needs an update.');
                    break;
                }
                // artifact will be at the same location
                const calculatedMd5 = await checksumFile(oldPath, 'md5').catch(() => undefined); // on error, return undefined
                if(calculatedMd5 === artifact.md5) needsUpdate = false;
                else await fs.promises.unlink(oldPath);
                break;
            case ArtifactType.EXTRACTED_ARCHIVE:
                const hasOldMd5 = reader.readBoolean();
                if(!hasOldMd5) break; // if md5 matching can't be done, there is no point in further checking

                const oldMd5 = reader.readString();
                const oldExtractionRoot = reader.readString();

                if (oldMd5 === artifact.md5 && this.isSameExtractionRoot(artifact, oldExtractionRoot) 
                    && await ArtifactTrackerReader.doAllArchiveItemsExist(this.app, artifact)) {
                    needsUpdate = false;
                } else {
                    // delete all old files
                    ArtifactTrackerReader.deleteEntries(this.app, artifact);
                }
                break;
            default:
                console.warn('Artifact type not implemented for update check:', header.type, '(try updating the launcher)');
                break;
        }

        if (needsUpdate) console.log(`Artifact '${artifact.id}' needs an update...`)
        else console.log(`Artifact '${artifact.id}' is already up-to-date.`)

        reader.closeFile();
        return needsUpdate;
    }

    public toActualPath(path: SegmentedPath) {
        return Path.resolve(this.installationDirectory, ...path);
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
        return artifact.destination ? this.toActualPath(artifact.destination) : this.tmpDir;
    }

    protected guessFinalName(artifact: Artifact) {
        return artifact.fileName ? artifact.fileName : undefined;
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

        const path = this.toActualPath(rootSegments);
        return path === oldExtractionRoot;
    }
}