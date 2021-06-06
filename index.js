const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const log = require("electron-log");
const { autoUpdater } = require("electron-updater")
const server = require("./js/server");
const {download} = require("electron-dl");
const decompress = require("decompress");
const { isPostInstallNeeded, getStatus } = require('./js/postinstaller');

let window = null;
let keepAlive = false;

log.info('Starting LCLPLauncher...');

console.log("Running LCLPLauncher from " + app.getAppPath());

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  log.error("Another instance is already running. Exiting...")
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  });

  app.whenReady().then(onReady);
}

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info"

app.allowRendererProcessReuse = true;
app.logX = x => console.log(x);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if(keepAlive) {
    keepAlive = false;
    return;
  }
  // Unter macOS ist es üblich, für Apps und ihre Menu Bar
  // aktiv zu bleiben, bis der Nutzer explizit mit Cmd + Q die App beendet.
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // Unter macOS ist es üblich ein neues Fenster der App zu erstellen, wenn
  // das Dock Icon angeklickt wird und keine anderen Fenster offen sind.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.getPostInstallerStatus = getStatus;

autoUpdater.on("update-available", info => {
  createUpdateWindow();
  updateWindow.webContents.send("status", `Version ${info.version} ist verfügbar`);
});

autoUpdater.on("update-not-available", info => {
  window.webContents.send("update", `No update available.`);
});

autoUpdater.on("error", error => {
  updateWindow.webContents.send("status", "Ein fehler ist aufgetreten");
});

autoUpdater.on("update-downloaded", info => {
  updateWindow.webContents.send("status", "Update heruntergeladen");
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 3*1000);
});

autoUpdater.on("download-progress", progress => {
  log.info(`${progress.percent}% @ ${(progress.bytesPerSecond / 2**20).toFixed(2)} MB/s`);
  updateWindow.webContents.send("progress", `${progress.percent.toFixed(2)}% @ ${(progress.bytesPerSecond / 2**20).toFixed(2)} MB/s`);
});

function isDev() {
  return process.mainModule.filename.indexOf('app.asar') === -1;
}

function onReady() {
  isPostInstallNeeded(needed => {
    if(needed) createPostInstallWindow();
    else onNoPostInstallNeeded();
  });
}

function onNoPostInstallNeeded() {
  startUI();
  if(!isDev()) autoUpdater.checkForUpdates();
}

function startUI() {
  server.startServer(port => {
    if(port == null) {
      console.error("Unable to start the server.");
      throw new Error("Could not start tcp server");
    }
    app.tcpServerModule = server;
    createWindow();
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    },
    icon: nativeImage.createFromPath("resources/img/logo.png"),
    show: false,
    frame: true
  })
  window.maximize();

  window.setMenu(null); // PRODUCTION ONLY

  let parsed = require('yargs').argv;
  window.parsedArgs = parsed;

  //window.loadFile('index.html');
  window.loadFile('ls5.html'); //directly go to LCLPServer 5.0 tab.

  window.on("ready-to-show", () => {
    window.show();
    window.focus();
  })
}

let updateWindow;
function createUpdateWindow() {
  updateWindow = new BrowserWindow({
    width: 400,
    height: 400,
    webPreferences: {
      nodeIntegration: true
    },
    icon: nativeImage.createFromPath("resources/img/logo.png"),
    show: false,
    frame: false
  })
  
  updateWindow.loadFile('update.html');
  
  updateWindow.on("ready-to-show", () => {
    updateWindow.show();
    updateWindow.focus();
  })
}

let postInstallWindow;
function createPostInstallWindow() {
  postInstallWindow = new BrowserWindow({
    width: 400,
    height: 400,
    webPreferences: {
      nodeIntegration: true
    },
    icon: nativeImage.createFromPath("resources/img/logo.png"),
    show: false,
    frame: false
  });
  
  postInstallWindow.loadFile('postInstall.html');
  
  postInstallWindow.on("ready-to-show", () => {
    postInstallWindow.show();
    postInstallWindow.focus();
  });
}

ipcMain.on("download", (event, info) => {
  info.properties.onProgress = status => postInstallWindow.webContents.send("download-progress", status);
  download(postInstallWindow, info.url, info.properties)
    .then(dl => postInstallWindow.webContents.send("download-complete", {path: dl.getSavePath(), name: info.name}));
});
ipcMain.on("extract", (event, info) => {
  decompress(info.file, info.dest).then(files => postInstallWindow.webContents.send("extract-complete", info.file));
});
ipcMain.on("postInstallComplete", (event, info) => {
  keepAlive = true;
  postInstallWindow.close();
  onNoPostInstallNeeded();
});