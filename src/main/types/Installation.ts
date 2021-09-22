import InstallationInput from "../../common/types/InstallationInput";
import { DependencyDescriptor } from "./Dependency";

type Installation = {
    version: string,
    versionInt: number,
    launcherVersion: string,
    inputs?: InstallationInput[],
    dependencies?: DependencyDescriptor[],
    artifacts?: Artifact[],
    finalize?: PostAction[],
    startup: AppStartup
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
    /** Action to execute after the download is finished */
    post?: PostAction;
}

export type UrlResolverArgs = OptifineUrlResolverArgs;
export type AbstractUrlResolverArgs = {
    type: 'optifine'
}
export type OptifineUrlResolverArgs = AbstractUrlResolverArgs & {
    id: string
}

/* Post Actions */
export type PostAction = GeneralPostAction | ExtractZipPostAction | AddMCProfilePostAction | PrepareMCProfilePostAction | InstallMCForgePostAction;
export type GeneralPostAction = {
    type: 'extractZip' | 'addMinecraftProfile' | 'prepareMinecraftProfile' | 'installMinecraftForge' | 'executeProgram' | 'trackExistingFile'
    /** Action to execute after this action */
    post?: PostAction
}
export type ExtractZipPostAction = GeneralPostAction & {
    destination: SegmentedPath
}
export type ExecuteProgramPostAction = GeneralPostAction & {
    program: string,
    args?: string[],
    makeExecutable?: boolean
}
export type TrackExistingFilePostAction = GeneralPostAction & {
    path: SegmentedPath
}
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
export type PrepareMCProfilePostAction = GeneralPostAction & {
    /** The id of the profile */
    id: string
}
export type InstallMCForgePostAction = GeneralPostAction & {
    /** The version id of the minecraft profile */
    versionId: string
}

export type SegmentedPath = string[];

export type AppStartup = {
    launcherCompat: number,
    program: SegmentedPath | SegmentedPath[],
    args?: string[],
    before?: PostAction[]
};

export default Installation;