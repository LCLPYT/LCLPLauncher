import InstallationInput from "../../common/types/InstallationInput";
import { DependencyDescriptor } from "./Dependency";

type Installation = {
    /** Semantic version number, e.g. 1.0.0 */
    version: string,
    /** Version integer. Bigger value = newer version. Can be used for easy version comparison. */
    versionInt: number,
    /** The minimum launcher version required to install this app */
    launcherVersion: string,
    /** List of inputs the user has to make before the installation starts. E.g. for additional directories etc. */
    inputs?: InstallationInput[],
    /** List of dependencies the app needs in order to install. */
    dependencies?: DependencyDescriptor[],
    /** List of artifacts to download as part of the installation process */
    artifacts?: Artifact[],
    /** Actions to perform at the end of the installation. */
    finalize?: PostAction[],
    /** Configuration for app launch */
    startup: AppStartup,
    /** List of files to keep in the installation directory, when uninstalling */
    keepFiles?: string[]
}

export type Artifact = {
    /** The identifier of the artifact, used to determine which artifacts need to be updated between versions */
    id: string;
    /** Url of the artifact to download */
    url: string | UrlResolverArgs;
    /** Size of the artifact in bytes; used to calculate the download progress */
    size: number;
    /** MD5 checksum of the downloaded file, if there is a mismatch, the installation will fail */
    md5?: string;
    /** The name, the downloaded file will get; If omitted, the file name from the response headers will be used */
    fileName?: string;
    /** Path segments for the destination directory; If omitted, file will remain in the .temp directory */
    destination?: SegmentedPath;
    /** Artifact options */
    options?: ArtifactOptions,
    /** Action to execute after the download is finished */
    post?: PostAction;
}

export type ArtifactOptions = {
    /** 
     * Indicates that this artifact contains user changeable content.
     * When the installation already contains the artifact, regardless of validity, it will only be updated, if variableBaseVersion indicates an older version.
     * Basically, increment this number when there was an important update to the artifact.
     * The old artifact's contents will be lost on update.
     */
    variableBaseVersion?: number
}


/* Url resolver */
/** 
 * Union type of all the url resolvers available
 * */
export type UrlResolverArgs = OptifineUrlResolverArgs | CurseForgeUrlResolverArgs;
/** 
 * Common type of all the url resolvers.
 */
export type AbstractUrlResolverArgs = {
    type: 'optifine' | 'curseforge'
}
/** 
 * Resolves a Minecraft Optifine download url.
 */
export type OptifineUrlResolverArgs = AbstractUrlResolverArgs & {
    /** Version of Optifine */
    id: string
}
/**
 * Resolves a download link from CurseForge.
 * Subject to regular changes, as the resolver does not use the CurseForge API.
 * Use other services, like Modrinth whenever possible.
 */
export type CurseForgeUrlResolverArgs = AbstractUrlResolverArgs & {
    /** Project id of the artifact */
    projectId: number,
    /** Slug of the artifact's project */
    projectSlug: string
    /** File id of the artifact */
    fileId: number,
}

/* Post Actions */
/** 
 * Union type of all the post actions available
 */
export type PostAction = GeneralPostAction | ExtractZipPostAction | AddMCProfilePostAction | PrepareMCProfilePostAction;
/**
 * Common type for all the post actions.
 */
export type GeneralPostAction = {
    type: 'extractZip' | 'addMinecraftProfile' | 'prepareMinecraftProfile' | 'executeProgram' | 'trackExistingFile'
    /** Action to execute after this action */
    post?: PostAction
}
/**
 * Extracts a zip file.
 */
export type ExtractZipPostAction = GeneralPostAction & {
    /** The directory to extract the zip file to. */
    destination: SegmentedPath
}
/**
 * Executes a program.
 */
export type ExecuteProgramPostAction = GeneralPostAction & {
    /** Executable file to execute */
    program: string,
    /** Program launch arguments */
    args?: string[],
    /** Whether to make the file executable (chmod +x) on unix-like systems. */
    makeExecutable?: boolean
}
/** 
 * Tracks an existing path as part of the installation.
 */
export type TrackExistingFilePostAction = GeneralPostAction & {
    /** The path of the file to track */
    path: SegmentedPath,
    /** Whether to skip deletion of the file at startup */
    skipUninstall?: boolean
}
/**
 * Adds a Microsoft Minecraft Launcher profile.
 */
export type AddMCProfilePostAction = GeneralPostAction & {
    /** The id of the profile */
    id: string,
    /** The name of the profile */
    name: string,
    /** An optional URL to the profile icon image */
    icon?: string,
    /** Arguments to be passed to the Java Runtime Environment */
    javaArgs?: string,
    /** The id of the Minecraft Version to use for the profile */
    lastVersionId: string,
    /** If true, the installer will ensure that the created profile will be the latest (and thereby the first to show to the user in the launcher) */
    ensureLatest?: boolean
}
/** 
 * Makes a Microsoft Minecraft Launcher profile the latest in terms of last played. 
 */
export type PrepareMCProfilePostAction = GeneralPostAction & {
    /** The id of the profile */
    id: string
}

/**
 * App Startup configuration.
 */
export type AppStartup = {
    /** Minimum launcher version required, to start the application. */
    launcherCompat: number,
    /** An executable file to run at startup. If an array is passed, the first executable to exist will be launched. */
    program: SegmentedPath | SegmentedPath[],
    /** Program arguments to start the executabe with. */
    args?: string[],
    /** Actions to perform before the executable is launched. */
    before?: PostAction[]
};

/** Path segments for universal path descriptors. 
 * E.g. ['home', 'user'] will be home/user on unix-like systems and home\user on Windows. 
 * By default, the path is treated as relative path.
 * To describe an absolute path, use '/' as first item on unix-like systems and 'drive:' (e.g. 'C:') on Windows.
 * The user home directory can be referenced with '~' across all operating systems.
 * Supports environment variable substitution like $VAR or ${VAR} on unix-like systems and %VAR% on Windows.
 */
export type SegmentedPath = string[];

export default Installation;