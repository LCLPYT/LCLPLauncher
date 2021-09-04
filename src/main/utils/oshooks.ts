import * as os from 'os';
import * as fs from 'fs';
import * as Path from 'path';
import execa from 'execa';

export abstract class AbstractOSHandler {
    public createSymlink(target: string, path: string, type?: string) {
        return fs.promises.symlink(target, path, type);
    }

    public abstract getMinecraftDir(): string;
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

    public getMinecraftDir() {
        const appData = process.env.APPDATA ? process.env.APPDATA : Path.resolve(os.homedir(), 'AppData', 'Roaming');
        return Path.resolve(appData, '.minecraft');
    }
}

export class LinuxOSHandler extends AbstractOSHandler {
    public getMinecraftDir() {
        // MACOSX: Path.resolve(os.homedir(), 'Library', 'Application Support', 'minecraft');
        return Path.resolve(os.homedir(), '.minecraft');
    }
}

export let osHandler: AbstractOSHandler;

switch (os.platform()) {
    case 'win32':
        osHandler = new WindowsOSHandler();
        break;
    case 'linux':
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

export function chooseForPlatform<Res>(platformMap: OSDependantSupplier<Res>): Res {
    const currentPlatform = os.platform();
    if (!(currentPlatform in platformMap)) throw new Error(`Platform map does not contain a mapping for platform '${currentPlatform}'`);
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