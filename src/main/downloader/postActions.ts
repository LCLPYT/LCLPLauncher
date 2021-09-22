import { AddMCProfilePostAction, Artifact, ExecuteProgramPostAction, ExtractZipPostAction, PostAction, PrepareMCProfilePostAction, SegmentedPath, TrackExistingFilePostAction } from "../types/Installation";
import * as Path from 'path';
import * as fs from 'fs';
import { checksumFile } from "../utils/checksums";
import { backupFile, exists, rename, resolveSegmentedPath } from "../utils/fshelper";
import { unzip } from "../utils/zip";
import { SingleFileTracker } from "./tracker/SingleFileTracker";
import { ExtractedArchiveTracker } from "./tracker/ExtractedArchiveTracker";
import { ArtifactTrackerVariables, TrackerWriter } from "./tracker/ArtifactTracker";
import App from "../../common/types/App";
import { isPlatform } from "../utils/oshooks";
import { parseProfilesFromJson, Profile } from "../types/MCLauncherProfiles";
import { getBase64DataURL } from "../utils/resources";
import execa from "execa";
import { ExistingFileTracker } from "./tracker/ExistingFileTracker";
import { UninstallMCProfile } from "./tracker/uninstall/UninstallMCProfile";
import { UninstallTracker } from "./tracker/uninstall/UninstallTracker";
import { Dependencies } from "./dependencies";
import { InputMap } from "../../common/types/InstallationInputResult";
import { isDevelopment } from "../../common/utils/env";
import { getAppImagePath } from "../utils/env";
import { replaceArraySubstitutes, replaceSubstitutes, Substitution, SubstitutionFunctions, SubstitutionVariables } from "../utils/substitute";

export type GeneralActionArgument = {
    app: App;
    result: any;
    inputMap?: InputMap,
    substitution?: Substitution
}

export type ArtifactActionArgument = GeneralActionArgument & {
    artifact: Artifact;
    trackerVars: ArtifactTrackerVariables;
    tracker?: TrackerWriter;
    dependencyAccessor: Dependencies.DependencyAccessor;
}

export class PostActionWrapper<T extends GeneralActionArgument> {
    public readonly handle: PostActionHandle<T>;
    public readonly argument: T;

    constructor(handle: PostActionHandle<T>, argument: T) {
        this.handle = handle;
        this.argument = argument;
    }
}

export class PostActionHandle<T extends GeneralActionArgument> {
    protected readonly action: (arg: T) => Promise<any>;
    protected child: PostActionHandle<T> | null;
    public onCompleted?: () => void;

    /**
     * Construct a new handle.
     * @param action The action function. This function will receive the return result of it's parent's action in action.result (or their argument if nothing is returned).
     * @param child The action to be executed after this action.
     */
    constructor(action: (arg: T) => Promise<any>, child: PostActionHandle<T> | null) {
        this.action = action;
        this.child = child;
    }

    public async call(arg: T): Promise<void> {
        const result = await this.action(arg);
        if (this.onCompleted) this.onCompleted();
        if (this.child) {
            if (result !== undefined) {
                arg.result = result;

                // update substitution 'result' variable
                if (typeof result === 'string' && arg.substitution?.variables?.result) 
                    arg.substitution.variables.result = result;
            }
            await this.child.call(arg);
        }
    }

    /**
     * @returns The last action in this action chain.
     */
    public lastChild(): PostActionHandle<T> {
        return this.child ? this.child.lastChild() : this;
    }

    /**
     * Enqueues an action to be run, after this action is done. 
     * If this action already has a successor, the new action will be executed between them.
     * @param action The action to execute after this action.
     */
    public doAfter(action: PostActionHandle<T>) {
        const oldChild = this.child;
        if(oldChild) action.doLast(oldChild);
        this.child = action;
    }

    /**
     * Enqueues an action to be run, after this action chain is done.
     * @param action The action to execute at the end of this action chain.
     */
    public doLast(action: PostActionHandle<T>) {
        this.lastChild().child = action; // safe, because the last action has no child
    }
}

export namespace ActionFactory {
    export function createMD5ActionHandle() {
        return new ValidateMD5Action(null);
    }
    
    export function createMoveActionHandle(targetFile: string) {
        return new MoveAction(targetFile, null);
    }

    export type InstallerProto = {
        installationDirectory: string,
        getSubstitution(mixinVariables?: SubstitutionVariables, mixinFunctions?: SubstitutionFunctions): Substitution
    }
    
    export function createPostActionHandle(installer: InstallerProto, action: PostAction): PostActionHandle<any> {
        const child: PostActionHandle<any> | null = action.post ? createPostActionHandle(installer, action.post) : null;
        switch (action.type) {
            case 'extractZip':
                const extractZipAction = <ExtractZipPostAction> <unknown> action;
                const substPath = replaceArraySubstitutes(extractZipAction.destination, installer.getSubstitution())
                const target = resolveSegmentedPath(installer.installationDirectory, substPath);
                return new ExtractZipAction(target, child);
            case 'addMinecraftProfile':
                return new AddMCProfileAction(<AddMCProfilePostAction> <unknown> action, child);
            case 'prepareMinecraftProfile':
                return new PrepareMCProfileAction(<PrepareMCProfilePostAction> <unknown> action, child);
            case 'executeProgram':
                return new ExecuteProgramAction(<ExecuteProgramPostAction> action, child);
            case 'trackExistingFile':
                return new TrackExistingFileAction((<TrackExistingFilePostAction> action).path, installer.installationDirectory, child);
            default:
                throw new Error(`Unimplemented action: '${action.type}'`);
        }
    }

    export function createDefaultTrackerHandle() {
        return new PostActionHandle<ArtifactActionArgument>(async (arg) => {
            if (!arg.tracker) {
                const tracker = new (SingleFileTracker.Writer.getConstructor())(arg.artifact.id, arg.app.id, arg.trackerVars);
                arg.tracker = tracker;

                const file = arg.result;
                tracker.trackSinglePath(file);

                return arg;
            }
            return arg;
        }, null);
    }

    class ValidateMD5Action extends PostActionHandle<ArtifactActionArgument> {
        constructor(child: PostActionHandle<GeneralActionArgument> | null) {
            super(async ({result: file, artifact: { md5 }}) => {
                if(!md5) return;
                console.log(`Checking integrity of '${file}'...`);
                const calculatedMd5 = await checksumFile(file, 'md5');
                if(calculatedMd5 !== md5) {
                    await fs.promises.unlink(file);
                    throw new Error(`Checksum mismatch '${file}'. File was deleted.`);
                }
                console.log(`Integrity valid: '${file}'`);
            }, child);
        }
    }

    class MoveAction extends PostActionHandle<GeneralActionArgument> {
        constructor(targetFile: string, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async ({result: file}) => {
                console.log(`Moving '${file}' to '${targetFile}'`);
                await rename(file, targetFile);
                console.log(`Moved '${file}' to '${targetFile}' successfully.`);
                return targetFile;
            }, child);
        }
    }

    class ExtractZipAction extends PostActionHandle<ArtifactActionArgument> {
        constructor(targetDirectory: string, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                const zipFile = arg.result;
                console.log(`Unzipping '${zipFile}'...`);

                const tracker = new (ExtractedArchiveTracker.Writer.getConstructor())(arg.artifact.id, arg.app.id, arg.trackerVars);
                arg.tracker = tracker;
                await tracker.beginExtractedArchive(zipFile, targetDirectory);
                // await unzip(zipFile, targetDirectory, progress => console.log(`${((progress.transferredBytes / progress.totalBytes) * 100).toFixed(2)}% - ${progress.transferredBytes} / ${progress.totalBytes}`));
                await unzip(zipFile, targetDirectory, tracker);
                tracker.finishExtractedArchive();
                console.log(`Unzipped '${zipFile}'. Deleting it...`);
                await fs.promises.unlink(zipFile);
                console.log(`Deleted '${zipFile}'.`);

                return arg;
            }, child)
        }
    }

    class ExecuteProgramAction extends PostActionHandle<ArtifactActionArgument> {
        constructor(action: ExecuteProgramPostAction, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                const subst = arg.substitution ? arg.substitution : {};
                const program = replaceSubstitutes(action.program, subst);
                const args = action.args ? replaceArraySubstitutes(action.args, subst) : [];

                if (action.makeExecutable && isPlatform('linux') && await exists(program)) {
                    // program is a file, make it executable
                    console.log(`Making '${program}' executable...`);
                    const childProcess = execa('chmod', ['+x', program]);
                    childProcess.stdout?.pipe(process.stdout);
                    childProcess.stderr?.pipe(process.stderr);
    
                    await childProcess;
                    console.log(`Made '${program}' executable.`);
                }

                console.log(`Executing program: "${program} ${args.join(' ')}"`);

                const childProcess = execa(program, args);
                childProcess.stdout?.pipe(process.stdout);
                childProcess.stderr?.pipe(process.stderr);

                await childProcess;
                console.log(`Program exitted with code ${childProcess.exitCode}.`);
            }, child);
        }
    }

    class TrackExistingFileAction extends PostActionHandle<ArtifactActionArgument> {
        constructor(relPath: SegmentedPath, rootDir: string, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                const subst = arg.substitution ? arg.substitution : {};
                const substPath = replaceArraySubstitutes(relPath, subst);
                const file = resolveSegmentedPath(rootDir, substPath);
                if (!await exists(file)) throw new Error(`Can't track non-existent file '${file}'`);

                console.log(`Tracking existing file '${file}'...`);

                const tracker = new (ExistingFileTracker.Writer.getConstructor())(arg.artifact.id, arg.app.id, arg.trackerVars)
                await tracker.trackSinglePath(file);
                arg.tracker = tracker;

                console.log(`Successfully tracked '${file}'.`)

                return arg;
            }, child);
        }
    }

    class AddMCProfileAction extends PostActionHandle<GeneralActionArgument> {
        constructor(options: AddMCProfilePostAction, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                console.log(`Adding launcher profile '${options.name}'...`);

                if (!arg.inputMap) throw new Error('Input map is undefined');
                const minecraftDir = arg.inputMap['minecraftDir']; // universal minecraftDir identifier. Apps using it should always name it this way
                if (!minecraftDir) throw new Error(`Input map does not contain an entry for 'minecraftDir'.`);

                const profilesFile = Path.resolve(minecraftDir, 'launcher_profiles.json');
                if (!exists(profilesFile)) throw new Error('Profiles file does not exist');

                const jsonContent = await fs.promises.readFile(profilesFile, 'utf8');
                const launcherProfiles = parseProfilesFromJson(jsonContent);

                let icon: string | undefined;
                if(options.icon) icon = await getBase64DataURL(options.icon).catch(() => undefined);

                const now = new Date();
                const diff = 1000 * 60;
                const beforeNow = new Date(now.getTime() - diff);

                if (options.ensureLatest) {
                    console.log('Ensuring that the newly created profile will be the most recent...');
                    Object.entries(launcherProfiles.profiles).forEach(([_id, profile]) => {
                        if (!profile.lastUsed || profile.lastUsed.getTime() > beforeNow.getTime()) profile.lastUsed = beforeNow;
                    });
                }

                let javaArgs = options.javaArgs;
                if (!isDevelopment) {
                    const appImagePath = getAppImagePath();
                    const properties = Object.entries({
                        'lclplauncher.program': appImagePath ? appImagePath : process.execPath
                    }).map(([key, value]) => `-D${key}=${value}`);
                    const joined = properties.join(' ');
                    javaArgs = javaArgs ? javaArgs.trim().concat(' ').concat(joined) : joined;
                }

                const profile: Profile = {
                    created: now,
                    gameDir: arg.result,
                    icon: icon ? icon : 'Furnace',
                    lastUsed: now,
                    lastVersionId: options.lastVersionId,
                    name: options.name,
                    type: 'custom',
                    javaArgs: javaArgs
                    // TODO: on linux, add java dir
                };
                launcherProfiles.profiles[options.id] = profile;

                await backupFile(profilesFile);
                await fs.promises.writeFile(profilesFile, JSON.stringify(launcherProfiles, undefined, 2));

                // write an uninstall tracker
                await UninstallTracker.writeUninstallTracker(new (UninstallMCProfile.Writer.getConstructor())(options.id, arg.app.id, {}));

                console.log(`Launcher profile '${options.name}' added.`);
            }, child);
        }
    }

    class PrepareMCProfileAction extends PostActionHandle<GeneralActionArgument> {
        constructor(options: PrepareMCProfilePostAction, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                console.log(`Preparing launcher profile '${options.id}'...`);

                if (!arg.inputMap) throw new Error('Input map is undefined');
                const minecraftDir = arg.inputMap['minecraftDir']; // universal minecraftDir identifier. Apps using it should always name it this way
                if (!minecraftDir) throw new Error(`Input map does not contain an entry for 'minecraftDir'.`);

                const profilesFile = Path.resolve(minecraftDir, 'launcher_profiles.json');
                if (!exists(profilesFile)) throw new Error('Profiles file does not exist');

                const jsonContent = await fs.promises.readFile(profilesFile, 'utf8');
                const launcherProfiles = parseProfilesFromJson(jsonContent);
    
                if (!(options.id in launcherProfiles.profiles)) return; // profile does not exist

                const now = new Date();
                const diff = 1000 * 60;
                const beforeNow = new Date(now.getTime() - diff);

                Object.entries(launcherProfiles.profiles).forEach(([_id, profile]) => {
                    if (!profile.lastUsed || profile.lastUsed.getTime() > beforeNow.getTime()) profile.lastUsed = beforeNow;
                });

                const profile = launcherProfiles.profiles[options.id];
                profile.lastUsed = now;
    
                await backupFile(profilesFile);
                await fs.promises.writeFile(profilesFile, JSON.stringify(launcherProfiles, undefined, 2));
    
                console.log(`Launcher profile '${options.id}' was successfully prepared.`);
            }, child);
        }
    }
}