import * as fs from 'fs';
import * as Path from 'path';
import rimraf from 'rimraf';

export function unlink(file: string): Promise<void> {
    return new Promise((resolve, reject) => fs.unlink(file, error => {
        if (error) reject(error);
        resolve();
    }));
}

export function rmdirRecusive(directory: string): Promise<void> {
    return new Promise((resolve, reject) => rimraf(directory, {}, error => {
        if (error) reject(error);
        else resolve();
    }));
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
    await mkdirp(Path.dirname(newPath));
    return await new Promise<void>((resolve, reject) => fs.rename(oldPath, newPath, error => {
        if (error) reject(error);
        else resolve();
    }));
}

export function mkdirp(dir: string): Promise<void> {
    return new Promise(resolve => {
        if (dir === '.') {
            resolve();
            return;
        }
        fs.stat(dir, err => {
            if (err === null) resolve(); // directory already exists
            else {
                const parent = Path.dirname(dir);
                mkdirp(parent)
                    .then(() => fs.mkdir(dir, () => resolve()));
            }
        });
    });
}