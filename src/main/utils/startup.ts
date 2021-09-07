import App from "../../common/types/App";
import * as fs from 'fs';
import { AppStartup, PostAction, SegmentedPath } from "../types/Installation";
import { exists, getAppStartupFile, resolveSegmentedPath } from "./fshelper";
import { getInstallationDirectory } from "../downloader/installedApps";
import { doOnPlatformAsync } from "./oshooks";
import execa from "execa";
import * as childProcess from 'child_process';
import { getRunningProcess, handleRunningProcess } from "./runningApps";
import { ActionFactory, GeneralActionArgument, PostActionHandle, PostActionWrapper } from "../downloader/postActions";

const LAUNCHER_COMPAT = 0;

export function stopApp(app: App) {
    console.log(`Stopping '${app.title}'...`);

    const process = getRunningProcess(app);
    if (!process) throw new Error('App is not running or process handle got lost.');

    const stopped = process.kill('SIGINT');
    if (stopped) console.log(`Stopped '${app.title}'.`);
    else console.log(`Could not stop '${app.title}'.`);

    return stopped;
}

async function readAppStartup(app: App): Promise<AppStartup> {
    const file = getAppStartupFile(app);
    if (!await exists(file)) throw new Error(`Startup file for app '${app.key}'' does not exist.`);

    const content = await fs.promises.readFile(file, 'utf8');
    return JSON.parse(content);
}

export async function startApp(app: App) {
    console.log(`Starting '${app.title}'...`);
    const appStartup = await readAppStartup(app);
    if (LAUNCHER_COMPAT < appStartup.launcherCompat) throw new Error(`Your launcher is to outdated to start '${app.title}'. Please update.`);

    // launcher compat should be backwards-compatible for the most part
    const handler = compatHandlers.get(appStartup.launcherCompat);
    if (!handler) throw new Error(`The installed version of '${app.title}' is too old and no longer supported by LCLPLauncher. Please update the app or consult our developers.`);

    await handler.startApp(app, appStartup);
    console.log(`Started '${app.title}'.`);
}

interface CompatHandler {
    startApp(app: App, startup: AppStartup): Promise<void>;
}

// only breaking changes should get their own compat level. If there is was a backwards-compatible change, modify the old handler
const compatHandlers = new Map<number, CompatHandler>([
    [0, {
        async startApp(app, appStartup) {
            const installationDir = await getInstallationDirectory(app);
            if (!installationDir) throw new Error(`Could not find installation of '${app.title}'.`);

            const executable = await findExecutable(installationDir, appStartup.program);
            if (!executable) throw new Error(`Could not find executable to start '${app.title}'.`);

            // execute pre actions
            if (appStartup.before) {
                const executor = new PreActionExecutor(installationDir, app);
                appStartup.before.forEach(action => executor.enqueueAction(action));
                await executor.execute();
            }

            await makeFileExecutable(executable);
            runProgram(app, executable, appStartup.args);
        }
    }]
]);

class PreActionExecutor {
    public readonly installationDirectory: string;
    public readonly app: App;
    protected actionQueue: PostActionWrapper<any>[] = [];
    protected actionWorkerActive = false;
    protected currentPostAction: PostActionHandle<any> | null = null;

    constructor(installationDirectory: string, app: App) {
        this.installationDirectory = installationDirectory;
        this.app = app;
    }

    public enqueueAction(action: PostAction) {
        const handle = ActionFactory.createPostActionHandle(this, action);
        this.enqueuePostAction(handle, {
            app: this.app,
            result: this.installationDirectory
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

    public async execute() {
        await this.completePostActions();
    }
}

async function makeFileExecutable(executable: string) {
    await doOnPlatformAsync(async () => {
        const childProcess = execa('chmod', ['+x', executable]);
        childProcess.stdout?.pipe(process.stdout);
        await childProcess;
    }, 'linux');
}

function runProgram(app: App, executable: string, args?: string[]) {
    console.log(`Executing '${executable}'...`);

    const process = childProcess.spawn(executable, args ? args : [], {
        detached: true
    });

    handleRunningProcess(app, process);
}

async function findExecutable(installationDir: string, programArg: SegmentedPath | SegmentedPath[]) {
    const getExecutablePath: (path: SegmentedPath) => Promise<string | undefined> = async (path) => {
        const resolvedPath = resolveSegmentedPath(installationDir, path);
        if (await exists(resolvedPath)) return resolvedPath;
        else return undefined;
    };

    if (isSegmentedPath(programArg)) return await getExecutablePath(programArg);
    else for (const path of programArg) {
        const execPath = getExecutablePath(path);
        if (execPath) return execPath;
    }

    return undefined;
}

function isSegmentedPath(programArg: SegmentedPath | SegmentedPath[]): programArg is SegmentedPath {
    return programArg.length > 0 && !Array.isArray(programArg[0]);
}