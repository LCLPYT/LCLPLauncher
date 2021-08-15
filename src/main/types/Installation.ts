type Installation = {
    version: string,
    versionInt: number,
    artifacts?: Artifact[],
    finalize?: PostAction[]
}

export type Artifact = {
    /** The identifier of the artifact, used to determine which artifacts need to be updated between versions */
    id: string;
    /** Url of the artifact to download */
    url: string;
    /** Size of the artifact in bytes; used to calculate the download progress */
    size: number;
    /** MD5 checksum of the downloaded file, if there is a mismatch, the installation will fail */
    md5?: string;
    /** The name, the downloaded file will get; If omitted, the file name from the response headers will be used */
    fileName?: string;
    /** Path segments for the destination directory; If omitted, file will remain in the .temp directory */
    destination?: SegmentedPath;
    /** Action to execute after the download is finished */
    post?: PostAction;
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
export type PostAction = ExtractZipPostAction | AddMCProfilePostAction;
export type AbstractPostAction = {
    type: 'extractZip' | 'addMinecraftProfile',
    /** Action to execute after this action */
    post?: PostAction
}
export type ExtractZipPostAction = AbstractPostAction & {
    destination: SegmentedPath
}
export type AddMCProfilePostAction = AbstractPostAction & {
    /** The name of the profile */
    name: string,
    /** An optional URL to the profile icon image */
    icon?: string,
    /** The path to the game directory; if omitted, the installation directory will be used */
    gameDir?: SegmentedPath,
    /** Arguments to be passed to the Java Runtime Environment */
    javaArgs?: string,
    /** The id of the Minecraft Version to use for the profile */
    lastVersionId: string,
    /** The directory of the JRE to use, e.g. '/usr/lib/jvm/java-8-openjdk-amd64/bin/java' */
    javaDir?: SegmentedPath
}

export type SegmentedPath = string[];

export default Installation;