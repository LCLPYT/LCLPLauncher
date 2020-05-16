const app = require("electron").remote.app;
const server = app.tcpServerModule;

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
    let command = ["-jar", "./bin/launcherlogic/LauncherLogic.jar", 
        "install", 
        "ls5", 
        installDir, 
        `--progress-callback=localhost:${port}`, 
        "--debug"];
    console.log(`Arguments: ${command}`);
    let child = child_process.spawn("./bin/launcherlogic/runtime/bin/java.exe", command, {});
    
    /*child.stdout.setEncoding('utf8');
    child.stdout.on('data', function(data) {
        console.log(data);
    });
    
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function(data) {
        console.error(data);
    });*/
    
    child.on('exit', code => {
        console.log("Subprocess finished with code " + code + ".");
    });
}

exports.startInstaller = startInstaller;