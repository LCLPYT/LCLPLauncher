export interface LauncherProfiles {
    profiles: Profiles
}

export interface Profiles {
    [uid: string]: Profile
}

export interface Profile {
    created: Date,
    gameDir?: string,
    icon: string,
    lastUsed: Date,
    lastVersionId: string,
    name: string,
    type: 'custom' | 'latest-release' | 'latest-snapshot',
    javaDir?: string,
    javaArgs?: string,
    logConfig?: string,
    logConfigIsXML?: boolean,
    resolution?: {
        width: number,
        height: number
    }
}

export function parseProfilesFromJson(json: string): LauncherProfiles {
    const datePattern = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
    return <LauncherProfiles> JSON.parse(json, (_key, value) => {
        const isDate = typeof value === 'string' && datePattern.exec(value);
        return isDate ? new Date(value) : value;
    });
}