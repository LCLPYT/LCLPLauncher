const osHooks = require("./oshooks");
const {ipcRenderer} = require("electron");
const fs = require("fs");
const path = require("path");

function isPostInstallNeeded() {
    return !osHooks.isJavaRuntimePresent();
}

function downloadJava() {
    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime.tmp");
    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);

    ipcRenderer.send("download", {
        url: osHooks.getJavaDownloadLink(),
        properties: {
            directory: osHooks.getJavaDownloadDirectory(),
            filename: "runtime.tmp"
        }
    });
}

function extractJava() {
    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime.tmp");
    if(!fs.existsSync(pathToTmp)) throw new Error("Runtime.tmp not found.");

    let destDir = path.resolve(osHooks.getJavaDownloadDirectory(), "extract");
    if(fs.existsSync(destDir)) fs.rmdirSync(destDir);

    ipcRenderer.send("extract", {
        file: pathToTmp,
        dest: destDir
    });
}

function postExtractJava(callback) {
    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime.tmp");
    let destDir = path.resolve(osHooks.getJavaDownloadDirectory(), "extract");

    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);
    if(!fs.existsSync(destDir)) throw new Error(destDir + " not found.");

    let files = fs.readdirSync(destDir);
    if(files.length != 1) throw new Error("Illegal extraction result.");

    let rootDir = path.resolve(destDir, files[0]);
    let rtDir = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime");

    fs.renameSync(rootDir, rtDir);

    fs.rmdirSync(destDir);
}

exports.isPostInstallNeeded = isPostInstallNeeded;
exports.downloadJava = downloadJava;
exports.extractJava = extractJava;
exports.postExtractJava = postExtractJava;