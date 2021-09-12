type AppLatestInfo = {
    version: string;
    files: InstallerFile[]
    path: string;
    sha512: string;
    releaseDate: string
}

type InstallerFile = {
    url: string;
    sha512: string;
    size: number;
    blockMapSize: number
}

export default AppLatestInfo;