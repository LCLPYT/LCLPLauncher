const { app, BrowserWindow } = require('electron')
const log = require("electron-log");
const { autoUpdater } = require("electron-updater")
const server = require("./js/server")

let window = null;

log.info('Starting LCLPLauncher...');

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

// Quit when all windows are closed.
app.on('window-all-closed', () => {
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

autoUpdater.on("update-available", info => {
  createUpdateWindow();
  updateWindow.webContents.send("status", `Version ${info.version} ist verfügbar`);
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
    icon: "resources/img/logo.png",
    show: false,
    frame: true
  })
  window.maximize();
  
  window.loadFile('index.html');
  
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
    icon: "resources/img/logo.png",
    show: false,
    frame: false
  })
  
  updateWindow.loadFile('update.html');
  
  updateWindow.on("ready-to-show", () => {
    updateWindow.show();
    updateWindow.focus();
  })
}