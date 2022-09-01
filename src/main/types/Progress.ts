export type ProgressCallback = {
    totalUncompressedSize: number;
    onProgress: (progress: Progress) => void;
}

export type Progress = {
    transferredBytes: number;
    totalBytes: number;
    speed: number;
}