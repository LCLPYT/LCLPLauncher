const os = require("os");
const files = require("./files");
const fs = require('fs');

class Handler {

    unimplemented() {
        throw new Error(`Unsupported platform: ${os.platform()}`);
    }

    isJavaRuntimePresent() {
        return fs.existsSync(`${files.getBaseDir()}/bin/launcherlogic/runtime`);
    }

    getJavaExecuteable() {
        return `${files.getBaseDir()}/bin/launcherlogic/runtime/bin/java`;
    }

    getJavaDownloadDirectory() {
        return `${files.getBaseDir()}/bin/launcherlogic/`;
    }

    getJavaDownloadLink() {
        this.unimplemented();
    }

    getMinecraftLauncherPath() {
        this.unimplemented();
    }

}

class LinuxHandler extends Handler {

    getJavaDownloadLink() {
        return "https://github.com/AdoptOpenJDK/openjdk14-binaries/releases/download/jdk14u-2020-07-28-07-34/OpenJDK14U-jdk_x64_linux_hotspot_2020-07-28-07-34.tar.gz";
    }

    getMinecraftLauncherPath() {
        return "/usr/bin/minecraft-launcher";
    }

}

let handler;

switch (os.platform()) {
    case "linux":
        handler = new LinuxHandler(); 
        break;

    default:
        handler = new Handler();
        break;
}

function isJavaRuntimePresent() {
    return handler.isJavaRuntimePresent();
}

function getJavaDownloadLink() {
    return handler.getJavaDownloadLink();
}

function getJavaDownloadDirectory() {
    return handler.getJavaDownloadDirectory();
}

function getMinecraftLauncherPath() {
    return handler.getMinecraftLauncherPath();
}

function getJavaExecuteable() {
    return handler.getJavaExecuteable();
}

exports.isJavaRuntimePresent = isJavaRuntimePresent;
exports.getJavaDownloadLink = getJavaDownloadLink;
exports.getJavaDownloadDirectory = getJavaDownloadDirectory;
exports.getMinecraftLauncherPath = getMinecraftLauncherPath;
exports.getJavaExecuteable = getJavaExecuteable;