const {app, BrowserWindow, Menu, dialog, protocol, session, screen, powerSaveBlocker} = require('electron');
const path = require('node:path');
const {readFile} = require('node:fs/promises');
const {ORIGIN, CSP, MIME, isLocal, assetPath, allowPermission} = require('./policy.cjs');

protocol.registerSchemesAsPrivileged([{scheme: 'cyber-runner', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
}}]);
app.setName('Cyber Runner');
app.setAppUserModelId('lk.rashmika.cyberrunner');
// A separate data directory also lets automated checks leave exhibition calibration untouched.
const qaData = process.argv.find(a => a.startsWith('--user-data-dir='));
if (qaData) app.setPath('userData', path.resolve(qaData.slice('--user-data-dir='.length)));
if (!app.requestSingleInstanceLock()) app.quit();
else start();

let mainWindow;
let quitting = false;
let wakeLock;
const windows = new Set();

function safePreferences() {
  return {nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
    backgroundThrottling: false, spellcheck: false};
}

function wireWindow(win) {
  windows.add(win);
  win.setMenuBarVisibility(false);
  win.webContents.on('will-navigate', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  win.webContents.on('will-redirect', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  win.webContents.setWindowOpenHandler(({url, frameName}) => ({
    action: (isLocal(url) || url === 'about:blank') && /^cyber-runner-(controls|game)-[a-zA-Z0-9-]{8,80}$/.test(frameName) ? 'allow' : 'deny',
    overrideBrowserWindowOptions: {backgroundColor: '#0b1319', icon: path.join(__dirname, 'icon.png'),
      autoHideMenuBar: true, minWidth: 900, minHeight: 640, webPreferences: safePreferences()},
  }));
  win.webContents.on('did-create-window', (child, {frameName}) => {
    wireWindow(child);
    if (frameName.startsWith('cyber-runner-controls-')) arrangeScreens(win, child);
    else arrangeScreens(child, win);
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { event.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    if (input.key === 'Escape' && win.isFullScreen()) { event.preventDefault(); win.setFullScreen(false); }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting && details.reason !== 'clean-exit') dialog.showMessageBox(win, {type: 'error', title: 'Cyber Runner',
      message: 'The game window stopped responding.', detail: 'Close and reopen Cyber Runner. If this repeats, select Performance graphics.'});
  });
  win.on('closed', () => { windows.delete(win); });
}

function arrangeScreens(game, controls) {
  const primary = screen.getPrimaryDisplay();
  const external = screen.getAllDisplays().find(d => d.id !== primary.id);
  if (!external) return;
  for (const [win, display] of [[controls, primary], [game, external]]) {
    if (win.isFullScreen()) win.setFullScreen(false);
    win.unmaximize(); win.setBounds(display.workArea); win.maximize();
  }
}

async function exhibitionMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  await mainWindow.webContents.executeJavaScript("document.getElementById('separateScreens')?.click()", true);
}

function createMain() {
  const area = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({width: Math.min(1600, area.width), height: Math.min(950, area.height),
    minWidth: Math.min(1000, area.width), minHeight: Math.min(680, area.height), show: false,
    backgroundColor: '#0b1319', icon: path.join(__dirname, 'icon.png'), webPreferences: safePreferences()});
  wireWindow(mainWindow);
  mainWindow.once('ready-to-show', () => { mainWindow.maximize(); mainWindow.show(); });
  mainWindow.on('closed', () => { mainWindow = null; if (!quitting) app.quit(); });
  void mainWindow.loadURL(ORIGIN + '/').catch(error => {
    dialog.showErrorBox('Cyber Runner could not open', error.message); app.quit();
  });
}

async function start() {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => app.quit());
  await app.whenReady();
  try {
    const root = path.join(app.getAppPath(), 'public');
    protocol.handle('cyber-runner', async request => {
      const file = assetPath(root, request.url);
      if (!file || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', {status: 404});
      try {
        const body = await readFile(file);
        return new Response(request.method === 'HEAD' ? null : body, {headers: {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache',
        }});
      } catch { return new Response('Not found', {status: 404}); }
    });
    const ses = session.defaultSession;
    // Runtime is entirely local; neither renderer can send camera data to a remote host.
    ses.webRequest.onBeforeRequest((details, callback) => {
      callback({cancel: !isLocal(details.url) && !/^(data:|blob:)/.test(details.url)});
    });
    ses.setPermissionCheckHandler((contents, permission, origin, details) =>
      allowPermission(contents?.getURL() || origin, permission, details));
    ses.setPermissionRequestHandler((contents, permission, callback, details) =>
      callback(allowPermission(contents?.getURL(), permission, details)));
    ses.on('will-download', event => event.preventDefault());
    wakeLock = powerSaveBlocker.start('prevent-display-sleep');
    app.on('will-quit', () => { if (powerSaveBlocker.isStarted(wakeLock)) powerSaveBlocker.stop(wakeLock); });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label: 'Game', submenu: [
        {label: 'Exhibition mode — two screens', accelerator: 'Ctrl+Shift+E', click: () => void exhibitionMode()},
        {label: 'Full screen', accelerator: 'F11', click: (_item, win) => win?.setFullScreen(!win.isFullScreen())},
        {type: 'separator'}, {role: 'quit', label: 'Exit Cyber Runner'},
      ]},
      {label: 'Help', submenu: [
        {label: 'How to play', click: () => void dialog.showMessageBox({title: 'Play Cyber Runner', message: 'Step into the game',
          detail: 'Keyboard: A/D or ←/→ to move, Space/↑ to jump, S/↓ to duck. Enter starts and P pauses.\n\nBody controls: enable the camera, set the tracking area and align the three lane guides. Stand still until Player locked, then hold a hand beside your face for one second. You can also choose Start manually before anyone is visible.\n\nTwo screens: extend your Windows display (Win+P), then choose Separate screens. Game goes to the external display; camera and controls stay on the primary display. Keep both windows visible. F11 enters full screen; Escape exits.\n\nEverything runs offline. A webcam is optional for keyboard play.'})},
        {label: 'About Cyber Runner', click: () => void dialog.showMessageBox({title: 'Cyber Runner', message: 'Cyber Runner ' + app.getVersion(),
          detail: 'Created by Rashmika Nishshanka\nOffline motion-controlled exhibition runner.\n\nThird-party notices and the player guide are included in the download. No camera video is uploaded.'})},
      ]},
    ]));
    createMain();
  } catch (error) { dialog.showErrorBox('Cyber Runner could not start', error.stack || error.message); app.quit(); }
}
