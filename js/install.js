const app = require("electron").remote.app;
const server = app.tcpServerModule;
const files = require("./files");

function startUpdateChecker(installDir, onClose, callback) {
    console.log("Using '" + installDir + "' as installation directory.");
    console.log(`TCP server is available on localhost:${server.getPort()}`);
    server.setCallback(json => {
        callback(json);
    });
    server.setOnCloseConnection(onClose);
    launchUpdateCheckerSubprocess(installDir, server.getPort());
}

function launchUpdateCheckerSubprocess(installDir, port) {
    const child_process = require("child_process");

    console.log("Starting subprocess...");
    let command = ["-jar", files.getBaseDir() + "\\bin\\launcherlogic\\LauncherLogic.jar", 
        "checkUpdate", 
        "ls5", 
        installDir, 
        `--progress-callback=localhost:${port}`, 
        "--debug"];
    console.log(`Executing: ${files.getBaseDir()}/bin/launcherlogic/runtime/bin/java.exe`);
    console.log(`Arguments: ${command}`);
    let child = child_process.spawn(files.getBaseDir() + "\\bin\\launcherlogic\\runtime\\bin\\java.exe", command, {
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
    });
}

function startInstaller(installDir, onClose, callback) {
    console.log("Using '" + installDir + "' as installation directory.");
    console.log(`TCP server is available on localhost:${server.getPort()}`);
    server.setCallback(json => {
        callback(json);
    });
    server.setOnCloseConnection(onClose);
    launchSubprocess(installDir, server.getPort());
}

function launchSubprocess(installDir, port) {
    const child_process = require("child_process");

    console.log("Starting subprocess...");
    let command = ["-jar", files.getBaseDir() + "\\bin\\launcherlogic\\LauncherLogic.jar", 
        "install", 
        "ls5", 
        installDir, 
        `--progress-callback=localhost:${port}`, 
        "--debug"];
    console.log(`Executing: ${files.getBaseDir()}/bin/launcherlogic/runtime/bin/java.exe`);
    console.log(`Arguments: ${command}`);
    let child = child_process.spawn(files.getBaseDir() + "\\bin\\launcherlogic\\runtime\\bin\\java.exe", command, {
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
    });
}

exports.startInstaller = startInstaller;
exports.startUpdateChecker = startUpdateChecker;