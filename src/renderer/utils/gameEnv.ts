import { exists } from "../../main/utils/fshelper";
import * as Path from 'path';

let cachedLauncherProfiles: string | undefined = undefined;

export async function getMinecraftLauncherProfiles(minecraftDir: string): Promise<string> {
    if (cachedLauncherProfiles) return cachedLauncherProfiles;

    console.debug('Searching for minecraft profile file...');

    const files = ['launcher_profiles_microsoft_store.json', 'launcher_profiles.json'];
    for (const fileName of files) {
        const file = Path.join(minecraftDir, fileName);
        console.debug(`Checking potential location '${file}'...`);
        if (await exists(file)) {
            console.debug(`Found installation file at '${file}'.`);
            cachedLauncherProfiles = file;
            return cachedLauncherProfiles;
        }
    }

    throw new Error('Could not find any existing launcher profiles file');
}