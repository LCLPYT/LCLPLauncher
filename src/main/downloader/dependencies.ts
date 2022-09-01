import fetch from "electron-fetch";
import log from 'electron-log';
import * as fs from 'fs';
import Downloader from "nodejs-file-downloader";
import * as os from 'os';
import * as Path from 'path';
import AppDependency from "../../common/types/AppDependency";
import { InputMap } from "../../common/types/InstallationInputResult";
import { ToastType } from "../../common/types/Toast";
import { getBackendHost } from "../../common/utils/settings";
import { Toast } from "../core/service/toast";
import { DependencyDescriptor, DependencyFragment, DependencyInfo, SpecificInfo } from "../types/Dependency";
import { exists, getDependencyDir, getDependencyTemporaryDir } from "../core/io/fshelper";
import { DOWNLOADER } from "../utils/ipc";
import { extractTar } from "../core/service/tar";
import { unzip } from "../core/service/zip";
import { ActionFactory, ArtifactActionArgument, GeneralActionArgument, PostActionHandle, PostActionWrapper } from "./postActions";

export namespace Dependencies {
    export async function getUninstalledDependencies(dependencies: DependencyDescriptor[]): Promise<AppDependency[]> {
        const installer = new DependencyInstaller(undefined);
        await installer.prepare(dependencies);
        return (await installer.getUninstalledDependencies()).map(info => <AppDependency> {
            name: info.id,
            version: info.version
        });
    }

    export async function downloadDependencies(dependencies: DependencyDescriptor[], inputMap: InputMap) {
        const installer = new DependencyInstaller(inputMap);
        await installer.prepare(dependencies);
        return await installer.start();
    }
    
    export class DependencyAccessor {
        public readonly structure?: DependencyFragment[];
        public readonly infos: DependencyInfoStore;
    
        constructor(structure: DependencyFragment[] | undefined, infos: DependencyInfoStore) {
            this.structure = structure;
            this.infos = infos;
        }
    
        public getDependency(id: string, version: string): DependencyFragment | undefined {
            if (!this.structure) return undefined;
    
            const structure = this.structure;
    
            const recurse: (dependencies: DependencyFragment[] | undefined) => DependencyFragment | undefined = dependencies => {
                if (!dependencies) return undefined;
    
                for (const dependency of dependencies) {
                    if (dependency.id === id && dependency.version === version) return dependency;
    
                    const nestedDependency = recurse(dependency.dependencies);
                    if (nestedDependency) return nestedDependency;
                }
    
                return undefined;
            };
    
            return recurse(structure);
        }
    
        public getMandatoryDependency(id: string, version: string): DependencyDescriptor {
            const dependency = this.getDependency(id, version);
            if (!dependency) throw new Error(`Missing dependency '${id}'`);
            return dependency;
        }

        public getDependencyInfo(id: string): DependencyInfo | undefined {
            return this.infos[id];
        }

        public getMandatoryDependencyInfo(id: string): DependencyInfo {
            const info = this.getDependencyInfo(id);
            if (!info) throw new Error(`Missing info for dependency '${id}'`);
            return info;
        }
    }

    export type DependencyInfoStore = {
        [key: string]: DependencyInfo
    }

    export function getInfoForOperatingSystem(dependency: DependencyInfo): SpecificInfo {
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
    
    class DependencyInstaller {
        protected readonly downloadQueue: DependencyInfo[] = [];
        protected readonly dependencyCache: Map<string, DependencyInfo | undefined> = new Map();
        protected downloadReady = false;
        protected active = false;
        protected actionQueue: PostActionWrapper<any>[] = [];
        protected currentPostAction: PostActionHandle<any> | null = null;
        protected actionWorkerActive = false;
        protected structure: DependencyFragment[] = [];
        protected queueLength = 0;
        protected queuePosition = 0;
        protected inputMap: InputMap | undefined;

        constructor(inputMap: InputMap | undefined) {
            this.inputMap = inputMap;
        }
    
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
            this.structure = await this.buildStructure(descriptors);
            this.downloadReady = true;
        }
    
        protected async buildStructure(descriptors: DependencyDescriptor[]) {
            const fragments: DependencyFragment[] = [];
    
            for (const descriptor of descriptors) {
                const info = await this.getDependencyInfo(descriptor);
                if (!info) continue;
    
                const children = info.dependencies ? await this.buildStructure(info.dependencies) : undefined;
    
                fragments.push({
                    id: info.id,
                    version: info.version,
                    dependencies: children
                });
            }
    
            return fragments;
        }
    
        protected addToDownloadQueue(dependency: DependencyInfo) {
            const info = getInfoForOperatingSystem(dependency);
            if (!info.size) throw new Error('Dependency download size is not given');
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

        public async getUninstalledDependencies() {
            if (!this.structure) throw new Error('Dependency structure was not build');

            const uninstalled: DependencyInfo[] = [];
            for (const info of this.downloadQueue) {
                if (!await exists(getDependencyDir(info))) uninstalled.push(info);
            }

            return uninstalled;
        }
    
        public async start(): Promise<[DependencyFragment[], DependencyInfoStore] | undefined> {
            if (!this.downloadReady) throw new Error('Download is not yet ready.');
            if (this.active) return undefined;

            const store: DependencyInfoStore = {};
            Array.from(this.dependencyCache.entries()).forEach(([key, value]) => {
                if (value) store[key] = value;
            });

            if (this.downloadQueue.length <= 0) return [this.structure, store]; // no artifacts to download
    
            const toastId = Toast.add({
                icon: 'file_download',
                title: 'Downloading dependencies',
                type: ToastType.PACKAGE_DOWNLOAD_STATUS,
                noAutoHide: true
            });

            DOWNLOADER.updateInstallationState('preinstalling');

            this.active = true;
            this.queueLength = this.downloadQueue.length;
            this.queuePosition = 0;
            await this.downloadNext();
            await this.completePostActions();

            DOWNLOADER.updateInstallationState('preinstalling');

            Toast.remove(toastId);
    
            return [this.structure, store];
        }
    
        protected async downloadNext() {
            if (this.downloadQueue.length <= 0) return;
            const dependency = this.downloadQueue[0];
            this.downloadQueue.splice(0, 1);
    
            await this.download(dependency);
        }
    
        protected async download(dependency: DependencyInfo) {
            this.queuePosition++;
            const info = getInfoForOperatingSystem(dependency);
    
            log.verbose(`Resolving dependency '${dependency.id}...'`);
    
            if (!info.url) throw new Error('No dependency URL given');
            if (!info.size) throw new Error('No dependency download size given');
    
            const dir = getDependencyTemporaryDir();
            const url = info.url;
            const downloadSize = info.size;
    
            let downloadedName: string | null = null;
            let contentLength = downloadSize;
            let downloadedBytes = 0;
    
            const downloader = new Downloader({
                url: url,
                directory: dir,
                cloneFiles: false,
                onResponse: response => {
                    const sizeHeader = response.headers['content-length'];
                    if (sizeHeader) contentLength = Number(sizeHeader);
                },
                onBeforeSave: deducedName => {
                    return downloadedName = deducedName;
                },
                onProgress: (_progress, chunk) => {
                    downloadedBytes += (chunk as Buffer).length;
                    DOWNLOADER.updatePackageDownloadProgress({
                        packageName: dependency.id,
                        queueSize: this.queueLength,
                        currentQueuePosition: this.queuePosition,
                        currentProgress: downloadedBytes / contentLength
                    });
                }
            });
    
            log.verbose(`Downloading '${url}'...`);
            await downloader.download();
            log.verbose(`Downloaded '${url}'.`);
    
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
                    result: downloadedPath,
                    inputMap: this.inputMap
                });
            }
    
            await this.downloadNext();
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
                log.verbose(`Unzipping '${zipFile}'...`);
                // await unzip(zipFile, targetDirectory, progress => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`));
                await unzip(zipFile, targetDirectory);
                log.verbose(`Unzipped '${zipFile}'. Deleting it...`);
                await fs.promises.unlink(zipFile);
                log.verbose(`Deleted '${zipFile}'.`);
            }, child);
        }
    }
    
    class ExtractTarAction extends PostActionHandle<ArtifactActionArgument> {
        constructor(targetDirectory: string, totalUncompressedSize: number | undefined, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                const tarFile = arg.result;
                log.verbose(`Extracting tarball '${tarFile}'...`);
    
                const progress = undefined;/*totalUncompressedSize !== undefined ? {
                    totalUncompressedSize: totalUncompressedSize,
                    onProgress: (progress: Progress) => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`)
                } : undefined;*/
    
                await extractTar(tarFile, targetDirectory, progress);
    
                log.verbose(`Extracted tarball '${tarFile}'. Deleting it...`);
                await fs.promises.unlink(tarFile);
                log.verbose(`Deleted '${tarFile}'.`);
            }, child);
        }
    }
}