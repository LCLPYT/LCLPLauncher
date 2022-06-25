import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import rimraf from 'rimraf';
import type App from '../../common/types/App';
import type { SegmentedPath } from '../types/Installation';
import type { DependencyDescriptor } from '../types/Dependency';
import { app as electronApp } from 'electron';

export function rmdirRecursive(directory: string) {
    return new Promise<void>((resolve, reject) => rimraf(directory, {}, error => {
        if (error) reject(error);
        else resolve();
    }));
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
    await mkdirp(path.dirname(newPath));
    await fs.promises.rename(oldPath, newPath);
}

export async function mkdirp(dir: string) {
    if (dir === '.') return;

    await fs.promises.stat(dir).catch(async () => { // does not exist
        const parent = path.dirname(dir);
        await mkdirp(parent);
        await fs.promises.mkdir(dir);
    });
}

export async function unlinkRemoveParentIfEmpty(file: string, root: string) {
    await fs.promises.unlink(file);

    // delete parents, if they are empty. Stops after the installation directory.
    const rootParent = path.dirname(root);
    let parent = path.dirname(file);

    while (parent.includes(rootParent)) {
        const files = await fs.promises.readdir(parent);
        if (files.length > 0) return;

        // delete empty parent
        await fs.promises.rmdir(parent)
        parent = path.dirname(parent);
    }
}

export async function isDirectory(file: string): Promise<boolean> {
    return await fs.promises.stat(file)
        .then(stats => stats.isDirectory())
        .catch(() => false);
}

export async function exists(file: string): Promise<boolean> {
    return await fs.promises.stat(file).catch(() => undefined) !== undefined;
}

export function getInstallerAppDir(app: App | number) {
    if (typeof app === 'number') return path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.toString());
    else return path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.id.toString());
}

export function getAppStartupFile(app: App | number) {
    return path.join(getInstallerAppDir(app), 'startup.json');
}

export function getAppInputMapFile(app: App | number) {
    return path.join(getInstallerAppDir(app), 'input_map.json');
}

export function getAppUninstallPropsFile(app: App | number) {
    return path.join(getInstallerAppDir(app), 'uninstall_properties.json');
}

export function getAppUninstallerDir(appId: number) {
    return path.join(getInstallerAppDir(appId), 'uninstall');
}

export function getAppUninstallFile(appId: number, uninstallId: string) {
    return path.join(getAppUninstallerDir(appId), uninstallId);
}

export function getAppArtifactsDir(appId: number | App) {
    return path.join(getInstallerAppDir(appId), 'artifacts');
}

export function getAppArtifactFile(appId: number, artifactId: string) {
    return path.join(getAppArtifactsDir(appId), artifactId);
}

export function getAppTrackerFile(appId: number) {
    return path.resolve(getInstallerAppDir(appId), 'app');
}

export function resolveSegmentedPath(rootDir: string, segmentedPath: SegmentedPath) {
    if (segmentedPath.length <= 0) return path.resolve(rootDir, ...segmentedPath); // empty path is mapped to given rootDir

    const win32 = os.platform() === 'win32'

    // replace environment variables
    if (win32) {
        // replace %VAR% on windows systems
        // https://stackoverflow.com/a/21363956
        segmentedPath = segmentedPath.map(segment => segment.replace(/%([^%]+)%/g, (match, n) => {
            const env = process.env[n];
            return env ? env : match;
        }));
    } else {
        // replace $VAR and ${VAR} on unix systems
        // https://stackoverflow.com/a/58173283
        segmentedPath = segmentedPath.map(segment => segment.replace(/\$([A-Z_]+[A-Z\d_]*)|\${([A-Z\d_]*)}/ig, (match, a, b) => {
            const env = process.env[a || b];
            return env ? env : match;
        }));
    }

    if (segmentedPath[0] === '/' // system root
        || (win32 && /^[a-zA-Z]:/.test(segmentedPath[0])) // windows path with drive letter
    ) return path.resolve(...segmentedPath);
    if (segmentedPath[0] === '~') return path.resolve(os.homedir(), ...segmentedPath.slice(1)); // home dir
    else return path.resolve(rootDir, ...segmentedPath); // default behaviour
}

export async function backupFile(file: string) {
    await fs.promises.copyFile(file, file + '.bak');
}

export function getDependencyDir(dependency: DependencyDescriptor) {
    return path.resolve(electronApp.getPath('userData'), '.dependencies', dependency.id, dependency.version);
}

export function getDependencyTemporaryDir() {
    return path.resolve(electronApp.getPath('userData'), '.dependencies', '.tmp');
}

export async function getOrCreateDefaultInstallationDir(app: App) {
    return path.join(os.homedir(), 'LCLPLauncher', 'apps', app.key);
}