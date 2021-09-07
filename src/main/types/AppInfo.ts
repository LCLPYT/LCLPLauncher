type AppInfo = {
    launcherVersion: string,
    platforms: {
        [platform: string]: {
            installer: string
        }
    }
}

export default AppInfo;