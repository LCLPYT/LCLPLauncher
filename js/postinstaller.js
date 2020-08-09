const osHooks = require("./oshooks");
const {ipcRenderer, remote} = require("electron");
const fs = require("fs");
const path = require("path");
const md5File = require("md5-file");
const files = require("./files");

let hasJava = false, hasFI = false, hasLL = false;
let queue = [];

function isPostInstallNeeded(callback) {
    hasJava = osHooks.isJavaRuntimePresent();
    latestForgeInstaller(hasLatestFI => {
        latestLauncherLogic(hasLatestLL => {
            callback(!hasJava || !hasLatestFI || !hasLatestLL);
        });
    });
}

async function latestForgeInstaller(callback) {
    let resp = await getContent("https://raw.githubusercontent.com/LCLPYT/LauncherLogicForgeInstaller/master/latest.json");
    let json = JSON.parse(resp);
    let path = `${files.getBaseDir()}/bin/launcherlogic/launcherlogic-forge_installer.jar`;

    if(!fs.existsSync(path)) {
        hasFI = false;
        callback(hasFI);
        return;
    }

    md5File(path).then((hash) => {
        hasFI = hash === json.md5;
        callback(hasFI);
    });
}

async function latestLauncherLogic(callback) {
    let resp = await getContent("https://raw.githubusercontent.com/LCLPYT/LauncherLogic/master/LauncherLogic/latest.json");
    let json = JSON.parse(resp);
    let path = `${files.getBaseDir()}/bin/launcherlogic/LauncherLogic.jar`;

    if(!fs.existsSync(path)) {
        hasLL = false;
        callback(hasLL);
        return;
    }

    md5File(path).then((hash) => {
        hasLL = hash === json.md5;
        callback(hasLL);
    });
}

function getContent(url) {
    return new Promise((resolve, reject) => {
        let client = require('https')

        client.get(url, (resp) => {
            let data = '';

            resp.on('data', (chunk) => {
                data += chunk;
            });

            resp.on('end', () => {
                resolve(data);
            });

        }).on("error", (err) => {
            reject(err);
        });
    });
}

function postInstall() {
    let status = remote.app.getPostInstallerStatus();
    if(!status.java) queue.push(downloadJava);
    if(!status.fi) queue.push(downloadFI);
    if(!status.ll) queue.push(downloadLL);

    nextQueueItem(null);
}

function nextQueueItem(container) {
    if(queue.length <= 0) return;

    let next = queue.pop();
    next(container);
}

function notifyFinish(container) {
    if(queue.length > 0) {
        nextQueueItem(container);
        return;
    }

    container.innerHTML = "Fertig."
    setTimeout(() => ipcRenderer.send("postInstallComplete", true), 3000);
}

function downloadJava(container) {
    if(container != null) container.innerHTML = "Zusätzliches herunterladen...";

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime.tmp");
    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);

    ipcRenderer.send("download", {
        url: osHooks.getJavaDownloadLink(),
        name: "java",
        properties: {
            directory: osHooks.getJavaDownloadDirectory(),
            filename: "runtime.tmp",
        }
    });
}

function downloadFI(container) {
    if(container != null) container.innerHTML = "Zusätzliches herunterladen...";

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "launcherlogic-forge_installer.jar");
    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);

    ipcRenderer.send("download", {
        url: "https://github.com/LCLPYT/LauncherLogicForgeInstaller/releases/latest/download/LauncherLogicForgeInstaller.jar",
        name: "fi",
        properties: {
            directory: osHooks.getJavaDownloadDirectory(),
            filename: "launcherlogic-forge_installer.jar"
        }
    });
}

function downloadLL(container) {
    if(container != null) container.innerHTML = "Zusätzliches herunterladen...";

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "LauncherLogic.jar");
    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);

    ipcRenderer.send("download", {
        url: "https://github.com/LCLPYT/LauncherLogic/releases/latest/download/LauncherLogic.jar",
        name: "ll",
        properties: {
            directory: osHooks.getJavaDownloadDirectory(),
            filename: "LauncherLogic.jar"
        }
    });
}

function extractJava(container) {
    if(container != null) container.innerHTML = "Zusätzliches extrahieren...";

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime.tmp");
    if(!fs.existsSync(pathToTmp)) throw new Error("Runtime.tmp not found.");

    let destDir = path.resolve(osHooks.getJavaDownloadDirectory(), "extract");
    if(fs.existsSync(destDir)) fs.rmdirSync(destDir, {
        recursive: true
    });

    ipcRenderer.send("extract", {
        file: pathToTmp,
        dest: destDir
    });
}

function postExtractJava(container) {
    if(container != null) container.innerHTML = "Aufräumen...";

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime.tmp");
    let destDir = path.resolve(osHooks.getJavaDownloadDirectory(), "extract");

    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);
    if(!fs.existsSync(destDir)) throw new Error(destDir + " not found.");

    let files = fs.readdirSync(destDir);
    if(files.length != 1) throw new Error("Illegal extraction result.");

    let rootDir = path.resolve(destDir, files[0]);
    let rtDir = path.resolve(osHooks.getJavaDownloadDirectory(), "runtime");
    if(fs.existsSync(rtDir)) fs.rmdirSync(rtDir, {
        recursive: true
    });

    fs.renameSync(rootDir, rtDir);

    fs.rmdirSync(destDir);
}

function getStatus() {
    return {
        java: hasJava,
        fi: hasFI,
        ll: hasLL
    };
}

exports.isPostInstallNeeded = isPostInstallNeeded;
exports.postInstall = postInstall;
exports.extractJava = extractJava;
exports.postExtractJava = postExtractJava;
exports.notifyFinish = notifyFinish;
exports.getStatus = getStatus;