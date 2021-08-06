import fetch, { Headers } from "electron-fetch";
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import Downloader from 'nodejs-file-downloader';
import * as Path from 'path';
import App from "../../common/types/App";
import Installation, { Artifact, Path as SegmentedPath } from "../types/Installation";
import { rmdirRecusive } from "../utils/fshelper";
import { PostActionArgument, PostActionHandle, PostActionWrapper, ActionFactory } from "./postActions";

let currentInstaller: Installer | null = null;

export async function startInstallationProcess(app: App) {
    if(currentInstaller) throw new Error('Multiple installation processes are currently not supported.');
    console.log(`Starting installation process of '${app.title}'...`);

    const headers = new Headers();
    headers.append('pragma', 'no-cache');
    headers.append('cache-control', 'no-cache');

    const [err, result] = await fetch('http://localhost:8080/ls5.installation.jsonc', {
        headers: headers
    }).then(response => response.text())
        .then(text => jsoncSafe.parse(text));

    if(err) throw err;

    const installation = <Installation> result;
    const installationDir = Path.join('C:', 'Users', 'lukas', 'Documents', 'projects', 'misc', 'LCLPLauncher', '.temp', 'test');
    console.log('Installing to:', installationDir);

    const installer = new Installer(installationDir);
    currentInstaller = installer;
    installation.artifacts.forEach(artifact => installer.addToQueue(artifact));

    await installer.startDownloading();

    currentInstaller = null;
    console.log(`Installation of '${app.title}' finished successfully.`);
}

export class Installer {
    public readonly installationDirectory: string;
    public readonly tmpDir: string;
    protected downloadQueue: Artifact[] = [];
    protected actionQueue: PostActionWrapper[] = [];
    protected totalBytes: number = 0;
    protected active = false;
    protected actionWorkerActive = false;
    protected currentPostAction: PostActionHandle | null = null;

    constructor(installationDirectory: string) {
        this.installationDirectory = installationDirectory;
        this.tmpDir = Path.resolve(this.installationDirectory, '.tmp');
    }

    public addToQueue(artifact: Artifact) {
        this.downloadQueue.push(artifact);
    }

    public async startDownloading() {
        if(this.active) return;
        this.active = true;
        this.totalBytes = 0;
        this.downloadQueue.forEach(artifact => this.totalBytes += Math.max(0, artifact.size));
        await this.downloadNext();
        await this.completePostActions();
        await this.cleanUp();
    }

    protected async downloadNext() {
        if(this.downloadQueue.length <= 0) return;
        const artifact = this.downloadQueue[0];
        this.downloadQueue.splice(0, 1);

        // determine directory to place the downloaded file into; if md5 validation should be done, the file will be put in the .tmp dir first
        const dir = artifact.md5 || !artifact.destination ? this.tmpDir : this.toActualPath(artifact.destination);
        let downloadedName: string | null = null;

        const downloader = new Downloader({
            url: artifact.url,
            directory: dir,
            cloneFiles: false,
            onResponse: response => {
                const sizeHeader = response.headers['content-length'];
                if(sizeHeader) {
                    const size = Number(sizeHeader);
                    // correct total bytes, if the actual size deviates from the given size
                    if(artifact.size !== size) this.totalBytes -= artifact.size - size;
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
        if(artifact.md5) {
            postActionHandles.push(ActionFactory.createMD5ActionHandle());
            // if md5 validation is done, the file is in the .tmp directory. The file needs to be moved to it's destination afterwards.
            if(artifact.destination) postActionHandles.push(ActionFactory.createMoveActionHandle(this));
        }
        if(artifact.post) postActionHandles.push(ActionFactory.createPostActionHandle(this, artifact.post));

        if(postActionHandles.length > 0) {
            const firstAction = postActionHandles[0];
            postActionHandles.forEach((postAction, index) => {
                if(index > 0) firstAction.doLast(postAction);
            });

            this.enqueuePostAction(firstAction, {
                artifact: artifact,
                result: downloadedPath
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
        if(this.actionQueue.length <= 0 || this.actionWorkerActive) return;
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
            if(this.actionQueue.length <= 0) {
                // no enqueued actions, check if there is an action currently running
                if(this.currentPostAction) {
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

    public toActualPath(path: SegmentedPath) {
        return Path.resolve(this.installationDirectory, ...path);
    }
}