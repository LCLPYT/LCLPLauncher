import fetch, { Headers } from "electron-fetch";
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import App from "../../common/types/App";
import Installation, { Artifact, PostAction } from "../types/Installation";
import Downloader from 'nodejs-file-downloader';
import * as Path from 'path';
import { unzip } from "./zip";
import { checksumFile } from "./checksums";
import { strict as assert } from 'assert';
import { rmdirRecusive, unlink } from "./fshelper";

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

class Installer {
    protected readonly installationDirectory: string;
    protected readonly tmpDir: string;
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

        const dir = artifact.md5 || !artifact.destination ? this.tmpDir : Path.resolve(this.installationDirectory, ...artifact.destination);

        let finalName: string | null = null;

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
                return finalName = artifact.fileName ? artifact.fileName : deducedName;
            }
        });

        console.log(`Downloading '${artifact.url}'...`);
        await downloader.download();
        console.log(`Downloaded '${artifact.url}'.`);

        const downloadedPath = finalName ? Path.resolve(dir, finalName) : null;

        let postActionHandles = [];
        if(artifact.md5) postActionHandles.push(this.createMD5ActionHandle());
        if(artifact.post) postActionHandles.push(this.createPostActionHandle(artifact.post));

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

    protected createMD5ActionHandle(): PostActionHandle {
        return new PostActionHandle(async ({result: file, artifact: { md5 }}) => {
            console.log(`Checking integrity of '${file}'...`);
            const calculatedMd5 = await checksumFile(file, 'md5');
            assert(md5 && calculatedMd5 === md5, `Checksum mismatch '${file}'.`);
            console.log(`Integrity valid: '${file}'`);
        }, null);
    }

    protected createPostActionHandle(action: PostAction): PostActionHandle {
        switch (action.type) {
            case 'extractZip':
                const child: PostActionHandle | null = action.post ? this.createPostActionHandle(action.post) : null;
                const target = Path.resolve(this.installationDirectory, ...action.destination);
                return new PostActionHandle(async ({result: zipFile}) => {
                    console.log(`Unzipping '${zipFile}'...`);
                    // await unzip(zipFile, target, progress => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`));
                    await unzip(zipFile, target);
                    console.log(`Unzipped '${zipFile}'. Deleting it...`);
                    await unlink(zipFile);
                    console.log(`Deleted '${zipFile}'.`);
                }, child);
            default:
                throw new Error(`Unimplemented action: '${action.type}'`);
        }
    }
}

type PostActionArgument = {
    artifact: Artifact;
    result: any;
}

class PostActionWrapper {
    public readonly handle: PostActionHandle;
    public readonly argument: PostActionArgument;

    constructor(handle: PostActionHandle, argument: PostActionArgument) {
        this.handle = handle;
        this.argument = argument;
    }
}

class PostActionHandle {
    protected readonly action: (arg: PostActionArgument) => Promise<any>;
    protected child: PostActionHandle | null;
    public onCompleted?: () => void;

    /**
     * Construct a new handle.
     * @param action The action function. This function will receive the return result of it's parent's action in action.result (or their argument if nothing is returned).
     * @param child The action to be executed after this action.
     */
    constructor(action: (arg: PostActionArgument) => Promise<any>, child: PostActionHandle | null) {
        this.action = action;
        this.child = child;
    }

    public async call(arg: PostActionArgument): Promise<void> {
        const result = await this.action(arg);
        if(this.onCompleted) this.onCompleted();
        if(this.child) {
            if(result !== undefined) arg.result = result;
            await this.child.call(arg);
        }
    }

    /**
     * @returns The last action in this action chain.
     */
    public lastChild(): PostActionHandle {
        return this.child ? this.child.lastChild() : this;
    }

    /**
     * Enqueues an action to be run, after this action is done. 
     * If this action already has a successor, the new action will be executed between them.
     * @param action The action to execute after this action.
     */
    public doAfter(action: PostActionHandle) {
        const oldChild = this.child;
        if(oldChild) action.doLast(oldChild);
        this.child = action;
    }

    /**
     * Enqueues an action to be run, after this action chain is done.
     * @param action The action to execute at the end of this action chain.
     */
    public doLast(action: PostActionHandle) {
        this.lastChild().child = action; // safe, because the last action has no child
    }
}