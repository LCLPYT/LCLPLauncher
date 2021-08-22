import App from "./App";

type DownloadProgress = {
    queueSize: number;
    currentQueuePosition: number;
    currentDownload: App,
    currentProgress: number,
}

export default DownloadProgress;