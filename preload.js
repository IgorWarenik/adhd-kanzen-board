const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // ── Persistence (file-based, survives app restarts) ──────────────
  loadData:  ()      => ipcRenderer.invoke('load-data'),
  saveData:  (state) => ipcRenderer.send('save-data', state),
  clearData: ()      => ipcRenderer.send('clear-data'),

  // ── Login item / autolaunch ───────────────────────────────────────
  getLoginItem: ()        => ipcRenderer.invoke('get-login-item'),
  setLoginItem: (enable)  => ipcRenderer.send('set-login-item', enable),

  // ── Notifications ────────────────────────────────────────────────
  notifyDone:     (cardTitle)        => ipcRenderer.send('notify-done', cardTitle),
  notifyPomodoro: (cardTitle, phase) => ipcRenderer.send('notify-pomodoro', cardTitle, phase),
});
