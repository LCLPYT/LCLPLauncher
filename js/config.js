const Store = require("electron-store");
const store = new Store();

const KEY_INSTALLATION_DIR = "installation-dir";

function init(key, value) {
    if(!store.has(key)) store.set(key, value);
}

function getInstallationDir() {
    return store.get(KEY_INSTALLATION_DIR);
}

function setInstallationDir(value) {
    store.set(KEY_INSTALLATION_DIR, value);
}

exports.getInstallationDir = getInstallationDir;
exports.setInstallationDir = setInstallationDir;
exports.KEY_INSTALLATION_DIR = KEY_INSTALLATION_DIR;
exports.init = init;