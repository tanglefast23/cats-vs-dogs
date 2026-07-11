// Electron shell for Cats vs Dogs: Backyard Battle.
// The renderer is the same code the browser runs — this file only hosts it.
// Security posture follows https://www.electronjs.org/docs/latest/tutorial/security

const { app, BrowserWindow, protocol, session, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEV_URL = 'http://127.0.0.1:4173';
const APP_ORIGIN = 'app://game';
const DIST_DIR = path.join(__dirname, '..', 'dist');

const isDev = process.argv.includes('--dev') && !app.isPackaged;
const isSmoke = process.argv.includes('--smoke');
const allowedOrigin = isDev ? DEV_URL : APP_ORIGIN;

// app:// gets a real, secure origin (unlike file://), so storage and fetch
// behave exactly as they do on the web build. Must be registered before ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Serve files strictly from dist/; anything else (including traversal) is a 404. */
function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const decoded = decodeURIComponent(pathname);
    const relative = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
    const target = path.normalize(path.join(DIST_DIR, relative));
    if (target !== DIST_DIR && !target.startsWith(DIST_DIR + path.sep)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function hardenSession() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

// Applies to every web contents the app ever creates, including any future ones.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(allowedOrigin)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#10242e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isSmoke) wireSmokeMode(win);

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadURL(`${APP_ORIGIN}/`);
  }
  return win;
}

/**
 * --smoke: print renderer console output, assert the renderer is fully
 * isolated (no Node/Electron globals), poke the shop once, then quit.
 * Used by CLI verification; harmless otherwise.
 */
function wireSmokeMode(win) {
  win.webContents.on('console-message', (eventOrDetails, level, message) => {
    if (typeof eventOrDetails === 'object' && eventOrDetails.message !== undefined) {
      console.log(`[renderer:${eventOrDetails.level}] ${eventOrDetails.message}`);
    } else {
      console.log(`[renderer:${level}] ${message}`);
    }
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      const checks = await win.webContents.executeJavaScript(`(() => {
        const before = document.querySelector('#bench-count')?.textContent;
        document.querySelector('.shop-card')?.click();
        return {
          url: location.href,
          title: document.title,
          nodeRequire: typeof window.require,
          nodeProcess: typeof window.process,
          electronGlobal: typeof window.electron,
          cells: document.querySelectorAll('.cell').length,
          shopCards: document.querySelectorAll('.shop-card').length,
          yardArtDrawn: (document.querySelector('#yard-art')?.width ?? 0) > 0,
          benchBefore: before,
          benchAfter: document.querySelector('#bench-count')?.textContent,
          fontLoaded: document.fonts.check('8px "Press Start 2P"'),
        };
      })()`);
      console.log('[smoke]', JSON.stringify(checks));
    } catch (error) {
      console.error('[smoke] failed:', error);
      process.exitCode = 1;
    }
    setTimeout(() => app.quit(), 400);
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  hardenSession();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isSmoke) app.quit();
});
