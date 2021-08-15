import * as os from 'os';
import * as Path from 'path';

export abstract class AbstractOSHandler {
    public abstract getMinecraftDir(): string;
}

export class WindowsOSHandler extends AbstractOSHandler {
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