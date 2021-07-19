import ElectronStore from "electron-store";

export function init() {
    const store = new ElectronStore();

    initDefaults(store, {
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
    });
}

function initDefaults(store: ElectronStore, structure: Structure) {

    function iterate(obj: object, pathSegments: string[]) {
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
