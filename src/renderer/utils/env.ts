import { isDevelopment } from "../../common/utils/env";
import { UTILITIES } from "./ipc";

export async function getAppVersion() {
    if (isDevelopment) return process.env.npm_package_version;
    else return await UTILITIES.getAppVersion();
}