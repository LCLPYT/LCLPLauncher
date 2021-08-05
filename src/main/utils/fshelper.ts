import * as fs from 'fs';
import rimraf from 'rimraf';

export function unlink(file: string): Promise<void> {
    return new Promise(resolve => fs.unlink(file, () => resolve()));
}

export function rmdirRecusive(directory: string): Promise<void> {
    return new Promise((resolve, reject) => rimraf(directory, {}, error => {
        if(error) reject(error);
        else resolve();
    }))
}