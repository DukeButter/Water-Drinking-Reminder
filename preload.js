const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waterApp', {
  getState: () => ipcRenderer.invoke('get-state'),
  drinkWater: () => ipcRenderer.invoke('drink-water'),
  undoWater: () => ipcRenderer.invoke('undo-water'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  drawBlessing: () => ipcRenderer.invoke('draw-blessing'),
  buySkin: (skinId) => ipcRenderer.invoke('buy-skin', skinId),
  equipSkin: (skinId) => ipcRenderer.invoke('equip-skin', skinId),
  onStateChanged: (callback) => {
    ipcRenderer.on('state-changed', (_, state) => callback(state));
  }
});

