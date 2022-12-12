import * as os from 'os';
import * as fs from 'fs';
import execa from 'execa';

export const OS_WINDOWS = 'win32';
export const OS_LINUX = 'linux';

export abstract class AbstractOSHandler {
    public createSymlink(target: string, path: string, type?: string) {
        return fs.promises.symlink(target, path, type);
    }
}

export class WindowsOSHandler extends AbstractOSHandler {
    public async createSymlink(target: string, path: string) {
        // windows does not allow symlinks to be created unless you run as an admin
        if (await this.isRunningAsAdmin()) return fs.promises.symlink(target, path, 'file');
    }

    public async isRunningAsAdmin() {
        try {
            // https://stackoverflow.com/a/21295806/1641422
            if (!('systemdrive' in process.env)) return false;
            const systemdrive = <string> process.env.systemdrive;

            await execa('fsutil', ['dirty', 'query', systemdrive]);
            return true;
        } catch (error: any) {
            if (error && 'code' in error && error.code === 'ENOENT') {
                // https://stackoverflow.com/a/28268802
                try {
                    await execa('fltmc');
                    return true;
                } catch {
                    return false;
                }
            }
    
            return false;
        }
    }
}

export class LinuxOSHandler extends AbstractOSHandler {}

export let osHandler: AbstractOSHandler;

switch (os.platform()) {
    case OS_WINDOWS:
        osHandler = new WindowsOSHandler();
        break;
    case OS_LINUX:
        osHandler = new LinuxOSHandler();
        break;
    default:
        throw new Error(`Unsupported operating system: '${os.platform()}'`);
}

export type OSDependantFunction<Arg, Res> = {
    [platform: string]: (argument: Arg) => Res;
}

export type OSDependantSupplier<Res> = {
    [platform: string]: Res
};

export function chooseForPlatform<Res>(platformMap: OSDependantSupplier<Res>, defaultValue?: Res): Res {
    const currentPlatform = os.platform();
    if (!(currentPlatform in platformMap)) {
        if (defaultValue) return defaultValue;
        else throw new Error(`Platform map does not contain a mapping for platform '${currentPlatform}'`);
    }
    return platformMap[currentPlatform];
}

export function forPlatform<Arg, Res>(platformMap: OSDependantFunction<Arg, Res>): (argument: Arg) => Res {
    const currentPlatform = os.platform();
    if (!(currentPlatform in platformMap)) throw new Error(`Platform map does not contain a mapping for platform '${currentPlatform}'`);
    return platformMap[currentPlatform];
}

export async function doOnPlatformAsync(action: () => Promise<void>, ...platforms: string[]) {
    if (platforms.includes(os.platform())) await action();
}

export function isPlatform(platform: string) {
    return os.platform() === platform;
}

export function shouldUseGuiFrame() {
    return !isPlatform(OS_WINDOWS);
}