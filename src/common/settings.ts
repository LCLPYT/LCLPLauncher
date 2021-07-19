import ElectronStore from "electron-store";

let store: ElectronStore | undefined;

// default values
const defaults: Config = {
    backend: {
        default: 'live',
        debugOnly: true,
        options: ['live', 'staging', 'debug']
    },
    network: {
        host_live: {
            default: 'https://lclpnet.work',
            debugOnly: true,
            textType: 'url'
        },
        host_staging: {
            default: 'https://staging.lclpnet.work',
            debugOnly: true,
            textType: 'url'
        },
        host_debug: {
            default: 'http://localhost:8000',
            debugOnly: true,
            textType: 'url'
        }
    }
};

export function getConfigItem<ItemType>(accessor: (config: Config) => Setting): ItemType {
    if(!store) store = new ElectronStore();
    return <ItemType> <unknown> accessor(<Config> store.store);
}

export function getBackendHost(): string {
    const backend: string = getConfigItem(conf => conf.backend);
    return getConfigItem(conf => {
        const property = conf.network[`host_${backend}`];
        if(!property) throw new TypeError(`The property 'host_${backend}' is not a valid config setting.`);
        return <Setting> property;
    });
}

export function init() {
    store = new ElectronStore();
    initDefaults(store, defaults);
}

function initDefaults(store: ElectronStore, structure: Config) {
    const iterate = (obj: object, pathSegments: string[]) => {
        Object.entries(obj).forEach(keyVal => {
            const key = keyVal[0];
            const value = keyVal[1];
            if(!isSetting(value)) iterate(value, [...pathSegments, key]);
            else {
                const path = [...pathSegments, key].join('.');
                if(!store.has(path)) store.set(path, value.default);
            }
        });
    };

    iterate(structure, []);
}

declare type Config = Structure & {
    backend: Setting,
    network: Structure & {
        host_live: Setting,
        host_staging: Setting,
        host_debug: Setting
    }
}

declare type Structure = {
    [key: string]: Setting | Structure
}

declare type Setting = {
    default: any,
    debugOnly?: boolean,
    options?: any[],
    textType?: 'text' | 'url'
}

function isSetting(object: any): object is Setting {
    return (<Setting> object).default !== undefined;
}
