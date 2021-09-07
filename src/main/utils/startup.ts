import App from "../../common/types/App";
import * as fs from 'fs';
import { AppStartup, SegmentedPath } from "../types/Installation";
import { exists, getAppStartupFile, resolveSegmentedPath } from "./fshelper";
import { getInstallationDirectory } from "../downloader/installedApps";
import { doOnPlatformAsync } from "./oshooks";
import execa from "execa";
import * as childProcess from 'child_process';
import { getRunningProcess, handleRunningProcess } from "./runningApps";

const LAUNCHER_COMPAT = 0;

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

export function stopApp(app: App) {
    console.log(`Stopping '${app.title}'...`);

    const process = getRunningProcess(app);
    if (!process) throw new Error('App is not running or process handle got lost.');

    const stopped = process.kill('SIGINT');
    if (stopped) console.log(`Stopped '${app.title}'.`);
    else console.log(`Could not stop '${app.title}'.`);

    return stopped;
}

interface CompatHandler {
    startApp(app: App, startup: AppStartup): Promise<void>;
}

// only breaking changes should get their own compat level. If there is was a backwards-compatible change, modify the old handler
const compatHandlers = new Map<number, CompatHandler>([
    [0, {
        async startApp(app, appStartup) {
            const executable = await findExecutable(app, appStartup.program);
            if (!executable) throw new Error(`Could not find executable to start '${app.title}'.`);

            await makeFileExecutable(executable);
            runProgram(app, executable, appStartup.args);
        }
    }]
]);

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

async function findExecutable(app: App, programArg: SegmentedPath | SegmentedPath[]) {
    const installationDir = await getInstallationDirectory(app);
    if (!installationDir) throw new Error(`Could not find installation of '${app.title}'.`);

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