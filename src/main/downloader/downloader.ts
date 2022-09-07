import { BrowserWindow, dialog } from "electron";
import log from 'electron-log';
import * as fs from 'fs';
import { jsoncSafe } from "jsonc/lib/jsonc.safe";
import Downloader from 'nodejs-file-downloader';
import * as os from 'os';
import * as Path from 'path';
import * as semver from 'semver';
import App from "../../common/types/App";
import AppState from "../../common/types/AppState";
import { CompiledInstallationInput } from "../../common/types/InstallationInput";
import { InputMap } from "../../common/types/InstallationInputResult";
import { ToastType } from "../../common/types/Toast";
import { translate } from "../../common/utils/i18n";
import { getBackendHost } from "../../common/utils/settings";
import { exists, getAppArtifactsDir, getAppStartupFile, getDependencyDir, mkdirp, resolveSegmentedPath, rmdirRecursive } from "../core/io/fshelper";
import { isAppRunning } from "../core/runningApps";
import Net from "../core/service/net";
import { Toast } from "../core/service/toast";
import { InstalledApplication } from "../database/models/InstalledApplication";
import AppInfo from "../types/AppInfo";
import { DependencyFragment } from "../types/Dependency";
import Installation, { Artifact, SegmentedPath } from "../types/Installation";
import { fetchApp } from "../utils/backend";
import { getAppVersion } from "../utils/env";
import { DOWNLOADER } from "../utils/ipc";
import { replaceArraySubstitutes, Substitution, SubstitutionFunctions, SubstitutionVariables } from "../utils/substitute";
import { isDomainTrusted } from "../utils/tls";
import { Dependencies } from "./dependencies";
import { compileAdditionalInputs, readInputMap, writeInputMap } from "./inputs";
import { ActionFactory, ArtifactActionArgument, GeneralActionArgument, PostActionHandle, PostActionWrapper } from "./postActions";
import { AppTracker } from "./tracker/AppTracker";
import { ArtifactTrackerVariables } from "./tracker/ArtifactTracker";
import { createReader } from "./tracker/ArtifactTrackers";
import { registerUninstallExceptionPath, uninstallApp } from "./uninstall";
import { resolveUrl } from "./urlResolver";

const queue: [App, string, InputMap, (err: any) => void][] = [];
let currentInstaller: Installer | null = null;
let currentPreinstalling = false;
let currentIsUpdating = false;
let queueBatchLength = 0;
let queueBatchPosition = 0;

export async function getAppState(app: App): Promise<AppState> {
    if (isAppRunning(app)) return 'running';

    const installedApp = await InstalledApplication.query().where('app_id', app.id).first();
    if (!installedApp) return 'not-installed';

    if (!await exists(installedApp.path)) {
        await uninstallApp(app); // remove database references
        return 'not-installed';
    }

    if (queue.find(([queuedApp]) => queuedApp.id === app.id)) return 'in-queue';

    // current must be this app

    if (currentPreinstalling) return 'preinstalling';
    if (currentInstaller) return currentIsUpdating ? 'updating' : 'installing';

    let installationMaybe: Installation | undefined;
    
    try {
        installationMaybe = await fetchInstallation(app);
    } catch (err) {
        if (err instanceof Error) {
            if (err.message.startsWith('[Outdated]: ')) return 'outdated-launcher';
            else if (err.message.startsWith('[Unsupported Platform]: ')) return 'unsupported-platform';
        }
        throw err;
    }

    if (!installationMaybe) throw new Error('Installation is undefined');
    const installation = installationMaybe;

    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine app version.');
    if (!semver.satisfies(currentAppVersion, installation.launcherVersion)) return 'outdated-launcher';

    const inputMap = await readInputMap(app);
    const installer = await createAndPrepareInstaller(app, installedApp.path, installation, inputMap);
    
    return installer.isUpToDate() ? 'ready-to-play' : 'needs-update'; // TODO maybe enable users to play with outdated launcher versions
}

export async function fetchAdditionalInputs(app: App, installationDir: string, map: InputMap): Promise<CompiledInstallationInput[]> {
    const installation = await fetchInstallation(app);
    if (!installation.inputs) return [];
    else return await compileAdditionalInputs(installation.inputs, installationDir, map);
}

export async function validateInstallationDir(dir: string) {
    if (!await exists(dir)) return;

    const files = await fs.promises.readdir(dir);
    if (files.length > 0) {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
            const result = await dialog.showMessageBox(focusedWindow, {
                type: 'question',
                buttons: [translate('cancel'), translate('install.dialog.choose_anyway')],
                title: translate('install.dir_not_empty'),
                message: translate('install.ask_dir_not_empty'),
                noLink: true
            });
            const btnIndex = result.response;
            if (btnIndex === 0) throw new Error('Operation cancelled.'); // cancel button
        }
    }
}

export async function doesAppNeedUpdate(appKey: string): Promise<boolean> {
    const app = await fetchApp(appKey);

    const installedApp = await InstalledApplication.query().where('app_id', app.id).first();
    if (!installedApp) throw new Error(`[Uninstalled]: App with id ${app.id} is not installed by LCLPLauncher on this machine.`);

    const installation = await fetchInstallation(app);
    const inputMap = await readInputMap(app);
    const installer = await createAndPrepareInstaller(app, installedApp.path, installation, inputMap);
    
    return !installer.isUpToDate();
}

async function fetchAppInfo(app: App): Promise<AppInfo> {
    const [err, appInfo]: [any, AppInfo?] = await Net.fetchUncached(`${getBackendHost()}/api/lclplauncher/app-info/${app.key}`)
        .then(response => response.text())
        .then(text => jsoncSafe.parse(text));

    if (err) throw err;
    if (!appInfo) throw new Error('Info result could not be read.');

    return appInfo;
}

async function isAppInfoVersionValid(info: AppInfo) {
    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine app version.');
    return semver.satisfies(currentAppVersion, info.launcherVersion);
}

async function fetchInstallation(app: App): Promise<Installation> {
    const appInfo = await fetchAppInfo(app);
    if (!await isAppInfoVersionValid(appInfo)) throw new Error(`[Outdated]: The app '${app.key}' requires launcher version ${appInfo.launcherVersion}`);

    if (!(os.platform() in appInfo.platforms)) throw new Error(`[Unsupported Platform]: Current platform '${os.platform()}' is not supported by the app '${app.key}'.`);
    const platformInfo = appInfo.platforms[os.platform()];

    const [err, installation]: [any, Installation?] = await Net.fetchUncached(`${getBackendHost()}/api/lclplauncher/app-installer/${app.key}/${platformInfo.installer}`)
        .then(response => response.text())
        .then(text => jsoncSafe.parse(text));

    if (err) throw err;
    if (!installation) throw new Error('Installation could not be read.');

    return installation;
}

export async function isInstallationLauncherVersionValid(app: App): Promise<boolean> {
    const installation = await fetchInstallation(app);
    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine current launcher version.');
    return semver.satisfies(currentAppVersion, installation.launcherVersion);
}

export async function getUninstalledDependencies(app: App) {
    const installation = await fetchInstallation(app);
    return installation && installation.dependencies ? await Dependencies.getUninstalledDependencies(installation.dependencies) : [];
}

export async function startInstallationProcess(app: App, installationDir: string, map: InputMap) {
    queueBatchLength++;

    if (currentInstaller) {
        await new Promise<void>((resolve, reject) => {
            queue.push([app, installationDir, map, err => {
                if (err) reject(err);
                else resolve();
            }]);
        });
        return;
    }

    log.info(`Starting installation process of '${app.title}'...`);

    const installation = await fetchInstallation(app);

    let dependencyStructure: DependencyFragment[] | undefined;
    let dependencyInfos: Dependencies.DependencyInfoStore = {};
    if (installation.dependencies) {
        const result = await Dependencies.downloadDependencies(installation.dependencies, map);
        if (result) dependencyInfos = result[1];

        log.info('Checking dependencies...');
        currentPreinstalling = true;
        dependencyStructure = result ? result[0] : undefined;
        currentPreinstalling = false;
        log.info('Dependencies are now up-to-date.');
    }

    log.info('Installing to:', installationDir);
    const toastId = Toast.add({
        icon: 'file_download',
        title: translate('toast.downloads_active'),
        type: ToastType.DOWNLOAD_STATUS,
        noAutoHide: true
    });

    // Add to database
    const installedApp = await InstalledApplication.query().where('app_id', app.id).first();
    currentIsUpdating = !!installedApp;
    DOWNLOADER.updateInstallationState(currentIsUpdating ? 'updating' : 'installing');

    if (!installedApp) await InstalledApplication.query().insert({
        app_id: app.id,
        path: installationDir
    });

    function resetInstallation() {
        currentInstaller = null;
        currentIsUpdating = false;
        Toast.remove(toastId);
    }

    function beginNextInstallation() {
        if (queue.length > 0) {
            const next = queue.splice(0, 1);
            if (next.length !== 1) throw new Error('Next item could not be determined');
    
            const [nextApp, nextInstallDir, nextMap, callback] = next[0];
            queueBatchPosition++;
    
            // start next installation process, and notify the queued promise on completion.
            // do not wait in this installation's promise, since this installation process is done.
            startInstallationProcess(nextApp, nextInstallDir, nextMap)
                .then(() => callback(undefined)) // no error
                .catch(err => callback(err));
        } else {
            queueBatchLength = 0;
            queueBatchPosition = 0;
        }
    }

    const installer = await createAndPrepareInstaller(app, installationDir, installation, map);
    installer.dependencyStructure = dependencyStructure;
    installer.dependencyInfos = dependencyInfos;
    currentInstaller = installer;
    try {
        await installer.startDownloading();
    } catch(err) {
        resetInstallation();

        Toast.add(Toast.createError(
            translate('toast.installation_failed'), 
            translate('toast.installation_error', app.title)
        ));
        
        beginNextInstallation();
        throw err;
    }

    resetInstallation();
    log.info(`Installation of '${app.title}' finished successfully.`);

    // provide finish notification
    Toast.add({
        icon: 'done',
        title: translate('toast.installation_finished'),
        type: ToastType.TEXT,
        detail: translate('toast.installation_finished.desc', app.title)
    });

    // start next queue item, if there is one
    beginNextInstallation();
}

export async function createAndPrepareInstaller(app: App, installationDir: string, installation: Installation, inputMap: InputMap): Promise<Installer> {
    const installer = new Installer(app, installationDir, installation, inputMap);
    await installer.init();
    if (installation.artifacts) installation.artifacts.forEach(artifact => installer.addToQueue(artifact));
    await installer.prepare();
    return installer;
}

export class Installer {
    public readonly installationDirectory: string;
    public readonly tmpDir: string;
    public readonly app: App;
    public readonly inputMap: InputMap;
    public readonly installation: Installation;
    protected downloadQueue: Artifact[] = [];
    protected actionQueue: PostActionWrapper<any>[] = [];
    protected totalBytes = 0;
    protected downloadedBytes = 0;
    protected active = false;
    protected actionWorkerActive = false;
    protected currentPostAction: PostActionHandle<any> | null = null;
    protected installedVersion?: AppTracker.Header;
    protected downloadReady = false;
    public dependencyStructure?: DependencyFragment[];
    public dependencyInfos: Dependencies.DependencyInfoStore = {};
    protected rejectFunction?: (err: any) => void;
    protected currentDownloader?: Downloader;

    constructor(app: App, installationDirectory: string, installer: Installation, inputMap: InputMap) {
        this.app = app;
        this.installationDirectory = installationDirectory;
        this.tmpDir = Path.resolve(this.installationDirectory, '.tmp');
        this.installation = installer;
        this.inputMap = inputMap;
    }

    protected _dependencyAccessor?: Dependencies.DependencyAccessor;

    public get dependencyAccessor() : Dependencies.DependencyAccessor {
        return this._dependencyAccessor ? this._dependencyAccessor : (this._dependencyAccessor = new Dependencies.DependencyAccessor(this.dependencyStructure, this.dependencyInfos));
    }

    public async validateVersion() {
        if (this.installation.launcherVersion) {
            const currentVersion = getAppVersion();
            if(!currentVersion) throw new Error(`Could not determine current launcher version. This is needed because app '${this.app.id}' required launcher version '${this.installation.launcherVersion}'`);
            if(!semver.satisfies(currentVersion, this.installation.launcherVersion))
                throw new Error(`Current launcher version '${currentVersion}' does not satisfy app requirement of '${this.installation.launcherVersion}'`);
        }
    }

    public async init() {
        await this.validateVersion();
        
        const reader = new (AppTracker.Reader.getConstructor())(this.app.id, this.getAppTrackerVars());
        if (!await reader.doesFileExist()) return;

        await reader.openFile();
        let header: AppTracker.Header | undefined;
        try {
            header = reader.readHeader();
            this.installedVersion = header;
        } catch (err) {
            log.error('Could not read app tracker header.', err);
        }

        reader.closeFile();
    }

    public addToQueue(artifact: Artifact) {
        this.downloadQueue.push(artifact);
    }

    public async prepare() {
        log.info('Scanning for old unused artifacts...');
        await this.removeOldArtifacts();

        log.info('Checking for updates...');
        await this.filterDownloadQueue();

        if (this.downloadQueue.length <= 0) {
            log.info(`App '${this.app.key}' is up-to-date.`);
        } else {
            log.info(`App '${this.app.key}' needs an update.`)
        }

        this.downloadReady = true;
    }

    public async startDownloading() {
        if (!this.downloadReady) throw new Error('Download is not yet ready');
        if (this.active) return;
        this.active = true;
        this.totalBytes = 0;

        await new Promise<void>(async (resolve, reject) => {
            this.rejectFunction = err => reject(err);

            const needsUpdate = !this.isUpToDate();
            if (needsUpdate) {
                log.info('Updates found. Downloading...');
    
                this.downloadQueue.forEach(artifact => this.totalBytes += Math.max(0, artifact.size));
                await this.downloadNextArtifact().catch(err => reject(err));
                log.info('Updates downloaded.')
            } else log.info('Everything is already up-to-date.');
    
            log.info('Finalizing...');
            this.enqueueFinalization();
            await this.completePostActions();
            log.info('Finalization complete.');
    
            if (needsUpdate) await this.writeTracker();
    
            await writeInputMap(this.app, this.inputMap);
            await this.writeStartup();
            await this.cleanUp();

            // ensure installation directory exists (for apps which have no files in their directory)
            await fs.promises.mkdir(this.installationDirectory).catch(() => undefined);

            if (this.installation.keepFiles) {
                for (const file of this.installation.keepFiles) {
                    await registerUninstallExceptionPath(this.app, Path.join(this.installationDirectory, file));
                }
            }

            resolve();
        });
    }

    protected async writeTracker() {
        const tracker = new (AppTracker.Writer.getConstructor())(this.app.id, this.getAppTrackerVars());
        await tracker.writeAppTracker();
    }

    protected async removeOldArtifacts() {
        const artifactDir = Path.resolve(getAppArtifactsDir(this.app));
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

            log.verbose(`Deleting old unused artifact '${artifactId}'...`);
            await reader.deleteEntries(reader, true);
            log.verbose(`Old Unused artifact '${artifactId}' deleted successfully.`);
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
                if (err.name === 'VersionError') log.error(err.message);
                else log.error(err);
                return true;
            })) {
                log.verbose(`Artifact '${artifact.id}' needs an update.`);
            } else {
                log.verbose(`Artifact '${artifact.id}' is up-to-date. Skipping it...`);

                const index = this.downloadQueue.indexOf(artifact);
                if (index >= 0) this.downloadQueue.splice(index, 1);
            }
        }));
    }

    protected async downloadNextArtifact() {
        if (this.downloadQueue.length <= 0) return;
        const artifact = this.downloadQueue[0];
        this.downloadQueue.splice(0, 1);

        // delete old artifact data, if it exists
        const reader = await createReader(this.app.id, artifact.id, this.getArtifactTrackerVars()).catch(() => undefined);
        if (reader) {
            log.verbose(`Deleting old artifact data of '${artifact.id}'...`);
            await reader.deleteFile();
        }

        log.verbose(`Resolving artifact '${artifact.id}'...`);

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
            },
            onProgress: (_progress, chunk) => {
                this.downloadedBytes += (chunk as Buffer).length;
                DOWNLOADER.updateInstallationProgress({
                    currentDownload: this.app,
                    queueSize: queueBatchLength,
                    currentQueuePosition: queueBatchPosition + 1, // include self
                    currentProgress: this.downloadedBytes / this.totalBytes
                });
            }
        });

        log.verbose(`Downloading '${url}'...`);
        this.currentDownloader = downloader;
        try {
            const trusted = isDomainTrusted(url);
            if (trusted) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
            await downloader.download();
            if (trusted) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } catch(err) {
            throw new Error(`Error downloading '${url}': ${err}`);
        }
        this.currentDownloader = undefined;
        log.verbose(`Downloaded '${url}'.`);

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

            const vars: {[key: string]: string} = {};
            if (downloadedPath) vars.result = downloadedPath;

            const subst = this.getSubstitution(vars); // mixin additional vars

            this.enqueuePostAction(firstAction, {
                artifact: artifact,
                result: downloadedPath,
                app: this.app,
                trackerVars: this.getArtifactTrackerVars(),
                dependencyAccessor: this.dependencyAccessor,
                inputMap: this.inputMap,
                substitution: subst
            });
        }

        // download next artifact
        await this.downloadNextArtifact();
    }

    protected enqueueFinalization() {
        this.installation.finalize?.forEach(action => {
            try {
                const handle = ActionFactory.createPostActionHandle(this, action);
                this.enqueuePostAction(handle, {
                    app: this.app,
                    result: this.installationDirectory,
                    inputMap: this.inputMap,
                    substitution: this.getSubstitution()
                });
            } catch(err) {
                this.failInstallation(err);
            }
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

        await action.handle.call(action.argument).catch(err => this.failInstallation(err)); // wait for the action to complete
        
        this.currentPostAction = null;
        this.actionWorkerActive = false;
        this.doNextPostAction(); // start next post action, but do not wait for it to finish, so the causing artifact gets finished. 
        // Note: To ensure the installation to wait for all actions to finish, the completePostActions() function is used.
    }

    protected completePostActions() {
        // called after downloads have finished
        return new Promise<void>((resolve, reject) => {
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
                this.doNextPostAction().catch(err => reject(err)); // start the post action worker, if it somehow died
            }
        });
    }

    protected failInstallation(err: any) {
        this.cancelInstallation();
        if (this.rejectFunction) this.rejectFunction(err);
    }

    protected cancelInstallation() {
        if (this.currentDownloader) this.currentDownloader.cancel();
        this.actionQueue = []; // clear post action queue
        this.currentPostAction = null;
        this.actionWorkerActive = false;
    }

    protected async cleanUp() {
        log.info('Cleaning up...')
        await rmdirRecursive(this.tmpDir);
        log.info('Cleaned up.');
    }

    protected async doesArtifactNeedUpdate(artifact: Artifact, trackerVars: ArtifactTrackerVariables): Promise<boolean> {
        const reader = await createReader(this.app.id, artifact.id, trackerVars).catch(() => undefined); // in case of an error, return undefined
        if (!reader) return true; // if there was an error, do the update, since up-to-date cannot be checked

        let needsUpdate = true;
        if (!artifact.md5) {
            log.warn('Artifact does not provide a MD5 checksum; cannot check if the artifact is already up-to-date. Artifact will be updated.');
        } else {
            needsUpdate = !await reader.isArtifactUpToDate(artifact);
        }

        if (needsUpdate) await reader.deleteEntries().catch(() => undefined);
        reader.closeFile();

        return needsUpdate;
    }

    public toActualPath(path: SegmentedPath) {
        const substPath = replaceArraySubstitutes(path, this.getSubstitution());
        return resolveSegmentedPath(this.installationDirectory, substPath);
    }

    protected async writeStartup() {
        log.info('Writing startup file...');
        const startupFile = getAppStartupFile(this.app);
        await mkdirp(Path.dirname(startupFile));

        const data = JSON.stringify(this.installation.startup);
        await fs.promises.writeFile(startupFile, data, 'utf8');
        log.info('Startup file written.');
    }

    public getSubstitution(mixinVariables?: SubstitutionVariables, mixinFunctions?: SubstitutionFunctions): Substitution {
        const dependencyAccessor = new Dependencies.DependencyAccessor(this.dependencyStructure, this.dependencyInfos)
        return {
            variables: {
                installDir: this.installationDirectory,
                installTmpDir: this.tmpDir,
                ...mixinVariables
            },
            functions: {
                dependency: param => {
                    if (!param.match(/^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9@.]+$/)) throw new Error(`Given dependency '${param}' does not match the required scheme (dependency/version).`)

                    const [id, version] = param.split('/');
                    const dependency = dependencyAccessor.getMandatoryDependency(id, version);
                    const info = dependencyAccessor.getMandatoryDependencyInfo(param);
                    const specificInfo = Dependencies.getInfoForOperatingSystem(info);
                    if (!specificInfo.index) throw new Error(`Dependency '${param}' has no defined index.`);
    
                    return resolveSegmentedPath(getDependencyDir(dependency), specificInfo.index);
                },
                input: param => {
                    if (!(param in this.inputMap)) throw new Error(`Input map does not contain '${param}'.`);
                    return this.inputMap[param];
                },
                ...mixinFunctions
            }
        };
    }
}