import { withBufferReadMethods, withBufferWriteMethods } from "../../../utils/buffer";
import { UninstallTracker } from "./UninstallTracker";
import * as Path from 'path';
import * as fs from 'fs';
import { parseProfilesFromJson } from "../../../types/MCLauncherProfiles";
import { backupFile, exists } from "../../../utils/fshelper";

export namespace UninstallMCProfile {
    export class Writer extends UninstallTracker.Writer {
        protected readonly profileId: string;

        constructor(profileId: string, appId: number, vars: UninstallTracker.Variables) {
            super(`mcprofile_${profileId}`, appId, vars, UninstallTracker.Type.REMOVE_MC_PROFILE);
            this.profileId = profileId;
        }

        public static getConstructor() {
            return withBufferWriteMethods(Writer);
        }

        protected async writeSpecific() {
            this.writeString(this.profileId);
        }
    }

    export class Reader extends UninstallTracker.Reader {
        protected loaded = false;
        protected profileId?: string;

        public static getConstructor() {
            return withBufferReadMethods(Reader);
        }

        public async readContent() {
            if (this.loaded) throw new Error('Already loaded');
            this.profileId = this.readString();
            this.loaded = true;
        }

        public async uninstall() {
            if (!this.loaded || !this.profileId) throw new Error('Not loaded');

            console.log(`Removing launcher profile '${this.profileId}'...`);

            if (!this.vars.inputMap) throw new Error('Input map is undefined');
            const minecraftDir = this.vars.inputMap['minecraftDir']; // universal minecraftDir identifier. Apps using it should always name it this way
            if (!minecraftDir) return; // do not insist to get minecraft dir, because a previous version could have corruped the input map. Uninstallation should always be possible

            const profilesFile = Path.resolve(minecraftDir, 'launcher_profiles.json');
            if (!exists(profilesFile)) return; // profiles files does not exist
            const jsonContent = await fs.promises.readFile(profilesFile, 'utf8');
            const launcherProfiles = parseProfilesFromJson(jsonContent);

            if (!(this.profileId in launcherProfiles.profiles)) return; // profile does not exist

            delete launcherProfiles.profiles[this.profileId];

            await backupFile(profilesFile);
            await fs.promises.writeFile(profilesFile, JSON.stringify(launcherProfiles, undefined, 2));

            console.log(`Launcher profile '${this.profileId}' was successfully removed.`);
        }
    }
}