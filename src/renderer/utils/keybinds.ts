import { remote } from 'electron';

const pressedKeys: PressedKey[] = [];

export function registerKeybinds() {
    addKeyListeners();

    document.addEventListener('keyup', event => {
        const key = event.key.toUpperCase();
        if (key === 'I' && isKeyDown('Control') && isKeyDown('Shift')) {
            remote.getCurrentWindow().webContents.toggleDevTools();
            pressedKeys.length = 0; // focus is lost, so clear pressedKeys manually
        } else if (key === 'F5' || (key === 'R' && isKeyDown('Control'))) {
            location.reload();
            pressedKeys.length = 0; // focus is lost, so clear pressedKeys manually
        }
    });
}

function addKeyListeners() {
    document.addEventListener("keydown", event => {
        if (!isKeyDown(event.key)) pressedKeys.push(new PressedKey(event.key.toUpperCase(), event.code));
    }, false);
    
    document.addEventListener("keyup", event => {
        let pressedKey = getPressedKey(event.key);
        if(pressedKey === undefined) return;
        
        let index = pressedKeys.indexOf(pressedKey);
        if (index >= 0) pressedKeys.splice(index, 1);
    }, false);
}

function getPressedKey(key: string): PressedKey | undefined {
    const upperCased = key.toUpperCase();
    return pressedKeys.find(x => x.key === upperCased);
}

export function isKeyDown(key: string): boolean {
    return getPressedKey(key) !== undefined;
}

class PressedKey {

    public readonly key: string;
    public readonly code: string;

    constructor(key: string, code: string) {
        this.key = key;
        this.code = code;
    }

}