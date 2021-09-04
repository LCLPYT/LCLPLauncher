import { OnDidChangeCallback } from "conf/dist/source/types";
import ElectronStore from "electron-store";
import chokidar from 'chokidar';

// config structure
interface ConfigStructure<Group, Item> {
    network: Group & {
        backend: Item,
        host_live: Item,
        host_staging: Item,
        host_debug: Item
    },
    launcher: Group & {
        toast_sound: Item
    }
}

// default values for writing / code info
export const defaultSettings: DefaultConfig = Object.freeze({
    settingGroupLevels: [{
        id: 'general',
        title: 'General',
        description: 'General Settings'
    }],
    launcher: {
        properties: {
            title: 'Launcher',
            description: 'Launcher settings',
            levelId: 'general'
        },
        toast_sound: {
            default: true,
            properties: {
                title: 'Toast Sounds',
                description: 'If enabled, toast sounds will be played.'
            }
        }
    },
    network: {
        properties: {
            title: 'Network',
            description: 'Network Settings',
            levelId: 'general'
        },
        backend: {
            default: 'live',
            properties: {
                title: 'Backend Host',
                description: 'Determines which backend host to use.',
                debugOnly: true,
                options: ['live', 'staging', 'debug']
            }
        },
        host_live: {
            default: 'https://lclpnet.work',
            properties: {
                title: 'Live host',
                description: 'Live backend server host.',
                debugOnly: true,
                inputTextType: 'url'
            }
        },
        host_staging: {
            default: 'https://staging.lclpnet.work',
            properties: {
                title: 'Staging host',
                description: 'Staging backend server host.',
                debugOnly: true,
                inputTextType: 'url'
            }
        },
        host_debug: {
            default: 'http://localhost:8000',
            properties: {
                title: 'Debug host',
                description: 'Backend server host for debug mode.',
                debugOnly: true,
                inputTextType: 'url'
            }
        }
    }
});

// Getters
/**
* Gets the protocol and host prefix for backend requests.
* E.g. 'https://lclpnet.work'
* @returns A string containing the protocol and host for backend interaction.
*/
export function getBackendHost(): string {
    const backend: string = getConfigItem(conf => conf.network.backend);
    return getConfigItem(conf => {
        const property = conf.network[`host_${backend}`];
        if(!property) throw new TypeError(`The property 'host_${backend}' is not a valid config setting.`);
        return <Setting> property;
    });
}

export function shouldPlayToastSound(): boolean {
    return getConfigItem(conf => conf.launcher.toast_sound);
}

// Getter helper
function getConfigItem<ItemType>(accessor: (config: LoadedConfig) => any): ItemType {
    const store = Settings.store ? Settings.store : Settings.initWatchedStore();
    try {
        return <ItemType> accessor(<LoadedConfig> <unknown> store.store);
    } catch(err) {
        if (err instanceof Error) err.message = `Could not get setting: ${err.message}`;
        throw err;
    }
}

// Default config for writing / setting info
export interface DefaultConfig extends ConfigStructure<SettingGroup, Setting> {
    settingGroupLevels: SettingGroupLevel[],
}
export type SettingLike = SettingGroup | Setting | SettingGroupProperties;
export type Setting = {
    default: any,
    properties?: SettingProperties
}
export type NamedSetting = {
    title: string,
    description?: string
}
export type SettingGroupLevel = NamedSetting & {
    id: string
};
/**
* Properties for settings GUI.
* By default, the setting type is 'checkbox' which indicates a boolean value.
*/
export type SettingProperties = NamedSetting & {
    /** If true, setting will only be shown in debug mode */
    debugOnly?: boolean,
    /** If set, setting type will be 'select' with the given options */
    options?: any[],
    /** If set, setting type will be 'input' with the given type */
    inputTextType?: 'text' | 'url'
}
export type SettingGroup = {
    properties: SettingGroupProperties,
    [key: string]: SettingLike
}
export type SettingGroupProperties = NamedSetting & {
    levelId?: string
};

// Loaded config which is used after config parsing
export interface LoadedConfig extends ConfigStructure<LoadedGroup, any> {}
type LoadedGroup = {
    [key: string]: LoadedGroup | any
}

export namespace Settings {
    // utilities
    export let store: ElectronStore | undefined;
    let watcher: chokidar.FSWatcher | undefined;

    export function initWatchedStore(): ElectronStore<Record<string, unknown>> {
        if (!store) store = getWatchedStore();
        return store;
    }

    function getWatchedStore() {
        const store = new ElectronStore();
        if (!watcher) {
            watcher = chokidar.watch(store.path);
            watcher.on('change', () => store.events.emit('change'));
        }
        return store;
    }

    export function init() {
        store = getWatchedStore();
        initDefaults(store);
    }
    
    function initDefaults(store: ElectronStore) {
        const iterate = (obj: object, pathSegments: string[]) => {
            Object.entries(obj).forEach(keyVal => {
                const key = keyVal[0];
                const value = keyVal[1];
                
                if (Array.isArray(value)) return; // Can't write arrays; e.g. settingGroupLevels
                
                if (isSetting(value)) {
                    const path = [...pathSegments, key].join('.');
                    if (!store.has(path)) store.set(path, value.default);
                }
                else if (!isSettingGroupPropeties(value)) iterate(value, [...pathSegments, key]); // if value is SettingGroupProperties, skip
            });
        };
        
        iterate(defaultSettings, []);
    }
    
    export function isSetting(object: any): object is Setting {
        return (<Setting> object).default !== undefined;
    }
    
    export function isSettingGroupPropeties(object: any): object is SettingGroupProperties {
        return (<SettingGroupProperties> object).title !== undefined;
    }

    const manuallyChanged: string[] = [];

    export function getConfigItemByName<ItemType>(name: string): ItemType | undefined {
        if (!store) store = getWatchedStore();
        if (!store.has(name)) return undefined;
        else return <ItemType> store.get(name);
    }

    export function setConfigItemByName(setting: string, value: any) {
        if (!store) store = getWatchedStore();
        if (!manuallyChanged.includes(setting)) manuallyChanged.push(setting);
        store.set(setting, value);
    }

    export function onSettingChanged<T>(setting: string, callback: OnDidChangeCallback<T>) {
        if (!store) store = getWatchedStore()
        return store.onDidChange(setting, (newValue, oldValue) => {
            if (manuallyChanged.includes(setting)) {
                const idx = manuallyChanged.indexOf(setting);
                if (idx >= 0) manuallyChanged.splice(idx, 1);  
            } else callback(<T> newValue, <T> oldValue);
        });
    }
}