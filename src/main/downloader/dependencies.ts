import fetch from "electron-fetch";
import { getBackendHost } from "../../common/utils/settings";
import { DependencyDescriptor, DependencyInfo, SpecificInfo } from "../types/Dependency";
import * as os from 'os';
import * as Path from 'path';
import * as fs from 'fs';
import { exists, getDependencyDir, getDependencyTemporaryDir } from "../utils/fshelper";
import Downloader from "nodejs-file-downloader";
import { ActionFactory, ArtifactActionArgument, GeneralActionArgument, PostActionHandle, PostActionWrapper } from "./postActions";
import { unzip } from "../utils/zip";
import { extractTar } from "../utils/tar";

export async function downloadDependencies(dependencies: DependencyDescriptor[]) {
    const installer = new DependencyInstaller();
    await installer.prepare(dependencies);
    await installer.start();
}

class DependencyInstaller {
    protected readonly downloadQueue: DependencyInfo[] = [];
    protected totalBytes = 0;
    protected readonly dependencyCache: Map<string, DependencyInfo | undefined> = new Map();
    protected downloadReady = false;
    protected active = false;
    protected actionQueue: PostActionWrapper<any>[] = [];
    protected currentPostAction: PostActionHandle<any> | null = null;
    protected actionWorkerActive = false;

    public async prepare(descriptors: DependencyDescriptor[]) {
        const filterDeps = async (descriptors: DependencyDescriptor[]) => {
            const infos: DependencyInfo[] = [];
            for (const descriptor of descriptors) {
                const info = await this.getDependencyInfo(descriptor)
                if (!info) throw new Error(`Artifact '${descriptor.id}/${descriptor.version}' could not be found`);
                infos.push(info);
            }
            for (const info of infos) {
                if (info.dependencies) await filterDeps(info.dependencies);
                if (!await exists(getDependencyDir(info))) this.addToDownloadQueue(info); // if the directory for the dependency version exists, assume it is already installed
            }
        }
        await filterDeps(descriptors);
        this.downloadReady = true;
    }

    protected addToDownloadQueue(dependency: DependencyInfo) {
        const info = this.getInfoForOperatingSystem(dependency);
        if (!info.size) throw new Error('Dependency download size is not given');
        this.totalBytes = Math.max(0, info.size);
        this.downloadQueue.push(dependency);
    }

    protected async getDependencyInfo(descriptor: DependencyDescriptor): Promise<DependencyInfo | undefined> {
        const key = `${descriptor.id}/${descriptor.version}`;
        const cached = this.dependencyCache.get(key);
        if (cached) return cached;

        const info = await fetch(`${getBackendHost()}/api/lclplauncher/package-info/${key}`)
            .then(response => response.json())
            .then(json => <DependencyInfo> json)
            .catch(() => undefined);

        this.dependencyCache.set(key, info);
        return info;
    }

    public async start() {
        if (!this.downloadReady) throw new Error('Download is not yet ready.');
        if (this.active) return;
        this.active = true;
        await this.downloadNext();
        await this.completePostActions();
    }

    protected async downloadNext() {
        if (this.downloadQueue.length <= 0) return;
        const dependency = this.downloadQueue[0];
        this.downloadQueue.splice(0, 1);

        await this.download(dependency);
    }

    protected async download(dependency: DependencyInfo) {
        const info = this.getInfoForOperatingSystem(dependency);

        console.log(`Resolving dependency '${dependency.id}...'`);

        if (!info.url) throw new Error('No dependency URL given');
        if (!info.size) throw new Error('No dependency download size given');

        const dir = getDependencyTemporaryDir();
        const url = info.url;
        const downloadSize = info.size;

        let downloadedName: string | null = null;

        const downloader = new Downloader({
            url: url,
            directory: dir,
            cloneFiles: false,
            onResponse: response => {
                const sizeHeader = response.headers['content-length'];
                if (sizeHeader) {
                    const size = Number(sizeHeader);
                    // correct total bytes, if the actual size deviates from the given size
                    if (downloadSize !== size) this.totalBytes -= downloadSize - size;
                }
            },
            onBeforeSave: deducedName => {
                return downloadedName = deducedName;
            }
        });

        console.log(`Downloading '${url}'...`);
        await downloader.download();
        console.log(`Downloaded '${url}'.`);

        if(!downloadedName) throw new Error('Downloaded name is null.');

        const downloadedPath = Path.resolve(dir, downloadedName);
        const targetDir = getDependencyDir(dependency);

        // use ArtifactActionArgument, because it already has the required properties
        let postActionHandles: PostActionHandle<ArtifactActionArgument>[] = [];
        if (info.md5) postActionHandles.push(ActionFactory.createMD5ActionHandle());

        let extension = Path.extname(downloadedPath).substring(1);
        if (downloadedPath.endsWith('.zip')) {
            postActionHandles.push(new ExtractZipAction(targetDir, null));
        }
        else if (downloadedPath.endsWith('.tar.gz') || downloadedPath.endsWith('.tar')) {
            postActionHandles.push(new ExtractTarAction(targetDir, info.itemTotalSize, null));
        } else {
            throw new Error(`Unimplemented dependency package type: ${extension}`);
        }

        if (postActionHandles.length > 0) {
            const firstAction = postActionHandles[0];
            postActionHandles.forEach((postAction, index) => {
                if (index > 0) firstAction.doLast(postAction);
            });

            this.enqueuePostAction(firstAction, <ArtifactActionArgument> <unknown> { // only put necessary properties, because I am lazy
                artifact: {
                    md5: info.md5
                },
                result: downloadedPath
            });
        }

        await this.downloadNext();
    }

    protected getInfoForOperatingSystem(dependency: DependencyInfo): SpecificInfo {
        if (dependency.platform) {
            const currentPlatform = os.platform();
            if (!(currentPlatform in dependency.platform))
                throw new Error(`The artifact '${dependency.id}/${dependency.version}' is not available your platform: '${currentPlatform}'`);
            return dependency.platform[currentPlatform];
        } else {
            // if URL is omitted and platform is undefined, use this default value
            if (!dependency.url) dependency.url = `${getBackendHost()}/api/lclplauncher/package/${dependency.id}/${dependency.version}`;
            return dependency;
        }
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
}

class ExtractZipAction extends PostActionHandle<ArtifactActionArgument> {
    constructor(targetDirectory: string, child: PostActionHandle<GeneralActionArgument> | null) {
        super(async (arg) => {
            const zipFile = arg.result;
            console.log(`Unzipping '${zipFile}'...`);
            // await unzip(zipFile, targetDirectory, progress => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`));
            await unzip(zipFile, targetDirectory);
            console.log(`Unzipped '${zipFile}'. Deleting it...`);
            await fs.promises.unlink(zipFile);
            console.log(`Deleted '${zipFile}'.`);
        }, child);
    }
}

class ExtractTarAction extends PostActionHandle<ArtifactActionArgument> {
    constructor(targetDirectory: string, totalUncompressedSize: number | undefined, child: PostActionHandle<GeneralActionArgument> | null) {
        super(async (arg) => {
            const tarFile = arg.result;
            console.log(`Extracting tarball '${tarFile}'...`);

            const progress = undefined;/*totalUncompressedSize !== undefined ? {
                totalUncompressedSize: totalUncompressedSize,
                onProgress: (progress: Progress) => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`)
            } : undefined;*/

            await extractTar(tarFile, targetDirectory, progress);

            console.log(`Extracted tarball '${tarFile}'. Deleting it...`);
            await fs.promises.unlink(tarFile);
            console.log(`Deleted '${tarFile}'.`);
        }, child);
    }
}