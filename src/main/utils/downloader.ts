import fetch, { Headers } from "electron-fetch";
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import App from "../../common/types/App";
import Installation, { Artifact, PostAction } from "../types/Installation";
import Downloader from 'nodejs-file-downloader';
import * as Path from 'path';
import { unzip } from "./zip";

let currentDownloadManager: DownloadManager | null = null;

export async function startInstallationProcess(app: App) {
    if(currentDownloadManager) throw new Error('Multiple installation processes are currently not supported.');
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

    const downloadManager = new DownloadManager(installationDir);
    currentDownloadManager = downloadManager;
    installation.artifacts.forEach(artifact => downloadManager.addToQueue(artifact));

    await downloadManager.startDownloading();

    currentDownloadManager = null;
    console.log(`Installation of '${app.title}' finished successfully.`);
}

class DownloadManager {
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

        const finalPath = finalName ? Path.resolve(dir, finalName) : null;

        // TODO add md5 checking + if valid move to destination directory as post action
        if(artifact.post) this.enqueuePostAction(this.createPostActionHandle(artifact.post), finalPath);

        // download next artifact
        await this.downloadNext();
    }

    protected enqueuePostAction(action: PostActionHandle, argument: any) {
        this.actionQueue.push(new PostActionWrapper(action, argument));
        this.doNextPostAction();
    }

    protected async doNextPostAction() {
        if(this.actionQueue.length <= 0 || this.actionWorkerActive) return;
        this.actionWorkerActive = true;

        const action = this.actionQueue[0];
        this.currentPostAction = action.handle;
        this.actionQueue.splice(0, 1);
        
        await action.handle.call(action.argument);
        this.currentPostAction = null;
        this.actionWorkerActive = false;
        this.doNextPostAction();
    }

    protected completePostActions() {
        return new Promise<void>((resolve) => {
            if(this.actionQueue.length <= 0) {
                if(this.currentPostAction) {
                    this.currentPostAction.onCompleted = () => resolve();
                } else resolve();
            } else {
                const lastAction = this.actionQueue[this.actionQueue.length - 1]
                lastAction.handle.onCompleted = () => resolve();
                this.doNextPostAction();
            }
        });
    }

    protected createPostActionHandle(action: PostAction): PostActionHandle {
        switch (action.type) {
            case 'extractZip':
                const child: PostActionHandle | null = action.post ? this.createPostActionHandle(action.post) : null;
                const target = Path.resolve(this.installationDirectory, ...action.destination);
                return new PostActionHandle(async (zipFile) => {
                    console.log(`Unzipping '${zipFile}'...`);
                    // await unzip(zipFile, target, progress => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`));
                    await unzip(zipFile, target);
                    console.log(`Unzipped '${zipFile}'.`);
                }, child);
            default:
                throw new Error(`Unimplemented action: '${action.type}'`);
        }
    }
}

class PostActionWrapper {
    public readonly handle: PostActionHandle;
    public readonly argument: any;

    constructor(handle: PostActionHandle, argument: any) {
        this.handle = handle;
        this.argument = argument;
    }
}

class PostActionHandle {
    protected readonly action: (arg: any) => Promise<any>;
    protected readonly child: PostActionHandle | null;
    public onCompleted?: () => void;

    constructor(action: (arg: any) => Promise<any>, child: PostActionHandle | null) {
        this.action = action;
        this.child = child;
    }

    public async call(arg: any): Promise<void> {
        const result = await this.action(arg);
        if(this.onCompleted) this.onCompleted();
        if(this.child) await this.child.call(result);
    }
}