import chokidar from 'chokidar';
import { OnDidChangeCallback } from "conf/dist/source/types";
import ElectronStore from "electron-store";
import MaybePresent from "../types/util/MaybePresent";
import { registeredLanguages, translate as t } from "./i18n";

// config structure
interface ConfigStructure<Group, Item> {
    network: Group & {
        backend: Item,
        host_live: Item,
        host_staging: Item,
        host_debug: Item
    },
    launcher: Group & {
        language: Item,
        toast_sound: Item
    }
}

// default values for writing / code info
export const defaultSettings: DefaultConfig = Object.freeze({
    settingGroupLevels: [{
        id: 'general',
        title: () => t('setting.group.general'),
        description: () => t('setting.group.general.desc')
    }],
    launcher: {
        properties: {
            title: () => t('setting.group.launcher'),
            description: () => t('setting.group.launcher.desc'),
            levelId: 'general'
        },
        language: {
            default: 'system',
            properties: {
                title: () => 'UI Language',
                description: () => 'Language displayed in the user interface.',
                options: () => ({
                    'system': `System (${t('lang.system')})`,
                    // destructure registered languages mapped to key-value-pairs
                    ...Object.entries(registeredLanguages).map(([key, item]) => {
                        // build label: Flag localizedName (translatedName)
                        return [key, item.localizedName + ` (${t('lang.' + key)})`];
                    }).reduce((prev, [key, label]) => {
                        // merge into one object that will be destructured
                        prev[key] = label;
                        return prev;
                    }, {} as Record<string, string>)
                })
            }
        },
        toast_sound: {
            default: true,
            properties: {
                title: () => t('setting.toast_sound'),
                description: () => t('setting.toast_sound.desc')
            }
        }
    },
    network: {
        properties: {
            title: () => t('setting.group.network'),
            description: () => t('setting.group.network.desc'),
            levelId: 'general'
        },
        backend: <Setting> {
            default: 'live',
            properties: {
                title: () => t('setting.backend'),
                description: () => t('setting.backend.desc'),
                debugOnly: true,
                options: ['live', 'staging', 'debug']
            }
        },
        host_live: <Setting> {
            default: 'https://lclpnet.work',
            properties: {
                title: () => t('setting.host_live'),
                description: () => t('setting.host_live.desc'),
                debugOnly: true,
                inputTextType: 'url'
            }
        },
        host_staging: <Setting> {
            default: 'https://staging.lclpnet.work',
            properties: {
                title: () => t('setting.host_staging'),
                description: () => t('setting.host_staging.desc'),
                debugOnly: true,
                inputTextType: 'url'
            }
        },
        host_debug: <Setting> {
            default: 'http://localhost:8000',
            properties: {
                title: () => t('setting.host_debug'),
                description: () => t('setting.host_debug.desc'),
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

export function getConfiguredLanguage(): string {
    return getConfigItem(conf => conf.launcher.language) || 'system';
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
    title: MaybePresent<string>,
    description?: MaybePresent<string>
}
export type SettingGroupLevel = NamedSetting & {
    id: string
};
export type SelectOptions = any[] | Record<any, string>;
/**
* Properties for settings GUI.
* By default, the setting type is 'checkbox' which indicates a boolean value.
*/
export type SettingProperties = NamedSetting & {
    /** If true, setting will only be shown in debug mode */
    debugOnly?: boolean,
    /** If set, setting type will be 'select' with the given options */
    options?: MaybePresent<SelectOptions>,
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

        const oldValue = store.get(setting);
        store.set(setting, value);
        onSettingDidChange(setting, value, oldValue);
    }

    export function onSettingChangedExternally<T>(setting: string, callback: OnDidChangeCallback<T>) {
        if (!store) store = getWatchedStore()
        return store.onDidChange(setting, (newValue, oldValue) => {
            if (manuallyChanged.includes(setting)) {
                const idx = manuallyChanged.indexOf(setting);
                if (idx >= 0) manuallyChanged.splice(idx, 1);  
            } else {
                onSettingDidChange(setting, newValue, oldValue);
                callback(<T> newValue, <T> oldValue);
            }
        });
    }

    type ChangedListener = (setting: string, newValue: any, oldValue: any) => void;

    const changedListeners: ChangedListener[] = [];

    const onSettingDidChange: ChangedListener = (setting, newValue, oldValue) => {
        changedListeners.forEach(listener => listener(setting, newValue, oldValue));
    }

    export function registerOnChangedListener(listener: ChangedListener) {
        changedListeners.push(listener);
    }
}