import App from "../../common/types/App";
import { InstalledApplication } from "../database/models/InstalledApplication";
import { ArtifactTrackerVariables } from "./tracker/ArtifactTracker";
import * as Path from 'path';
import * as fs from 'fs';
import { exists, getAppArtifactsDir, getAppTrackerFile, getAppUninstallerDir, rmdirRecusive } from "../utils/fshelper";
import { createReader } from "./tracker/ArtifactTrackers";
import { DOWNLOADER } from "../utils/ipc";
import { UninstallTrackers } from "./tracker/uninstall/UninstallTrackers";
import { UninstallTracker } from "./tracker/uninstall/UninstallTracker";
import { readInputMap } from "./inputs";

export async function uninstallApp(app: App) {
    const installedApp = await InstalledApplication.query().where('app_id', app.id).first();
    if (!installedApp) return;

    const installationDir = installedApp.path;

    // uninstall all artifacts
    const artifactTrackerDir = getAppArtifactsDir(app.id);
    if (await exists(artifactTrackerDir)) {
        const artifactTrackerVars: ArtifactTrackerVariables = {
            installationDir: installationDir,
            tmpDir: Path.join(installationDir, '.tmp')
        };

        const artifactFiles = await fs.promises.readdir(artifactTrackerDir);
        for (const file of artifactFiles) {
            const reader = await createReader(app.id, file, artifactTrackerVars).catch(() => undefined); // file is equal to artifact id; in case of an error, return undefined
            if (!reader) return; // if there was an error, do nothing
    
            console.log(`Deleting artifact '${file}'...`);
            await reader.deleteEntries(reader, true);
            console.log(`Artifact '${file}' deleted successfully.`);
        }

        /* 
            Artifact-tracker-directory should not be deleted, since some artifacts may persist, even after uninstallation.
            To speed up the re-installation, keep all the trackers.
        */
    }

    // uninstall additional content independant from artifacts
    const uninstallTrackerDir = getAppUninstallerDir(app.id);
    if (await exists(uninstallTrackerDir)) {
        const inputMap = await readInputMap(app);

        const uninstallTrackerVars = <UninstallTracker.Variables>{
            inputMap: inputMap
        };
        const uninstallFiles = await fs.promises.readdir(uninstallTrackerDir);

        for (const file of uninstallFiles) {
            const reader = await UninstallTrackers.createReader(file, app.id, uninstallTrackerVars); // file name is equal to uninstall id
            if (!reader) return; // error, do nothing
    
            await reader.readContent();
            await reader.uninstall();
            reader.closeFile();
        }

        await rmdirRecusive(uninstallTrackerDir).catch(err => console.error(err));
    }

    // remove installation directory (only if empty, so user-generated files can persist)
    if (await exists(installationDir)) {
        // check for remaining files
        const files = await fs.promises.readdir(installationDir).catch(err => {
            console.error(err);
            return undefined;
        });
        if (files !== undefined && files.length <= 0) await fs.promises.rmdir(installationDir);
    }

    // delete app info file
    const appInfoFile = getAppTrackerFile(app.id);
    if (await exists(appInfoFile)) await fs.promises.unlink(appInfoFile).catch(err => console.error(err));

    await InstalledApplication.query().where('app_id', app.id).delete(); // remove from database

    // TODO clean packages

    // update state
    DOWNLOADER.updateInstallationState('not-installed');
}