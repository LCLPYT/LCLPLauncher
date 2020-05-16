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

exports.getBaseDir = getBaseDir;
exports.getBaseFile = getBaseFile;