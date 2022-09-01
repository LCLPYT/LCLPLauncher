import * as fs from 'fs';
import * as Path from 'path';
import gunzip from 'gunzip-maybe';
import * as Tar from 'tar-stream';
import * as Stream from 'stream';
import { mkdirp } from '../io/fshelper';
import progress_stream from 'progress-stream';
import { ProgressCallback } from '../../types/Progress';
import { isDevelopment } from '../../../common/utils/env';
import { osHandler } from '../../utils/oshooks';

export function extractTar(tarFile: string, targetDirectory: string, progressListener?: ProgressCallback) {
    const getPath = (path: string) => Path.join(targetDirectory, path);

    return new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(tarFile);
        const extract = Tar.extract();

        let totallyTransferred = 0;

        extract.on('entry', (header, stream, next) => {
            const extractedPath = getPath(header.name);
            switch (header.type) {
                case 'file':
                    mkdirp(Path.dirname(extractedPath)).then(() => {
                        const progress = progressListener ? (progress: progress_stream.Progress) => {
                            totallyTransferred += progress.delta;
                            progressListener.onProgress({
                                totalBytes: progressListener.totalUncompressedSize,
                                transferredBytes: totallyTransferred,
                                speed: progress.speed
                            });
                        } : undefined;
                        extractZipEntry(stream, extractedPath, header.size, progress).then(() => next()).catch(err => reject(err));
                        // stream.resume(); // start reading from stream
                    }).catch(err => reject(err));
                    break;
                case 'directory':
                    mkdirp(extractedPath).then(() => next()).catch(err => reject(err));
                    break;
                case 'symlink':
                    if (!header.linkname) {
                        console.error('Error trying to extract symbolic link tar entry: Header has no linkname property');
                        next();
                        return;
                    }
                    const dir = Path.dirname(extractedPath);
                    const target = Path.resolve(dir, header.linkname);
                    mkdirp(dir).then(() => osHandler.createSymlink(target, extractedPath))
                        .then(() => next())
                        .catch(err => reject(err));
                    break;
                default:
                    if (isDevelopment) console.info(`Skipped tar entry of type '${header.type}': unimplemented`);
                    next();
                    break;
            }
        });

        extract.on('finish', () => resolve());

        readStream.pipe(gunzip(3)).pipe(extract);
    });
}

function extractZipEntry(stream: Stream.PassThrough, extractedPath: string, size: number | undefined, onProgress?: (progress: progress_stream.Progress) => void): Promise<void> {
    return new Promise((resolve) => {
        stream.on('end', () => resolve());

        const writeStream = fs.createWriteStream(extractedPath);

        if (onProgress) {
            // setup progress middleware stream
            const progressStream = progress_stream({
                length: size,
                time: 250
            });
            progressStream.on('progress', progress => onProgress(progress));
            stream.pipe(progressStream).pipe(writeStream);
        } else {
            stream.pipe(writeStream);
        }
    });
}