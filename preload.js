const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveData: (data) => ipcRenderer.invoke('save-database-file', data),
  saveDataToPath: (filePath, data) => ipcRenderer.invoke('save-database-file-to-path', filePath, data),
  pickTxtImportFile: () => ipcRenderer.invoke('pick-txt-import-file'),
  readDataFromPath: (filePath) => ipcRenderer.invoke('read-database-file-from-path', filePath),
  readData: () => ipcRenderer.invoke('read-database-file'),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath)
});