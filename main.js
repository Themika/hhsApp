const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require("electron-updater");
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises; // Use promises for non-blocking I/O
app.disableHardwareAcceleration();

const userDataPath = path.join(app.getPath('temp'), 'hhsAppData');
const sessionDataPath = path.join(userDataPath, 'session');
const cacheDataPath = path.join(userDataPath, 'cache');

app.setPath('userData', userDataPath);
app.setPath('sessionData', sessionDataPath);
app.setPath('cache', cacheDataPath);

function logMainDebug(stage, details = {}) {
  console.log(`[HHS MAIN DEBUG] ${stage}`, details);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
try {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(sessionDataPath, { recursive: true });
  fs.mkdirSync(cacheDataPath, { recursive: true });
} catch (error) {
  console.error('Failed to prepare Electron data directories:', error);
}

app.on('ready', () => {
  // Check for updates immediately when the app opens
  autoUpdater.checkForUpdatesAndNotify();
});
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, height: 850,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      plugins: true 
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'Templates/index.html'));

  // mainWindow.focus() alone can silently fail to grab real keyboard focus
  // on Windows — Windows blocks background processes from stealing
  // foreground focus programmatically unless it came from a genuine user
  // interaction (its "foreground lock" protection). Showing the window on
  // 'ready-to-show' (Electron's recommended pattern) plus briefly toggling
  // always-on-top is a standard workaround that forces the OS to actually
  // hand the window real focus, instead of just looking focused while
  // keyboard input still routes nowhere.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.webContents.focus();
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.focus();
  });
}
app.whenReady().then(createWindow);

let importDialogOpen = false;

ipcMain.handle('pick-txt-import-file', async () => {
  if (importDialogOpen) {
    logMainDebug('pick-txt-import-file:ignoredConcurrentCall', {});
    return { success: false, canceled: true };
  }
  importDialogOpen = true;
  try {
    logMainDebug('pick-txt-import-file:start', { userDataPath });
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Text or JSON Files', extensions: ['txt', 'json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const data = await fsPromises.readFile(filePath, 'utf8');
    logMainDebug('pick-txt-import-file:success', { filePath, bytes: data.length });
    return { success: true, filePath, data };
  } catch (error) {
    logMainDebug('pick-txt-import-file:error', { error: error.message });
    return { success: false, error: error.message };
  } finally {
    importDialogOpen = false;
  }
});

// READ HANDLER - Updated to async[cite: 7]
ipcMain.handle('read-database-file', async () => {
  try {
    const targetPath = path.join(userDataPath, 'questions.txt');
    if (!fs.existsSync(targetPath)) return null;
    const data = await fsPromises.readFile(targetPath, 'utf8'); // Non-blocking read[cite: 7]
    return JSON.parse(data);
  } catch (error) { return null; }
});

ipcMain.handle('read-database-file-from-path', async (event, targetPath) => {
  try {
    if (!targetPath || !fs.existsSync(targetPath)) return null;
    const data = await fsPromises.readFile(targetPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
});

// SAVE HANDLER - Updated to async[cite: 7]
ipcMain.handle('save-database-file', async (event, rawData) => {
  try {
    const uploadDir = path.join(userDataPath, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    logMainDebug('save-database-file:start', { uploadDir, rawType: typeof rawData });

    let questionsArray = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    
    // Process PDF paths
    if (Array.isArray(questionsArray)) {
      questionsArray.forEach(step => {
        if (step.trials) step.trials.forEach(trial => {
          if (trial.contentType === 'pdf' && trial.localPdfPath) {
            const dest = path.join(uploadDir, path.basename(trial.localPdfPath));
            fs.copyFileSync(trial.localPdfPath, dest);
            trial.pdfPath = dest;
            delete trial.localPdfPath;
          }
        });
      });
    }

    // Non-blocking write[cite: 7]
    await fsPromises.writeFile(path.join(userDataPath, 'questions.txt'), JSON.stringify(questionsArray, null, 2));
    logMainDebug('save-database-file:success', { targetPath: path.join(userDataPath, 'questions.txt') });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
});
ipcMain.on('hhs-focus-log', (event, data) => {
    console.log('[HHS TERMINAL DEBUG]', data);
});

ipcMain.handle('save-database-file-to-path', async (event, targetPath, rawData) => {
  try {
    if (!targetPath) return { success: false, error: 'No file path provided.' };

    logMainDebug('save-database-file-to-path:start', { targetPath, rawType: typeof rawData });

    let questionsArray = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    await fsPromises.writeFile(targetPath, JSON.stringify(questionsArray, null, 2));
    logMainDebug('save-database-file-to-path:success', { targetPath });
    return { success: true };
  } catch (error) {
    logMainDebug('save-database-file-to-path:error', { targetPath, error: error.message });
    return { success: false, error: error.message };
  }
});

// PDF READ HANDLER
ipcMain.handle('read-pdf-file', async (event, filePath) => {
  try {
    const buffer = await fsPromises.readFile(filePath); // Non-blocking read[cite: 7]
    const base64Data = buffer.toString('base64');
    return { success: true, data: base64Data };
  } catch (error) { return { success: false, error: error.message }; }
});