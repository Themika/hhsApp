const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      nodeIntegration: false,    
      contextIsolation: true,
      // 🚨 FIX: Points directly and cleanly to preload.js in your main root folder
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'Templates/index.html'));
}

//AUTOMATED BACKEND DIRECT-WRITE ENGINE
ipcMain.handle('save-database-file', async (event, dataString) => {
  try {
    const targetPath = path.join(__dirname, 'Scripts', 'questions.txt');
    fs.writeFileSync(targetPath, dataString, 'utf8');
    return { success: true };
  } catch (error) {
    console.error("Failed to write to file natively:", error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});