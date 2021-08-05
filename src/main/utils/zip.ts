import * as yauzl from 'yauzl';
import Path from 'path';
import fs from 'fs';
import progress_stream from 'progress-stream';

function mkdirp(dir: string): Promise<void> {
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

function getCombinedPath(rootDir: string, subDir: string) {
    return Path.join(rootDir, subDir);
}

function extractZipEntry(zip: yauzl.ZipFile, entry: yauzl.Entry, unzippedPath: string, onProgress?: (progress: progress_stream.Progress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        // open input stream from zip
        zip.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) {
                reject(err);
                return;
            }
            readStream.on('end', () => resolve()); // entry read process finished

            const writeStream = fs.createWriteStream(unzippedPath);

            if (onProgress) {
                // setup progress middleware stream
                const progressStream = progress_stream({
                    length: entry.uncompressedSize,
                    time: 250
                });
                progressStream.on('progress', progress => onProgress(progress));
                readStream.pipe(progressStream).pipe(writeStream);
            } else {
                readStream.pipe(writeStream);
            }
        });
    });
}

export function getTotalUncompressedSize(zipFile: string): Promise<number> {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        yauzl.open(zipFile, {
            lazyEntries: true
        }, (err, zip) => {
            if (err || !zip) {
                reject(err);
                return;
            }
            zip.readEntry();
            zip.on('entry', (entry: yauzl.Entry) => {
                if (!/\/$/.test(entry.fileName)) totalBytes += entry.uncompressedSize; // if entry is a file, add it
                zip.readEntry();
            });
            zip.once('end', () => {
                zip.close();
                resolve(totalBytes);
            })
        });
    })
}

type Progress = {
    transferredBytes: number;
    totalBytes: number;
    speed: number;
}

export function unzip(zipFile: string, destination: string, onProgress?: (progress: Progress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        if (onProgress) {
            getTotalUncompressedSize(zipFile)
                .then(totalUncompressedSize => unzipWithTotalSize(zipFile, destination, totalUncompressedSize, progress => onProgress(progress)))
                .then(() => resolve())
                .catch(err => reject(err));
        } else {
            unzipWithTotalSize(zipFile, destination)
                .then(() => resolve())
                .catch(err => reject(err));
        }
    });
}

function unzipWithTotalSize(zipFile: string, destination: string, totalUncompressedSize?: number, onProgress?: (progress: Progress) => void): Promise<void> {
    const path = (path: string) => getCombinedPath(destination, path);
    return new Promise((resolve, reject) => {
        yauzl.open(zipFile, {
            lazyEntries: true
        }, (err, zip) => {
            if (err || !zip) {
                reject(err);
                return;
            }
            let totallyTransferred = 0;
            zip.readEntry();
            zip.on('entry', (entry: yauzl.Entry) => {
                if (/\/$/.test(entry.fileName)) { // entry is a directory
                    mkdirp(path(entry.fileName))
                        .then(() => zip.readEntry())
                        .catch(err => reject(err));
                } else { // entry is a file
                    const unzippedPath = path(entry.fileName);
                    // ensure parent directory exists
                    mkdirp(Path.dirname(unzippedPath))
                        .then(() => {
                            if(totalUncompressedSize !== undefined && onProgress) {
                                extractZipEntry(zip, entry, unzippedPath, progress => {
                                    totallyTransferred += progress.delta;
                                    onProgress({
                                        totalBytes: totalUncompressedSize,
                                        transferredBytes: totallyTransferred,
                                        speed: progress.speed
                                    })
                                }).then(() => zip.readEntry()).catch(err => reject(err))
                            } else {
                                extractZipEntry(zip, entry, unzippedPath).then(() => zip.readEntry()).catch(err => reject(err))
                            }
                        }).catch(err => reject(err));
                }
            });
            zip.once('end', () => {
                zip.close();
                resolve();
            })
        });
    });
}