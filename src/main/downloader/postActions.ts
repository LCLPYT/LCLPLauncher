import { Artifact, PostAction } from "../types/Installation";
import * as Path from 'path';
import * as fs from 'fs';
import { checksumFile } from "../utils/checksums";
import { rename } from "../utils/fshelper";
import { unzip } from "../utils/zip";
import { SingleFileTracker } from "./tracker/SingleFileTracker";
import { ExtractedArchiveTracker } from "./tracker/ExtractedArchiveTracker";
import { Installer } from "./downloader";
import { TrackerVariables, TrackerWriter } from "./tracker/ArtifactTracker";
import App from "../../common/types/App";

export type PostActionArgument = {
    artifact: Artifact;
    result: any;
    app: App;
    trackerVars: TrackerVariables;
    tracker?: TrackerWriter;
}

export class PostActionWrapper {
    public readonly handle: PostActionHandle;
    public readonly argument: PostActionArgument;

    constructor(handle: PostActionHandle, argument: PostActionArgument) {
        this.handle = handle;
        this.argument = argument;
    }
}

export class PostActionHandle {
    protected readonly action: (arg: PostActionArgument) => Promise<any>;
    protected child: PostActionHandle | null;
    public onCompleted?: () => void;

    /**
     * Construct a new handle.
     * @param action The action function. This function will receive the return result of it's parent's action in action.result (or their argument if nothing is returned).
     * @param child The action to be executed after this action.
     */
    constructor(action: (arg: PostActionArgument) => Promise<any>, child: PostActionHandle | null) {
        this.action = action;
        this.child = child;
    }

    public async call(arg: PostActionArgument): Promise<void> {
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
    public lastChild(): PostActionHandle {
        return this.child ? this.child.lastChild() : this;
    }

    /**
     * Enqueues an action to be run, after this action is done. 
     * If this action already has a successor, the new action will be executed between them.
     * @param action The action to execute after this action.
     */
    public doAfter(action: PostActionHandle) {
        const oldChild = this.child;
        if(oldChild) action.doLast(oldChild);
        this.child = action;
    }

    /**
     * Enqueues an action to be run, after this action chain is done.
     * @param action The action to execute at the end of this action chain.
     */
    public doLast(action: PostActionHandle) {
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
    
    export function createPostActionHandle(installer: Installer, action: PostAction): PostActionHandle {
        switch (action.type) {
            case 'extractZip':
                const child: PostActionHandle | null = action.post ? createPostActionHandle(installer, action.post) : null;
                const target = Path.resolve(installer.installationDirectory, ...action.destination);
                return new ExtractZipAction(target, child);
            default:
                throw new Error(`Unimplemented action: '${action.type}'`);
        }
    }

    export function createDefaultTrackerHandle() {
        return new PostActionHandle(async (arg) => {
            if (!arg.tracker) {
                const tracker = new SingleFileTracker.Writer(arg.artifact, arg.app, arg.trackerVars);
                arg.tracker = tracker;

                const file = arg.result;
                console.log('tracking', file, '...')
                tracker.trackSinglePath(file);

                return arg;
            }
            return arg;
        }, null);
    }

    class ValidateMD5Action extends PostActionHandle {
        constructor(child: PostActionHandle | null) {
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

    class MoveAction extends PostActionHandle {
        constructor(targetFile: string, child: PostActionHandle | null) {
            super(async ({result: file}) => {
                console.log(`Moving '${file}' to '${targetFile}'`);
                await rename(file, targetFile);
                console.log(`Moved '${file}' to '${targetFile}' successfully.`);
                return targetFile;
            }, child);
        }
    }

    class ExtractZipAction extends PostActionHandle {
        constructor(targetDirectory: string, child: PostActionHandle | null) {
            super(async (arg) => {
                const zipFile = arg.result;
                console.log(`Unzipping '${zipFile}'...`);

                const tracker = new ExtractedArchiveTracker.Writer(arg.artifact, arg.app, arg.trackerVars);
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
}