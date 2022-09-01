import App from "../../common/types/App";
import { InstalledApplication } from "../database/models/InstalledApplication";
import { ArtifactTrackerVariables } from "./tracker/ArtifactTracker";
import * as Path from 'path';
import * as fs from 'fs';
import { exists, getAppArtifactsDir, getAppTrackerFile, getAppUninstallerDir, getAppUninstallPropsFile, mkdirp, rmdirRecursive } from "../core/io/fshelper";
import { createReader } from "./tracker/ArtifactTrackers";
import { DOWNLOADER } from "../utils/ipc";
import { UninstallTrackers } from "./tracker/uninstall/UninstallTrackers";
import { UninstallTracker } from "./tracker/uninstall/UninstallTracker";
import { readInputMap } from "./inputs";
import log from 'electron-log';

export async function uninstallApp(app: App) {
    const installedApp = await InstalledApplication.query().where('app_id', app.id).first();
    if (!installedApp) return;

    const installationDir = installedApp.path;
    const uninstallProps = await readUninstallProps(app);

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
    
            log.verbose(`Deleting artifact '${file}'...`);
            const uninstalledCompletely = await reader.deleteEntries(reader, true, uninstallProps.skip).catch(err => {
                log.error(`Could not delete artifact '${file}':`, err);
                return true;  // loose tracker, to fix artifact on next installation
            });
            log.verbose(`Artifact '${file}' deleted successfully.`);

            // if all files of the tracker have been removed, there is no need to keep the tracker any longer
            if (uninstalledCompletely || uninstalledCompletely === undefined) {
                reader.deleteFile();  // no need to await file deletion, as the loop ends here
            }
        }
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

        await rmdirRecursive(uninstallTrackerDir).catch(err => log.error(err));
    }

    // remove installation directory (only if empty, so user-generated files can persist)
    if (await exists(installationDir)) {
        // check for remaining files
        const files = await fs.promises.readdir(installationDir).catch(err => {
            log.error(err);
            return undefined;
        });
        
        if (files !== undefined) {
            if (files.length <= 0) {
                await fs.promises.rmdir(installationDir);
            } else {
                if (!uninstallProps.skip) {
                    await rmdirRecursive(installationDir);
                } else {
                    // skip files are configured, check them manually
                    for (const child of files) {
                        const childPath = Path.resolve(installationDir, child);
                        if (uninstallProps.skip.includes(childPath)) continue;

                        // only consider the first level directory in the installation directory, for performance and simplicity

                        await rmdirRecursive(childPath);
                    }
                }
            }
        }
    }

    // delete app info file
    const appInfoFile = getAppTrackerFile(app.id);
    if (await exists(appInfoFile)) 
        await fs.promises.unlink(appInfoFile).catch(err => log.error('Could not remove app info file:', err));

    await InstalledApplication.query().where('app_id', app.id).delete(); // remove from database

    const uninstallPropsFile = getAppUninstallPropsFile(app);
    if (await exists(uninstallPropsFile))
        await fs.promises.unlink(uninstallPropsFile).catch(err => log.error('Could not remove uninstall properties file', err))

    // TODO clean packages

    // update state
    DOWNLOADER.updateInstallationState('not-installed');
}

/**
 * Registers a path that should be skipped when uninstalling.
 * @param path The path to be ignored during uninstallation.
 */
export async function registerUninstallExceptionPath(app: App | number, path: string) {
    const props = await readUninstallProps(app);
    if (!props.skip) props.skip = [];

    if (props.skip.includes(path)) return;

    props.skip.push(path);
    writeUninstallProps(app, props);
}

type UninstallProps = {
    skip?: string[]
}

async function readUninstallProps(app: App | number): Promise<UninstallProps> {
    const file = getAppUninstallPropsFile(app);
    if (!await exists(file)) return {};

    return fs.promises.readFile(file, 'utf8')
        .then(content => JSON.parse(content) as UninstallProps)
        .catch(() => <UninstallProps> {});
}

async function writeUninstallProps(app: App | number, props: UninstallProps) {
    const file = getAppUninstallPropsFile(app);
    await mkdirp(Path.dirname(file));
    await fs.promises.writeFile(file, JSON.stringify(props), 'utf8');
}