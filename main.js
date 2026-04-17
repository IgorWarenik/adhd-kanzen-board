const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

// ─── DATA FILE ────────────────────────────────────────────────────
// Stored in ~/Library/Application Support/kaizen-board/state.json
const DATA_DIR  = app.getPath('userData');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read state:', e);
  }
  return null;
}

function writeData(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error('Failed to write state:', e);
  }
}

// ─── WINDOW ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#111110',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  // On macOS closing the window hides it (app stays in dock)
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── IPC: data persistence ────────────────────────────────────────
ipcMain.handle('load-data', () => readData());

ipcMain.on('save-data', (_event, data) => writeData(data));

ipcMain.on('clear-data', () => {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
    console.log('State cleared:', DATA_FILE);
  } catch (e) { console.error('clear-data error:', e); }
});

// ─── IPC: login item (autolaunch) ────────────────────────────────
ipcMain.handle('get-login-item', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-login-item', (_event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true,   // start minimised / in background on macOS
  });
});

// ─── IPC: macOS notifications ─────────────────────────────────────
ipcMain.on('notify-done', (_event, cardTitle) => {
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Kaizen — Done ✓',
    body:  `"${cardTitle}" — all subtasks completed`,
    silent: false,
  }).show();
});

ipcMain.on('notify-pomodoro', (_event, cardTitle, phase) => {
  if (!Notification.isSupported()) return;
  const isFocus = phase === 'focus';
  new Notification({
    title: isFocus ? 'Kaizen — Focus 🍅' : 'Kaizen — Break ☕',
    body:  isFocus
      ? `Work on "${cardTitle}" — 25 minutes`
      : `Break time — step away from "${cardTitle}"`,
    silent: false,
  }).show();
});

// ─── APP LIFECYCLE ────────────────────────────────────────────────
app.whenReady().then(createWindow);

// Re-show window when clicking dock icon
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

// On macOS we never quit via window-all-closed; quit only via Cmd+Q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Ensure data is written synchronously before process exits
app.on('before-quit', () => {
  // Remove close-prevention so the window actually closes on quit
  if (mainWindow) mainWindow.removeAllListeners('close');
});
