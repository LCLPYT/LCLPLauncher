const os = require("os");
const files = require("./files");
const fs = require('fs');
const homedir = require('os').homedir();

class Handler {

    unimplemented() {
        throw new Error(`Unsupported platform: ${os.platform()}`);
    }

    isJavaRuntimePresent() {
        return fs.existsSync(`${this.getBinDirectory()}/launcherlogic/runtime`);
    }

    getJavaExecuteable() {
        return `${this.getBinDirectory()}//launcherlogic/runtime/bin/java`;
    }

    getJavaDownloadDirectory() {
        return `${this.getBinDirectory()}/launcherlogic/`;
    }

    getBinDirectory() {
        return `${homedir}/.lclplauncher/bin`;
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
        return "https://github.com/AdoptOpenJDK/openjdk16-binaries/releases/download/jdk16u-2021-05-08-12-45/OpenJDK16U-jre_x64_linux_hotspot_2021-05-08-12-45.tar.gz";
    }

    getMinecraftLauncherPath() {
        return ["/usr/bin/minecraft-launcher"];
    }

}

class WinHandler extends Handler {

    getJavaDownloadLink() {
        return "https://github.com/AdoptOpenJDK/openjdk16-binaries/releases/download/jdk16u-2021-05-08-12-45/OpenJDK16U-jre_x64_windows_hotspot_2021-05-08-12-45.zip";
    }

    getJavaExecuteable() {
        return `${files.getBaseDir()}\\bin\\launcherlogic\\runtime\\bin\\java.exe`;
    }

    getMinecraftLauncherPath() {
        return ["C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe", "C:\\Program Files (x86)\\Minecraft\\MinecraftLauncher.exe"];
    }

    getBinDirectory() {
        return `${files.getBaseDir()}\\bin`;
    }
    
}

let handler;

switch (os.platform()) {
    case "linux":
        handler = new LinuxHandler(); 
        break;
    case "win32":
        handler = new WinHandler();
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

function getBinDirectory() {
    return handler.getBinDirectory();
}

exports.isJavaRuntimePresent = isJavaRuntimePresent;
exports.getJavaDownloadLink = getJavaDownloadLink;
exports.getJavaDownloadDirectory = getJavaDownloadDirectory;
exports.getMinecraftLauncherPath = getMinecraftLauncherPath;
exports.getJavaExecuteable = getJavaExecuteable;
exports.getBinDirectory = getBinDirectory;