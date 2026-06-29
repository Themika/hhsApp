const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveData: (data) => ipcRenderer.invoke('save-database-file', data),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath)
});