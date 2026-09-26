import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'node:path';
import { captureCurrentDisplay } from './capture';
import { startGlobalShortcuts } from './hotkey';
import { authClient } from './auth/client';
import { storage } from '@better-auth/electron/storage';
import { handleDeepLink } from '@better-auth/electron/client';

const PROTOCOL = 'mimic';
const WEB_URL = process.env.MIMIC_WEB_URL ?? 'http://localhost:3000';
let mainWindow: BrowserWindow | null = null;
let overlayWindows: BrowserWindow[] = [];
let stopGlobalShortcuts: (() => void) | null = null;

function protectOverlay(win: BrowserWindow) {
  win.setContentProtection(true);
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function createOverlay(display: Electron.Display) {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  protectOverlay(win);

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    url.searchParams.set('overlay', '1');
    url.searchParams.set('displayId', String(display.id));
    void win.loadURL(url.toString());
  } else {
    void win.loadFile(
      path.join(__dirname, '../renderer/index.html'),
      {
        query: {
          overlay: '1',
          displayId: String(display.id),
        },
      },
    );
  }

  win.once('ready-to-show', () => win.showInactive());

  return win;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({ width: 900, height: 680, title: 'Mimic', webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadURL(WEB_URL);
  }
}

async function handleAuthDeepLink(url: string) {
  const callbackUrl = new URL(url);
  const token = callbackUrl.hash.startsWith('#token=')
    ? callbackUrl.hash.slice(7)
    : '';
  let callbackState = 'none';
  if (token) {
    try {
      const decoded = JSON.parse(
        Buffer.from(decodeURIComponent(token), 'base64url').toString('utf8'),
      );
      callbackState = decoded?.state ?? 'missing';
    } catch {
      callbackState = 'invalid';
    }
  }
  console.log('[Mimic auth] callback state:', callbackState);

  try {
    await handleDeepLink({
      $fetch: authClient.$fetch,
      options: {
        signInURL: `${WEB_URL}/`,
        protocol: {
          scheme: PROTOCOL,
        },
        storage: storage(),
        callbackPath: '/auth/callback',
      },
      url,
      getWindow: () => mainWindow,
    });

    console.log('[Mimic auth] deep link handled successfully');
    mainWindow?.show();
    mainWindow?.focus();
  } catch (error) {
    console.error('[Mimic auth] deep link failed:', error);
    mainWindow?.show();
    mainWindow?.focus();
  }
}

console.log('[Mimic auth] main process initialized');
console.log('[Mimic auth] execPath:', process.execPath);
console.log('[Mimic auth] argv:', process.argv);
authClient.setupMain();

if (process.platform === 'darwin' && !app.isPackaged) {
  const protocolRegistered = app.setAsDefaultProtocolClient(
    PROTOCOL,
    process.execPath,
    [path.resolve(process.argv[1] ?? '.')],
  );
  console.log('[Mimic auth] protocol registration:', protocolRegistered);
} else {
  const protocolRegistered = app.setAsDefaultProtocolClient(PROTOCOL);
  console.log('[Mimic auth] protocol registration:', protocolRegistered);
}
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.whenReady().then(() => { console.log("[Mimic userData]", app.getPath("userData"));
    createMainWindow();
    overlayWindows = screen.getAllDisplays().map(createOverlay);
    stopGlobalShortcuts = startGlobalShortcuts(() => { const point = screen.getCursorScreenPoint(); const display = screen.getDisplayNearestPoint(point); return overlayWindows.find((win) => { const [x, y] = win.getPosition(); return x === display.bounds.x && y === display.bounds.y; }) ?? overlayWindows[0] ?? null; });
    ipcMain.handle('mimic://capture-screen', captureCurrentDisplay);
    ipcMain.handle('mimic://api-base', () => WEB_URL.replace(/\/$/, ''));
    ipcMain.handle('mimic://set-overlay-interactive', (event, interactive: boolean) => { const target = overlayWindows.find((win) => win.webContents.id === event.sender.id); target?.setIgnoreMouseEvents(!interactive, { forward: true }); target?.setFocusable(interactive); if (interactive) target?.focus(); });
    ipcMain.handle('mimic://open-auth', () => ({ redirectTo: `${PROTOCOL}://auth/callback` }));
    ipcMain.handle('mimic://open-external', async (_event, url: string) => { await shell.openExternal(url); });
    const cursorTimer = setInterval(() => {
      const point = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(point);
      const local = { displayId: display.id, x: point.x - display.bounds.x, y: point.y - display.bounds.y };

      overlayWindows.forEach((win) => win.webContents.send('mimic://cursor', local));
    }, 16);
    app.on('before-quit', () => clearInterval(cursorTimer));
    screen.on('display-added', () => { /* full display-rebuild is handled in Phase 2 polish */ });
    app.on('activate', () => { if (!mainWindow) createMainWindow(); });
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('[Mimic auth] open-url received:', url.startsWith(`${PROTOCOL}://`));
    if (url.startsWith(`${PROTOCOL}://`)) void handleAuthDeepLink(url);
  });
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    console.log('[Mimic auth] second-instance received:', Boolean(url));
    if (url) void handleAuthDeepLink(url);
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { stopGlobalShortcuts?.(); overlayWindows.forEach((win) => win.destroy()); overlayWindows = []; });
}
