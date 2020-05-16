const Net = require('net');
let server = new Net.Server();
let clients = [];
let port = undefined;

function startServer(callback) {
    console.log("Trying to start server...");

    server.listen(function() {
        console.log(`Server listening for connection requests on socket localhost:${server.address().port} ...`);
        port = server.address().port;
        callback(port);
    });

    server.on("error", error => {
        console.error(error);
        callback(null);
    });

    server.on("connection", onConnection);
}

function stopServer() {
    for (var i in clients) {
        clients[i].destroy();
    }
    server.close(function () {
        console.log('Server closed.');
        server.unref();
    });
}

function onConnection(socket) {
    clients.push(socket);
    console.log("A new socket has connected.");

    socket.on("close", () => {
        clients.splice(clients.indexOf(socket), 1);
        console.log("[Close]: Closing connection with the client.");
    });
    socket.on("error", err => {
        console.log(`Socket Error: ${err}`);
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
}

function process(json) {}

function setCallback(callback) {
    process = callback;
}

exports.startServer = startServer;
exports.stopServer = stopServer;
exports.getServer = () => {
    return server;
};
exports.getPort = () => {
    return port;
}
exports.setCallback = setCallback;