import App from "./App";

type Progress = {
    queueSize: number;
    currentQueuePosition: number;
    currentProgress: number,
}

type DownloadProgress = Progress & {
    currentDownload: App
}

export type PackageDownloadProgress = Progress & {
    packageName: string
}

export default DownloadProgress;