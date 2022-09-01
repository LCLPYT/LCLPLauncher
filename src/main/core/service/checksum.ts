import * as crypto from 'crypto';
import * as fs from 'fs';

type ChecksumAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

export function checksumFile(file: string, algorithm: ChecksumAlgorithm): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        const input = fs.createReadStream(file);

        input.on('error', err => reject(err));
        hash.once('readable', () => resolve(hash.digest('hex')));

        input.pipe(hash);
    });
}