import { AddMCProfilePostAction, Artifact, ExtractZipPostAction, PostAction } from "../types/Installation";
import * as Path from 'path';
import * as fs from 'fs';
import { checksumFile } from "../utils/checksums";
import { backupFile, exists, getDependencyDir, rename } from "../utils/fshelper";
import { unzip } from "../utils/zip";
import { SingleFileTracker } from "./tracker/SingleFileTracker";
import { ExtractedArchiveTracker } from "./tracker/ExtractedArchiveTracker";
import { Installer } from "./downloader";
import { ArtifactTrackerVariables, TrackerWriter } from "./tracker/ArtifactTracker";
import App from "../../common/types/App";
import { chooseForPlatform, forPlatform, osHandler } from "../utils/oshooks";
import { parseProfilesFromJson, Profile } from "../types/MCLauncherProfiles";
import { getBase64DataURL } from "../utils/resources";
import { DepedencyAccessor } from "./dependencies";
import execa from "execa";
import { DummyTracker } from "./tracker/DummyTracker";

export type GeneralActionArgument = {
    app: App;
    result: any;
}

export type ArtifactActionArgument = GeneralActionArgument & {
    artifact: Artifact;
    trackerVars: ArtifactTrackerVariables;
    tracker?: TrackerWriter;
    dependencyAccessor: DepedencyAccessor;
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
        if(this.onCompleted) this.onCompleted();
        if(this.child) {
            if(result !== undefined) arg.result = result;
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
    
    export function createPostActionHandle(installer: Installer, action: PostAction): PostActionHandle<any> {
        switch (action.type) {
            case 'extractZip':
                const typedAction = <ExtractZipPostAction> <unknown> action;
                const child: PostActionHandle<any> | null = typedAction.post ? createPostActionHandle(installer, typedAction.post) : null;
                const target = Path.resolve(installer.installationDirectory, ...typedAction.destination);
                return new ExtractZipAction(target, child);
            case 'addMinecraftProfile':
                return new AddMCProfileAction(<AddMCProfilePostAction> <unknown> action, null);
            case 'installMinecraftForge':
                return new InstallMCForgeAction(null);
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

    class AddMCProfileAction extends PostActionHandle<GeneralActionArgument> {
        constructor(options: AddMCProfilePostAction, child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                console.log(`Adding launcher profile '${options.name}'...`);
                const profilesFile = Path.resolve(osHandler.getMinecraftDir(), 'launcher_profiles.json');
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

                const profile: Profile = {
                    created: now,
                    gameDir: arg.result,
                    icon: icon ? icon : 'Furnace',
                    lastUsed: now,
                    lastVersionId: options.lastVersionId,
                    name: options.name,
                    type: 'custom',
                    javaArgs: options.javaArgs
                    // TODO: on linux, add java dir
                };
                launcherProfiles.profiles[options.id] = profile;

                await backupFile(profilesFile);
                await fs.promises.writeFile(profilesFile, JSON.stringify(launcherProfiles, undefined, 2));

                console.log(`Launcher profile '${options.name}' added.`);
            }, child);
        }
    }

    class InstallMCForgeAction extends PostActionHandle<ArtifactActionArgument> {
        constructor(child: PostActionHandle<GeneralActionArgument> | null) {
            super(async (arg) => {
                const forgeInstallerDep = arg.dependencyAccessor.getMandatoryDependency('forge-installer');
                const javaDep = arg.dependencyAccessor.getMandatoryDependency('java');

                const forgeInstaller = Path.join(getDependencyDir(forgeInstallerDep), 'forge-installer.jar');
                if (!await exists(forgeInstaller)) throw new Error(`Cannot find forge installer at: '${forgeInstaller}'`);

                const javaDepDir = getDependencyDir(javaDep);
                const files = await fs.promises.readdir(javaDepDir);
                if (files.length !== 1) throw new Error(`There are more than one file inside of '${javaDepDir}'`);

                const javaExecutableName = chooseForPlatform({
                    'win32': 'java.exe',
                    'linux': 'java'
                });

                const javaExecutable = Path.join(javaDepDir, files[0], 'bin', javaExecutableName);
                if (!await exists(javaExecutable)) throw new Error(`Cannot find Java executable at: '${javaExecutable}'`);

                const classPath = forPlatform<string[], string>({
                    'win32': segments => segments.join(';'),
                    'linux': segements => segements.join(':')
                })([forgeInstaller, arg.result]);

                console.log('Installing Minecraft Forge...');
                const childProcess = execa(javaExecutable, ['-Xms1G', '-Xmx2G', '-cp', classPath, 'work.lclpnet.forgeinstaller.ForgeInstaller', 'none', '0']);
                if(childProcess.stdout) childProcess.stdout.pipe(process.stdout);

                await childProcess;
                console.log('Minecraft Forge installed successfully.');

                console.log(`Deleting '${arg.result}'...`);
                await fs.promises.unlink(arg.result);
                console.log(`Deleted '${arg.result}'`);

                arg.tracker = new DummyTracker.Writer();
                return arg;
            }, child);
        }
    }
}