import * as childProcess from 'child_process';
import App from '../../common/types/App';
import { DOWNLOADER } from './ipc';

const runningApps = new Map<number, childProcess.ChildProcessWithoutNullStreams>();

export function isAppRunning(app: App) {
    return runningApps.has(app.id);
}

export function handleRunningProcess(app: App, process: childProcess.ChildProcessWithoutNullStreams) {
    runningApps.set(app.id, process);

    process.on('exit', () => {
        runningApps.delete(app.id);
        DOWNLOADER.updateInstallationState(); // cause update of app state
    });
}

export function getRunningProcess(app: App) {
    return runningApps.get(app.id);
}