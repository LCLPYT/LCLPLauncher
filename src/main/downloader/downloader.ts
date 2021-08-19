import fetch, { Headers } from "electron-fetch";
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import Downloader from 'nodejs-file-downloader';
import * as Path from 'path';
import * as fs from 'fs';
import App from "../../common/types/App";
import Installation, { Artifact, SegmentedPath } from "../types/Installation";
import { exists, getInstallerAppDir, resolveSegmentedPath, rmdirRecusive } from "../utils/fshelper";
import { PostActionHandle, PostActionWrapper, ActionFactory, ArtifactActionArgument, GeneralActionArgument } from "./postActions";
import { ArtifactType, TrackerReader, ArtifactTrackerVariables, TrackerHeader } from "./tracker/ArtifactTracker";
import { SingleFileTracker } from "./tracker/SingleFileTracker";
import { ExtractedArchiveTracker } from "./tracker/ExtractedArchiveTracker";
import { withBufferReadMethods } from "../utils/buffer";
import { AppTracker } from "./tracker/AppTracker";
import * as semver from 'semver';
import { getAppVersion } from "../../common/utils/env";
import { DepedencyAccessor, downloadDependencies } from "./dependencies";
import { DependencyFragment } from "../types/Dependency";
import { ExistingFileTracker } from "./tracker/ExistingFileTracker";
import { resolveUrl } from "./urlResolver";
import { getBackendHost } from "../../common/utils/settings";

let currentInstaller: Installer | null = null;

export async function startInstallationProcess(app: App, installationDir: string) {
    if (currentInstaller) throw new Error('Multiple installation processes are currently not supported.');

    console.log(`Starting installation process of '${app.title}'...`);

    const headers = new Headers();
    headers.append('pragma', 'no-cache');
    headers.append('cache-control', 'no-cache');

    const [err, result] = await fetch(`${getBackendHost()}/api/lclplauncher/app-installer/ls5`, {
        headers: headers
    }).then(response => response.text())
        .then(text => jsoncSafe.parse(text));

    if (err) throw err;

    const installation = <Installation> result;

    let dependencyStructure: DependencyFragment[] | undefined;
    if (installation.dependencies) {
        console.log('Checking dependencies...');
        dependencyStructure = await downloadDependencies(installation.dependencies);
        console.log('Dependencies are now up-to-date.');
    }

    console.log('Installing to:', installationDir);

    const installer = await createAndPrepareInstaller(app, installationDir, installation);
    installer.dependencyStructure = dependencyStructure;
    currentInstaller = installer;
    await installer.startDownloading();

    currentInstaller = null;
    console.log(`Installation of '${app.title}' finished successfully.`);
}

async function createAndPrepareInstaller(app: App, installationDir: string, installation: Installation): Promise<Installer> {
    const installer = new Installer(app, installationDir, installation);
    await installer.init();
    if (installation.artifacts) installation.artifacts.forEach(artifact => installer.addToQueue(artifact));
    await installer.prepare();
    return installer;
}

export class Installer {
    public readonly installationDirectory: string;
    public readonly tmpDir: string;
    public readonly app: App;
    public readonly installation: Installation;
    protected downloadQueue: Artifact[] = [];
    protected actionQueue: PostActionWrapper<any>[] = [];
    protected totalBytes: number = 0;
    protected active = false;
    protected actionWorkerActive = false;
    protected currentPostAction: PostActionHandle<any> | null = null;
    protected installedVersion?: AppTracker.Header;
    protected downloadReady = false;
    public dependencyStructure?: DependencyFragment[];

    constructor(app: App, installationDirectory: string, installer: Installation) {
        this.app = app;
        this.installationDirectory = installationDirectory;
        this.tmpDir = Path.resolve(this.installationDirectory, '.tmp');
        this.installation = installer;

        if (this.installation.launcherVersion) {
            const currentVersion = getAppVersion();
            if(!currentVersion) throw new Error(`Could not determine current launcher version. This is needed because app '${this.app.id}' required launcher version '${this.installation.launcherVersion}'`);
            if(!semver.satisfies(currentVersion, this.installation.launcherVersion))
                throw new Error(`Current launcher version '${currentVersion}' does not satisfy app requirement of '${this.installation.launcherVersion}'`);
        }
    }

    public async init() {
        const reader = new (AppTracker.Reader.getConstructor())(this.app.id, this.getAppTrackerVars());
        if (!await reader.doesFileExist()) return;

        await reader.openFile();
        let header: AppTracker.Header | undefined;
        try {
            header = reader.readHeader();
            this.installedVersion = header;
        } catch (err) {
            console.error('Could not read app tracker header.');
        }

        reader.closeFile();
    }

    public addToQueue(artifact: Artifact) {
        this.downloadQueue.push(artifact);
    }

    public async prepare() {
        console.log('Scanning for old unused artifacts...');
        await this.removeOldArtifacts();

        console.log('Checking for updates...');
        await this.filterDownloadQueue();

        this.downloadReady = true;
    }

    public async startDownloading() {
        if (!this.downloadReady) throw new Error('Download is not yet ready');
        if (this.active) return;
        this.active = true;
        this.totalBytes = 0;

        if (!this.isUpToDate()) {
            console.log('Updates found. Downloading...');
            this.downloadQueue.forEach(artifact => this.totalBytes += Math.max(0, artifact.size));
            await this.downloadNextArtifact();

            console.log('Finalizing...');
            this.enqueueFinalization();
            await this.completePostActions();
            console.log('Finalization complete.');

            await this.writeTracker();
        } else {
            console.log('Everything is already up-to-date.');

            console.log('Finalizing...');
            this.enqueueFinalization();
            await this.completePostActions();
            console.log('Finalization complete.');
        }
        await this.cleanUp();
    }

    protected async writeTracker() {
        const tracker = new (AppTracker.Writer.getConstructor())(this.app.id, this.getAppTrackerVars());
        await tracker.writeAppTracker();
    }

    protected async removeOldArtifacts() {
        const artifactDir = Path.resolve(getInstallerAppDir(this.app), 'artifacts');
        if (!await exists(artifactDir)) return; // no artifacts downloaded

        const trackerVars = this.getArtifactTrackerVars();

        const artifactIds = await fs.promises.readdir(artifactDir); // file names are equal to the artifact ids
        this.downloadQueue.forEach(artifact => {
            const index = artifactIds.indexOf(artifact.id);
            if (index >= 0) artifactIds.splice(index, 1); // remove artifact from list
        });

        // only artifacts which are now unused are inside artifactIds[], delete them
        await Promise.all(artifactIds.map(async (artifactId) => {
            const reader = await createReader(this.app.id, artifactId, trackerVars).catch(() => undefined); // in case of an error, return undefined
            if (!reader) return; // if there was an error, do nothing

            console.log(`Deleting old unused artifact '${artifactId}'...`);
            await reader.deleteEntries(reader, true);
            console.log(`Old Unused artifact '${artifactId}' deleted successfully.`);
        }));
    }

    protected getArtifactTrackerVars(): ArtifactTrackerVariables {
        return {
            installationDir: this.installationDirectory,
            tmpDir: this.tmpDir
        };
    }

    protected getAppTrackerVars(): AppTracker.Variables {
        return {
            version: this.installation.version,
            versionInt: this.installation.versionInt
        };
    }

    public isUpToDate() {
        return this.installedVersion && this.installedVersion.versionInt >= this.installation.versionInt && this.downloadQueue.length <= 0;
    }

    protected async filterDownloadQueue() {
        const trackerVars = this.getArtifactTrackerVars();
        const artifacts = [...this.downloadQueue]; // clone the array

        await Promise.all(artifacts.map(async (artifact) => {
            if (await this.doesArtifactNeedUpdate(artifact, trackerVars).catch((err: Error) => {
                if (err.name === 'VersionError') console.error(err.message);
                else console.error(err);
                return true;
            })) {
                console.log(`Artifact '${artifact.id}' needs an update.`);
            } else {
                console.log(`Artifact '${artifact.id}' is up-to-date. Skipping it...`);

                const index = this.downloadQueue.indexOf(artifact);
                if (index >= 0) this.downloadQueue.splice(index, 1);
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

        const url = await resolveUrl(artifact.url);

        const downloader = new Downloader({
            url: url,
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

        console.log(`Downloading '${url}'...`);
        await downloader.download();
        console.log(`Downloaded '${url}'.`);

        const downloadedPath = downloadedName ? Path.resolve(dir, downloadedName) : null;

        let postActionHandles: PostActionHandle<ArtifactActionArgument>[] = [];
        if (artifact.md5) {
            const ac = ActionFactory.createMD5ActionHandle();
            postActionHandles.push(ac);

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
                trackerVars: this.getArtifactTrackerVars(),
                dependencyAccessor: new DepedencyAccessor(this.dependencyStructure)
            });
        }

        // download next artifact
        await this.downloadNextArtifact();
    }

    protected enqueueFinalization() {
        this.installation.finalize?.forEach(action => {
            const handle = ActionFactory.createPostActionHandle(this, action);
            this.enqueuePostAction(handle, {
                app: this.app,
                result: this.installationDirectory
            });
        });
    }

    protected enqueuePostAction<T extends GeneralActionArgument>(action: PostActionHandle<T>, argument: T) {
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
        if (!reader) return true; // if there was an error, do the update, since up-to-date cannot be checked

        let needsUpdate = true;
        if (!artifact.md5) {
            console.info('Artifact does not provide a MD5 checksum; cannot check if the artifact is already up-to-date. Artifact will be updated.');
        } else {
            needsUpdate = !await reader.isArtifactUpToDate(artifact);
        }

        if (needsUpdate) await reader.deleteEntries().catch(() => undefined);
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
    ],
    [
        ArtifactType.EXISTING_FILE,
        (artifact, app, vars, reuseStream) => new (ExistingFileTracker.Reader.getConstructor())(artifact, app, vars, reuseStream)
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
        if (!readerFactory) throw new TypeError(`No reader factory defined for artifact type '${header.type}'`);

        return <T>readerFactory(this.artifactId, this.appId, this.vars, this.stream); // reuse this stream, therefore do not close the file here.
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