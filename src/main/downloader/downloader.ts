import fetch, { Headers } from "electron-fetch";
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import Downloader from 'nodejs-file-downloader';
import * as Path from 'path';
import * as fs from 'fs';
import App from "../../common/types/App";
import Installation, { Artifact, SegmentedPath } from "../types/Installation";
import { exists, getInstallerAppDir, resolveSegmentedPath, rmdirRecusive } from "../utils/fshelper";
import { PostActionHandle, PostActionWrapper, ActionFactory, PostActionArgument } from "./postActions";
import { ArtifactType, TrackerReader, ArtifactTrackerVariables } from "./tracker/ArtifactTracker";
import { SingleFileTracker } from "./tracker/SingleFileTracker";
import { ExtractedArchiveTracker } from "./tracker/ExtractedArchiveTracker";
import { withBufferReadMethods } from "../utils/buffer";

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

        console.log('Scanning for old unused artifacts...');
        await this.removeOldArtifacts();

        console.log('Checking for updates...');
        await this.filterDownloadQueue();

        if(!this.isUpToDate()) {
            console.log('Updates found. Downloading...');
            this.downloadQueue.forEach(artifact => this.totalBytes += Math.max(0, artifact.size));
            await this.downloadNextArtifact();
            await this.completePostActions();    
        } else {
            console.log('Everything is already up-to-date.');
        }
        await this.cleanUp();
    }

    protected async removeOldArtifacts() {
        const artifactDir = Path.resolve(getInstallerAppDir(this.app), 'artifacts');
        if(!await exists(artifactDir)) return; // no artifacts downloaded

        const trackerVars = this.getTrackerVars();

        const artifactIds = await fs.promises.readdir(artifactDir); // file names are equal to the artifact ids
        this.downloadQueue.forEach(artifact => {
            const index = artifactIds.indexOf(artifact.id);
            if(index >= 0) artifactIds.splice(index, 1); // remove artifact from list
        });

        // only artifacts which are now unused are inside artifactIds[], delete them
        await Promise.all(artifactIds.map(async (artifactId) => {
            const reader = await createReader(this.app.id, artifactId, trackerVars).catch(() => undefined); // in case of an error, return undefined
            if(!reader) return; // if there was an error, do nothing

            console.log(`Deleting old unused artifact '${artifactId}'...`);
            await reader.deleteEntries(reader, true);
            console.log(`Old Unused artifact '${artifactId}' deleted successfully.`);
        }));
    }

    protected getTrackerVars(): ArtifactTrackerVariables {
        return {
            installationDir: this.installationDirectory,
            tmpDir: this.tmpDir
        };
    }

    public isUpToDate() {
        return this.downloadQueue.length <= 0;
    }

    protected async filterDownloadQueue() {
        const trackerVars = this.getTrackerVars();

        const artifacts = [...this.downloadQueue]; // clone the array

        await Promise.all(artifacts.map(async (artifact) => {
            if(await this.doesArtifactNeedUpdate(artifact, trackerVars).catch((err: Error) => {
                if(err.name === 'VersionError') console.error(err.message);
                else console.error(err);
                return true;
            })) {
                console.log(`Artifact '${artifact.id}' needs an update.`);
            } else {
                console.log(`Artifact '${artifact.id}' is up-to-date. Skipping it...`);

                const index = this.downloadQueue.indexOf(artifact);
                if(index >= 0) this.downloadQueue.splice(index, 1);
            }
        }));
    }

    protected async downloadNextArtifact() {
        if (this.downloadQueue.length <= 0) return;
        const artifact = this.downloadQueue[0];
        this.downloadQueue.splice(0, 1);

        console.log(`Resolving artifact '${artifact.id}...'`);

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

        // If there are any post actions, construct and enqueue them here
        if (postActionHandles.length > 0) {
            const firstAction = postActionHandles[0];
            postActionHandles.forEach((postAction, index) => {
                if (index > 0) firstAction.doLast(postAction);
            });

            firstAction.doLast(ActionFactory.createDefaultTrackerHandle());

            this.enqueuePostAction(firstAction, {
                artifact: artifact,
                result: downloadedPath,
                app: this.app,
                trackerVars: this.getTrackerVars()
            });
        }

        // download next artifact
        await this.downloadNextArtifact();
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

    protected async doesArtifactNeedUpdate(artifact: Artifact, trackerVars: ArtifactTrackerVariables): Promise<boolean> {
        const reader = await createReader(this.app.id, artifact.id, trackerVars).catch(() => undefined); // in case of an error, return undefined
        if(!reader) return true; // if there was an error, do the update, since up-to-date cannot be checked

        let needsUpdate = true;
        if(!artifact.md5) {
            console.info('Artifact does not provide a MD5 checksum; cannot check if the artifact is already up-to-date. Artifact will be updated.');
        } else {
            needsUpdate = !await reader.isArtifactUpToDate(artifact);
        }

        if(needsUpdate) await reader.deleteEntries().catch(() => undefined);
        reader.closeFile();

        return needsUpdate;
    }

    public toActualPath(path: SegmentedPath) {
        return resolveSegmentedPath(this.installationDirectory, path);
    }
}

type TrackerFactory = (artifactId: string, appId: number, vars: ArtifactTrackerVariables, reuseStream?: fs.ReadStream) => TrackerReader;

const TRACKER_READERS = new Map<ArtifactType, TrackerFactory>([
    [
        ArtifactType.SINGLE_FILE,
        (artifact, app, vars, reuseStream) => new (SingleFileTracker.Reader.getConstructor())(artifact, app, vars, reuseStream)
    ],
    [
        ArtifactType.EXTRACTED_ARCHIVE,
        (artifact, app, vars, reuseStream) => new (ExtractedArchiveTracker.Reader.getConstructor())(artifact, app, vars, reuseStream)
    ]
]);

/** Tracker reader to determine tracker type */
class DummyTrackerReader extends TrackerReader {
    public static getConstructor() {
        return withBufferReadMethods(DummyTrackerReader);
    }

    public async toActualReader<T extends TrackerReader>(): Promise<T> {
        await this.openFile();
        const [header, err] = this.readHeader();
        if (err) {
            await this.deleteFile();
            throw err;
        }
        if (!header) {
            await this.deleteFile();
            throw new Error('Could not read header.');
        }

        const readerFactory = TRACKER_READERS.get(header.type);
        if(!readerFactory) throw new TypeError(`No reader factory defined for artifact type '${header.type}'`);

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

async function createReader<T extends TrackerReader>(appId: number, artifactId: string, vars: ArtifactTrackerVariables): Promise<T> {
    const constructor = DummyTrackerReader.getConstructor();
    const dummyReader = new constructor(artifactId, appId, vars);
    return await dummyReader.toActualReader<T>();
}