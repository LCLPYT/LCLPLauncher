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
    let resp = await getContent("https://lclpnet.work/lclplauncher/extra/forge_installer/info");
    let json;
    try {
        json = JSON.parse(resp);
    } catch($err) {
        hasFI = false;
        callback(hasFI);
        return;
    }
    let path = `${osHooks.getBinDirectory()}/launcherlogic/launcher-logic-forge-installer.jar`;

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
    let resp = await getContent("https://lclpnet.work/lclplauncher/extra/launcher_logic/info");
    let json;
    try {
        json = JSON.parse(resp);
    } catch($err) {
        hasLL = false;
        callback(hasLL);
        return;
    }
    let path = `${osHooks.getBinDirectory()}/launcherlogic/launcher-logic.jar`;

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
    if(!status.fi) queue.push(downloadFI);
    if(!status.ll) queue.push(downloadLL);
    if(!status.java) queue.push(downloadJava);

    console.log(queue);

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

    console.log("JAVA download to " + pathToTmp);

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

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), `launcher-logic-forge-installer.jar`);
    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);

    ipcRenderer.send("download", {
        url: `https://lclpnet.work/lclplauncher/extra/forge_installer/latest`,
        name: "fi",
        properties: {
            directory: osHooks.getJavaDownloadDirectory(),
            filename: `launcher-logic-forge-installer.jar`
        }
    });
}

function downloadLL(container) {
    if(container != null) container.innerHTML = "Zusätzliches herunterladen...";

    let pathToTmp = path.resolve(osHooks.getJavaDownloadDirectory(), `launcher-logic.jar`);
    if(fs.existsSync(pathToTmp)) fs.unlinkSync(pathToTmp);

    ipcRenderer.send("download", {
        url: `https://lclpnet.work/lclplauncher/extra/launcher_logic/latest`,
        name: "ll",
        properties: {
            directory: osHooks.getJavaDownloadDirectory(),
            filename: `launcher-logic.jar`
        }
    });
}

function verifyJavaCompatible(container) {
    let llPath = `${osHooks.getBinDirectory()}/launcherlogic/launcher-logic.jar`;
    if(!fs.existsSync(llPath)) return;

    const child_process = require("child_process");

    console.log("Starting subprocess...");
    let command = ["-jar", llPath, "echo"];
    console.log(`Exec: ${osHooks.getJavaExecuteable()} ${command.join(' ')}`);
    let child = child_process.spawn(osHooks.getJavaExecuteable(), command, {
        stdio: "ignore", detached: true
    }, (err, stdout, stderr) => {
        if(err) {
            console.error(err);
            return;
        }
        console.log(stderr);
        console.log(stdout);
    });

    child.on('exit', code => {
        console.log("Subprocess finished with code " + code + ".");
        if(code !== 0) queue.push(downloadJava);
        notifyFinish(container);
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
exports.verifyJavaCompatible = verifyJavaCompatible;