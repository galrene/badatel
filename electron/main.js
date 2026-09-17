import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let mainWindow = null;
let runningServer = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const userDataDir = app.getPath('userData');

// Resolve data & upload directories
const appDataDir = isDev
  ? path.join(rootDir, 'data')
  : path.join(userDataDir, 'data');

const appUploadsDir = isDev
  ? path.join(rootDir, 'public', 'uploads')
  : path.join(userDataDir, 'uploads');

// Sample directory fallback
const bundledSampleDir = path.join(rootDir, 'public', 'sample-map');
const appSampleDir = (!isDev && !fs.existsSync(bundledSampleDir) && process.resourcesPath)
  ? path.join(process.resourcesPath, 'public', 'sample-map')
  : bundledSampleDir;

const appDistDir = path.join(rootDir, 'dist');

function ensureDirectoriesAndSeed() {
  for (const dir of [appDataDir, appUploadsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Seed default settings and buildings in packaged app if first run
  if (!isDev) {
    const bundledSettings = path.join(rootDir, 'data', 'settings.json');
    const targetSettings = path.join(appDataDir, 'settings.json');
    if (!fs.existsSync(targetSettings) && fs.existsSync(bundledSettings)) {
      try {
        fs.copyFileSync(bundledSettings, targetSettings);
      } catch (err) {
        console.warn('Failed to seed settings.json:', err.message);
      }
    }

    const bundledBuildings = path.join(rootDir, 'data', 'buildings.json');
    const targetBuildings = path.join(appDataDir, 'buildings.json');
    if (!fs.existsSync(targetBuildings) && fs.existsSync(bundledBuildings)) {
      try {
        fs.copyFileSync(bundledBuildings, targetBuildings);
      } catch (err) {
        console.warn('Failed to seed buildings.json:', err.message);
      }
    }
  }

  process.env.DATA_DIR = appDataDir;
  process.env.UPLOADS_DIR = appUploadsDir;
  process.env.SAMPLE_DIR = appSampleDir;
  process.env.DIST_DIR = appDistDir;
}

function setupMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Directory',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            shell.openPath(appDataDir);
          },
        },
        {
          label: 'Open Uploads Directory',
          accelerator: 'CmdOrCtrl+Shift+U',
          click: () => {
            shell.openPath(appUploadsDir);
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About Badatel',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Badatel',
              message: 'Badatel — Urban Plan & Building Documentation',
              detail: `Version: ${app.getVersion()}\nCross-platform historical building footprint and cadastral map explorer.\nBuilt with Electron, React, Leaflet, and Node.js.`,
            });
          },
        },
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/galrene/badatel');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  ensureDirectoriesAndSeed();

  let startUrl = process.env.VITE_DEV_SERVER_URL;

  if (!startUrl) {
    // Start embedded local HTTP server
    const { server, port } = await startServer({
      port: 0,
      host: '127.0.0.1',
      dataDir: appDataDir,
      uploadsDir: appUploadsDir,
      sampleDir: appSampleDir,
      distDir: appDistDir,
    });
    runningServer = server;
    startUrl = `http://127.0.0.1:${port}`;
  }

  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    title: 'Badatel — Urban Plan & Building Documentation',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(startUrl);

  setupMenu();
}

// IPC Handlers
ipcMain.handle('open-data-folder', () => shell.openPath(appDataDir));
ipcMain.handle('open-uploads-folder', () => shell.openPath(appUploadsDir));
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error('Failed to create main window:', err);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  }
});

app.on('before-quit', () => {
  if (runningServer) {
    try {
      runningServer.close();
    } catch {
      // ignore
    }
  }
});
