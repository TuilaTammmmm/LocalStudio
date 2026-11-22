import { app, BrowserWindow, dialog, ipcMain, shell, Menu, Tray, nativeImage, screen, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { execSync } from 'node:child_process';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = parseInt(process.env.PORT || '3001', 10);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let backendCleanup: (() => Promise<void>) | null = null;

// Window state persistence
interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getWindowStateFilePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowBounds {
  const defaultState: WindowBounds = {
    width: 1360,
    height: 840,
    isMaximized: false,
  };
  try {
    const file = getWindowStateFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (typeof data.width === 'number' && typeof data.height === 'number') {
        const state: WindowBounds = {
          width: Math.max(960, data.width),
          height: Math.max(640, data.height),
          isMaximized: Boolean(data.isMaximized),
        };
        if (typeof data.x === 'number' && typeof data.y === 'number') {
          const displays = screen.getAllDisplays();
          const isVisible = displays.some((d) => {
            const b = d.bounds;
            return (
              data.x >= b.x - 20 &&
              data.x <= b.x + b.width - 100 &&
              data.y >= b.y - 20 &&
              data.y <= b.y + b.height - 100
            );
          });
          if (isVisible) {
            state.x = data.x;
            state.y = data.y;
          }
        }
        return state;
      }
    }
  } catch (err) {
    console.warn('[Electron] Failed to load window state:', err);
  }
  return defaultState;
}

function saveWindowState(win: BrowserWindow) {
  try {
    if (win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    };
    const file = getWindowStateFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Electron] Failed to save window state:', err);
  }
}

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
  const isRunning = await checkPortListening(BACKEND_PORT);
  if (isRunning) {
    console.log(`[Electron] Backend already listening on port ${BACKEND_PORT}.`);
    return;
  }

  freePort(BACKEND_PORT);
  console.log(`[Electron] Initializing LocalAI Core Backend in main process...`);
  try {
    let startBackendFn: any;
    if (app.isPackaged) {
      const prodBackend = await import('../dist/index.js');
      startBackendFn = prodBackend.startBackend;
    } else {
      try {
        const devBackend = await import('../src/index.js');
        startBackendFn = devBackend.startBackend;
      } catch {
        const prodBackend = await import('../dist/index.js');
        startBackendFn = prodBackend.startBackend;
      }
    }
    const { cleanup } = startBackendFn(BACKEND_PORT);
    backendCleanup = cleanup;
    console.log(`[Electron] LocalAI Core Backend started successfully on port ${BACKEND_PORT}.`);
  } catch (err) {
    console.error('[Electron] Failed to start internal backend:', err);
  }
}

function createTray() {
  if (tray) return;

  const candidateIcons = [
    path.join(__dirname, '../build-assets/32x32.png'),
    path.join(__dirname, '../build-assets/icon.ico'),
    path.join(__dirname, '../build-assets/icon.png'),
    path.join(process.resourcesPath || '', 'build-assets/32x32.png'),
    path.join(process.resourcesPath || '', 'build-assets/icon.ico'),
  ];

  let selectedIconPath = '';
  for (const candidate of candidateIcons) {
    if (fs.existsSync(candidate)) {
      selectedIconPath = candidate;
      break;
    }
  }

  try {
    const iconImage = selectedIconPath
      ? nativeImage.createFromPath(selectedIconPath)
      : nativeImage.createEmpty();

    tray = new Tray(iconImage);
    tray.setToolTip('LocalAI Studio - Native Local AI Server');

    const updateTrayMenu = () => {
      const isVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'LocalAI Studio',
          icon: iconImage.resize({ width: 16, height: 16 }),
          enabled: false,
        },
        {
          label: `Lõi AI Backend: Đang chạy (: ${BACKEND_PORT})`,
          enabled: false,
        },
        { type: 'separator' },
        {
          label: isVisible ? 'Ẩn vào khay hệ thống' : 'Mở LocalAI Studio',
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) {
              createWindow();
              return;
            }
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow.show();
              mainWindow.focus();
            }
            updateTrayMenu();
          },
        },
        {
          label: 'Mở Cài đặt & Model Hub',
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) {
              createWindow();
            } else {
              mainWindow.show();
              mainWindow.focus();
            }
            mainWindow?.webContents.send('open-settings');
            updateTrayMenu();
          },
        },
        { type: 'separator' },
        {
          label: 'Thoát hoàn toàn',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);
      tray?.setContextMenu(contextMenu);
    };

    updateTrayMenu();

    tray.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
      }
      if (mainWindow.isVisible()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      updateTrayMenu();
    });

    tray.on('double-click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
      }
      mainWindow.show();
      mainWindow.focus();
      updateTrayMenu();
    });
  } catch (err) {
    console.error('[Electron] Failed to initialize system tray:', err);
  }
}

async function createWindow() {
  // Hide default menu bar for clean modern app look
  Menu.setApplicationMenu(null);

  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    title: 'LocalAI Studio',
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
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

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  let saveStateTimer: NodeJS.Timeout | null = null;
  const debouncedSaveState = () => {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow);
      }
    }, 400);
  };

  mainWindow.on('resize', debouncedSaveState);
  mainWindow.on('move', debouncedSaveState);
  mainWindow.on('maximize', debouncedSaveState);
  mainWindow.on('unmaximize', debouncedSaveState);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Intercept window close to minimize to system tray instead of stopping background AI tasks
  mainWindow.on('close', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
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

// IPC Handlers for Native Dialogs & System Tray
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

ipcMain.handle('app:minimizeToTray', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  return true;
});

ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
  return true;
});

app.whenReady().then(async () => {
  // Allow In-App Web Preview iframe to load localhost and developer preview servers without X-Frame-Options denial
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    callback({ responseHeaders });
  });

  await startInternalBackend();
  await createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (tray) {
    try {
      tray.destroy();
    } catch {}
    tray = null;
  }
  if (backendCleanup) {
    try {
      await backendCleanup();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (isQuitting || process.platform === 'darwin') {
    app.quit();
  }
});
