import * as yauzl from 'yauzl';
import Path from 'path';
import fs from 'fs';
import progress_stream from 'progress-stream';
import { mkdirp } from './fshelper';
import { ExtractedArchiveTracker } from '../downloader/tracker/ExtractedArchiveTracker';
import { Progress, ProgressCallback } from './progress';

export async function unzip(zipFile: string, destination: string, tracker?: ExtractedArchiveTracker.Writer, onProgress?: (progress: Progress) => void): Promise<void> {
    if (onProgress && tracker) {
        const totalUncompressedSize = await getTotalUncompressedSize(zipFile);
        await unzipWithTotalSize(zipFile, destination, tracker, {
            totalUncompressedSize: totalUncompressedSize,
            onProgress: progress => onProgress(progress)
        });
    } else {
        await unzipWithTotalSize(zipFile, destination, tracker);
    }
}

function unzipWithTotalSize(zipFile: string, destination: string, tracker?: ExtractedArchiveTracker.Writer, progressListener?: ProgressCallback): Promise<void> {
    const getPath = (path: string) => Path.join(destination, path);
    
    return new Promise((resolve, reject) => {
        yauzl.open(zipFile, {
            lazyEntries: true
        }, (err, zip) => {
            if (err || !zip) {
                reject(err);
                return;
            }
            
            let rejected = false;
            const onError = (err: any) => {
                rejected = true;
                zip.close();
                reject(err);
                return err;
            };
            
            let totallyTransferred = 0;
            zip.readEntry();
            zip.on('entry', (entry: yauzl.Entry) => {
                const unzippedPath = getPath(entry.fileName);
                
                if (/\/$/.test(entry.fileName)) { // entry is a directory
                    // create the directory if it does not yet exists, then continue
                    mkdirp(unzippedPath).then(async () => {
                        // track the created directory
                        if (tracker) {
                            await tracker.pushArchivePath(unzippedPath).catch(() => undefined);
                        }
                        
                        zip.readEntry();
                    }).catch(onError);
                    return;
                }
                
                // entry is a file
                // ensure parent directory exists
                mkdirp(Path.dirname(unzippedPath)).then(async () => {
                    // actually extract the entry
                    if (progressListener) {
                        if (await extractZipEntry(zip, entry, unzippedPath, progress => {
                            totallyTransferred += progress.delta;
                            progressListener.onProgress({
                                totalBytes: progressListener.totalUncompressedSize,
                                transferredBytes: totallyTransferred,
                                speed: progress.speed
                            });
                        }).catch(onError)) return;
                    } else {
                        if (await extractZipEntry(zip, entry, unzippedPath).catch(onError)) return;
                    }
                    
                    // track the extracted file
                    if (tracker) {
                        /* 
                            Don't care, if the tracker could not be written.
                            Sometimes the nodejs stream 'end' event is fired before the file is actually written to disk, this seems to be a bug.
                            This could leed to small files not being deleted when they are removed through an update (negligible)
                        */
                        await tracker.pushArchivePath(unzippedPath).catch(() => undefined);
                    }
                    
                    zip.readEntry(); // continue
                }).catch(onError);
            });
            zip.on('err', onError)
            zip.once('end', () => {
                zip.close();
                
                if (!rejected) resolve();
            });
        });
    });
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
            readStream.on('error', err => reject(err));
            
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

/**
* Calculate the sum of all entries' uncompressed size.
* @param zipFile The zip file.
* @returns The sum of all entries' uncompressed size, in bytes.
*/
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