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

export function getInstallerAppDir(app: App) {
    return Path.resolve(electronApp.getPath('userData'), '.installer', 'apps', app.id.toString());
}

export function resolveSegmentedPath(rootDir: string, path: SegmentedPath) {
    return Path.resolve(rootDir, ...path);
}