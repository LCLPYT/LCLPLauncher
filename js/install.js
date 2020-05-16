const app = require("electron").remote.app;
const server = app.tcpServerModule;

function startInstaller(installDir, onComplete, callback) {
    console.log("Using '" + installDir + "' as installation directory.");
    console.log(`TCP server is available on localhost:${server.getPort()}`);
    server.setCallback(json => {
        callback(json);
    });
    launchSubprocess(installDir, server.getPort(), onComplete);
}

function launchSubprocess(installDir, port, onComplete) {
    const child_process = require("child_process");

    console.log("Starting subprocess...");
    let command = ["-jar", "./bin/launcherlogic/LauncherLogic.jar", 
        "install", 
        "ls5", 
        installDir, 
        `--progress-callback=localhost:${port}`, 
        "--debug"];
    console.log(`Arguments: ${command}`);
    let child = child_process.execFile("./bin/launcherlogic/runtime/bin/java.exe", command, { stdio: [0, 'pipe', 'pipe'] });
    
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function(data) {
        console.log(data);
    });
    
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function(data) {
        console.error(data);
    });
    
    child.on('exit', code => {
        console.log("Subprocess finished with code " + code + ".");
        onComplete(code);
    });
}

exports.startInstaller = startInstaller;