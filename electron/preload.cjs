const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  openUploadsFolder: () => ipcRenderer.invoke('open-uploads-folder'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
