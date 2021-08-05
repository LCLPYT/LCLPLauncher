type Installation = {
    artifacts: Artifact[]
}

export type Artifact = {
    /** Url of the artifact to download */
    url: string,
    /** Size of the artifact in bytes; used to calculate the download progress */
    size: number,
    /** MD5 checksum of the downloaded file, if there is a mismatch, the installation will fail */
    md5?: string,
    /** The name, the downloaded file will get; If omitted, the file name from the response headers will be used */
    fileName?: string,
    /** If this condition is fulfilled, the artifact will not be downloaded. So this should check if an artifact is still valid when updating and thus makes updates quicker. */
    check?: CheckCondition[],
    /** Path segments for the destination directory; If omitted, file will remain in the .temp directory */
    destination?: Path,
    /** Action to execute after the download is finished */
    post?: PostAction
}

/* Check Conditions */
export type CheckCondition = ZipCheckCondition;
export type AbstractCheckCondition = {
    type: 'zip'
}
/**
 * This condition will be fulfilled, if all entries in a zip file have their valid extracted counter-parts.
 */
export type ZipCheckCondition = AbstractCheckCondition & {
    /** Root directory to which the zip was extracted */
    rootDir: string[]
}

/* Post Actions */
export type PostAction = ExtractZipPostAction;
export type AbstractPostAction = {
    type: 'extractZip',
    /** Action to execute after this action */
    post?: PostAction
}
export type ExtractZipPostAction = AbstractPostAction & {
    destination: Path
}

export type Path = string[];

export default Installation;