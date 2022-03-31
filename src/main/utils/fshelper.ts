import * as fs from 'fs';
import * as Path from 'path';
import * as os from 'os';
import rimraf from 'rimraf';
import App from '../../common/types/App';
import { app as electronApp } from 'electron';
import { SegmentedPath } from '../types/Installation';
import { DependencyDescriptor } from '../types/Dependency';

export function rmdirRecusive(directory: string) {
    return new Promise<void>((resolve, reject) => rimraf(directory, {}, error => {
        if (error) reject(error);
        else resolve();
    }));
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
    await mkdirp(Path.dirname(newPath));
    await fs.promises.rename(oldPath, newPath);
}

export async function mkdirp(dir: string) {
    if (dir === '.') return;
    await fs.promises.stat(dir).catch(async () => { // does not exist
        const parent = Path.dirname(dir);
        await mkdirp(parent);
        await fs.promises.mkdir(dir);
    });
}

export async function unlinkRemoveParentIfEmpty(file: string, root: string) {
    await fs.promises.unlink(file);

    // delete parents, if they are empty. Stops after the installation directory.
    const rootParent = Path.dirname(root);
    let parent = Path.dirname(file);

    while (parent.includes(rootParent)) {
        const files = await fs.promises.readdir(parent);
        if (files.length > 0) return;
    
        // delete empty parent
        await fs.promises.rmdir(parent)
        parent = Path.dirname(parent);
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
    if (typeof app === 'number') return Path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.toString());
    else return Path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.id.toString());
}

export function getAppStartupFile(app: App | number) {
    return Path.join(getInstallerAppDir(app), 'startup.json');
}

export function getAppInputMapFile(app: App | number) {
    return Path.join(getInstallerAppDir(app), 'input_map.json');
}

export function getAppUninstallPropsFile(app: App | number) {
    return Path.join(getInstallerAppDir(app), 'uninstall_properties.json');
}

export function getAppUninstallerDir(appId: number) {
    return Path.join(getInstallerAppDir(appId), 'uninstall');
}

export function getAppUninstallFile(appId: number, uninstallId: string) {
    return Path.join(getAppUninstallerDir(appId), uninstallId);
}

export function getAppArtifactsDir(appId: number) {
    return Path.join(getInstallerAppDir(appId), 'artifacts');
}

export function getAppArtifactFile(appId: number, artifactId: string) {
    return Path.join(getAppArtifactsDir(appId), artifactId);
}

export function getAppTrackerFile(appId: number) {
    return Path.resolve(getInstallerAppDir(appId), 'app');
}

export function resolveSegmentedPath(rootDir: string, path: SegmentedPath) {
    if (path.length <= 0) return Path.resolve(rootDir, ...path); // empty path is mapped to given rootDir

    const win32 = os.platform() === 'win32'

    // replace environment variables
    if (win32) { // replace %VAR% on windows systems
        path = path.map(segment => segment.replace(/%([^%]+)%/g, (match, n) => { // https://stackoverflow.com/a/21363956
            const env = process.env[n];
            return env ? env : match;
        }));
    } else { // replace $VAR and ${VAR} on unix systems
        path = path.map(segment => segment.replace(/\$([A-Z_]+[A-Z0-9_]*)|\${([A-Z0-9_]*)}/ig, (match, a, b) => { // https://stackoverflow.com/a/58173283
            const env = process.env[a || b];
            return env ? env : match;
        }));
    }

    if (path[0] === '/' // system root
        || (win32 && /^[a-zA-Z]:/.test(path[0])) // windows path with drive letter
    ) return Path.resolve(...path);
    if (path[0] === '~') return Path.resolve(os.homedir(), ...path.slice(1)); // home dir
    else return Path.resolve(rootDir, ...path); // default behaviour
}

export async function backupFile(file: string) {
    await fs.promises.copyFile(file, file + '.bak');
}

export function getDependencyDir(dependency: DependencyDescriptor) {
    return Path.resolve(electronApp.getPath('userData'), '.dependencies', dependency.id, dependency.version);
}

export function getDependencyTemporaryDir() {
    return Path.resolve(electronApp.getPath('userData'), '.dependencies', '.tmp');
}

export async function getOrCreateDefaultInstallationDir(app: App) {
    return Path.join(os.homedir(), 'LCLPLauncher', 'apps', app.key);
}