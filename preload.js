const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waterApp', {
  getState: () => ipcRenderer.invoke('get-state'),
  drinkWater: () => ipcRenderer.invoke('drink-water'),
  undoWater: () => ipcRenderer.invoke('undo-water'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  onStateChanged: (callback) => {
    ipcRenderer.on('state-changed', (_, state) => callback(state));
  }
});
