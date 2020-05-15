function startInstaller(installDir) {
    console.log("Using '" + installDir + "' as installation directory.");
    listen(installDir);
}

function listen(installDir) {
    console.log("Trying to start server...");

    const Net = require('net');
    const port = 8080;
    
    const server = new Net.Server();
    server.listen(port, function() {
        console.log(`Server listening for connection requests on socket localhost:${port}`);
        launchSubprocess(installDir, port);
    });

    server.on("error", error => {
        console.error(error);
    });

    server.on("connection", socket => {
        console.log("A new socket has connected.");

        socket.on("end", () => {
            console.log("[END]: Closing connection with the client.");
            server.close(() => {
                console.log("Server closed.");
            });
        });
        socket.on("close", () => {
            console.log("[Close]: Closing connection with the client.");
            server.close(() => {
                console.log("Server closed.");
            });
        });
        socket.on("error", err => {
            console.log(`Socket Error: ${err}`);
            server.close(() => {
                console.log("Server closed.");
            });
        });

        socket.write("Hello, client.\n");

        let chunk = "";
        socket.on("data", data => {
            chunk += data.toString();
            d_index = chunk.indexOf('\n');
            
            while (d_index > -1) {         
                string = chunk.substring(0,d_index);
                json = JSON.parse(string);
                process(json);
                chunk = chunk.substring(d_index + 1);
                d_index = chunk.indexOf('\n');
            } 
        });
    });
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
    let child = child_process.execFile("./bin/launcherlogic/runtime/bin/java.exe", command, (error, stdout, stderr) => {
        if(error) console.log(error);
        else console.log("Process finished.");
    });
    
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function(data) {
        console.log(data);
    });
    
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function(data) {
        console.error(data);
    });
    
    child.on('exit', function(code) {
        console.log("Subprocess finished with code " + code + ".");
    });
}

function process(json) {
    console.log(json);
}