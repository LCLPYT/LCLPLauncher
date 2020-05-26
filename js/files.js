const path = require('path');

function getBaseDir() {
    let dir = getParent(__dirname.toString());
    if(dir.endsWith("app.asar")) return getParent(getParent(dir));
    else return getParent(__dirname);
}

function getBaseFile() {
    return getParent(__dirname);
}

function getParent(file) {
    return path.resolve(file, '..');
}

function isDevMode() {
    return !getParent(__dirname.toString()).endsWith("app.asar");
}

exports.getBaseDir = getBaseDir;
exports.getBaseFile = getBaseFile;
exports.isDevMode = isDevMode;