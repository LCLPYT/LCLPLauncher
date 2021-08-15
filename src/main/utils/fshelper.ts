import * as fs from 'fs';
import * as Path from 'path';
import rimraf from 'rimraf';
import App from '../../common/types/App';
import { app as electronApp } from 'electron';
import { SegmentedPath } from '../types/Installation';

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

export async function unlinkRemoveParentIfEmpty(file: string) {
    await fs.promises.unlink(file);
    const dir = Path.dirname(file);
    const files = await fs.promises.readdir(dir);
    if(files.length <= 0) await fs.promises.rmdir(dir)
}

export async function exists(file: string): Promise<boolean> {
    return await fs.promises.stat(file).catch(() => undefined) !== undefined;
}

export function getInstallerAppDir(app: App | number) {
    if(typeof app === 'number') return Path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.toString());
    else return Path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.id.toString());
}

export function getAppArtifactFile(appId: number, artifactId: string) {
    return Path.resolve(getInstallerAppDir(appId), 'artifacts', artifactId);
}

export function getAppTrackerFile(appId: number) {
    return Path.resolve(getInstallerAppDir(appId), 'app');
}

export function resolveSegmentedPath(rootDir: string, path: SegmentedPath) {
    return Path.resolve(rootDir, ...path);
}

export async function backupFile(file: string) {
    await fs.promises.copyFile(file, file + '.bak');
}