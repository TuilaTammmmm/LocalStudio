import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = parseInt(process.env.PORT || '3001', 10);

let mainWindow: BrowserWindow | null = null;
let backendCleanup: (() => Promise<void>) | null = null;

// Free port helper on Windows for any orphan process
function freePort(port: number) {
  if (process.platform !== 'win32') return;
  try {
    const stdout = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && pid !== process.pid.toString() && !isNaN(Number(pid))) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
          console.log(`[Electron] Cleaned orphan process (PID: ${pid}) holding port ${port}`);
        } catch {}
      }
    }
  } catch {}
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function checkPortListening(port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/hardware`, () => {
      resolve(true);
      req.destroy();
    });
    req.on('error', () => {
      resolve(false);
      req.destroy();
    });
    req.setTimeout(timeoutMs, () => {
      resolve(false);
      req.destroy();
    });
  });
}

async function startInternalBackend() {
  freePort(BACKEND_PORT);
  const isRunning = await checkPortListening(BACKEND_PORT);
  if (isRunning) {
    console.log(`[Electron] Backend already listening on port ${BACKEND_PORT}.`);
    return;
  }

  console.log(`[Electron] Initializing LocalAI Core Backend in main process...`);
  try {
    const { startBackend } = await import('../src/index.js');
    const { cleanup } = startBackend(BACKEND_PORT);
    backendCleanup = cleanup;
    console.log(`[Electron] LocalAI Core Backend started successfully on port ${BACKEND_PORT}.`);
  } catch (err) {
    console.error('[Electron] Failed to start internal backend:', err);
  }
}

async function createWindow() {
  // Hide default menu bar for clean modern app look
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    title: 'LocalAI Studio',
    width: 1360,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    show: false, // show when ready-to-show to prevent white flashes
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, '../build-assets/icon.ico'),
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    console.log(`[Electron] Loading dev URL: ${devUrl}`);
    let loaded = false;
    for (let i = 0; i < 20; i++) {
      try {
        await mainWindow.loadURL(devUrl);
        loaded = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (!loaded) {
      console.warn(`[Electron] Vite server not ready at ${devUrl}. Loading local bundle.`);
      await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log(`[Electron] Loading production file: ${indexPath}`);
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Native Dialogs
ipcMain.handle('dialog:openFolder', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: options?.title || 'Chọn thư mục dự án LocalAI',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('dialog:openFile', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: options?.title || 'Chọn file',
    properties: ['openFile'],
    filters: options?.filters,
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  await startInternalBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async () => {
  if (backendCleanup) {
    try {
      await backendCleanup();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
