const { app, BrowserWindow, dialog, Menu, Tray, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    show: false,
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Use a simple icon or the app icon
  const iconPath = path.join(__dirname, '../public/icon.svg');

  tray = new Tray(iconPath);
  tray.setToolTip('Cubby Template Builder for Reaper');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Cubby Reaper',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Open Reabank Folder',
      click: () => {
        const reabankPath = path.join(
          app.getPath('home'),
          'Library/Application Support/REAPER/Data'
        );
        if (fs.existsSync(reabankPath)) {
          shell.openPath(reabankPath);
        } else {
          dialog.showMessageBox({
            type: 'info',
            title: 'Folder Not Found',
            message: 'REAPER Data folder not found at expected location.',
          });
        }
      },
    },
    {
      label: 'Open Templates Folder',
      click: () => {
        const templatesPath = path.join(
          app.getPath('documents'),
          'Reaper Templates'
        );
        if (!fs.existsSync(templatesPath)) {
          fs.mkdirSync(templatesPath, { recursive: true });
        }
        shell.openPath(templatesPath);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

// App ready
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle file open (for .reabank files)
app.on('open-file', (event, filePath) => {
  event.preventDefault();

  if (mainWindow) {
    mainWindow.webContents.send('open-file', filePath);
  }
});
