const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const userDataPath = app.getPath('userData'); // This is the writable location
if (process.env.NODE_ENV === 'development') {
  autoUpdater.forceDevUpdateConfig = true;
}
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      nodeIntegration: false,    
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') ,
      contextIsolation: true,                     
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'Templates/index.html'));
}


app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
ipcMain.handle('save-database-file', async (event, rawData) => {
  try {
    const uploadDir = path.join(userDataPath, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    // Dynamic Safe Parse: handles either raw array mutations or pre-stringified blocks smoothly
    let questionsArray = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    if (Array.isArray(questionsArray)) {
      questionsArray.forEach(step => {
        if (step.trials && Array.isArray(step.trials)) {
          step.trials.forEach(trial => {
            if (trial.contentType === 'pdf' && trial.localPdfPath) {
              const fileName = path.basename(trial.localPdfPath);
              const destination = path.join(uploadDir, fileName);
              
              // Physically archive file to persistent local storage folder
              fs.copyFileSync(trial.localPdfPath, destination);
              
              trial.pdfPath = destination; // Track the new absolute path location
              delete trial.localPdfPath;   // Drop temporary staging memory handle
            }
          });
        }
      });
    }

    const targetPath = fs.existsSync(path.join(userDataPath, 'Scripts'))
      ? path.join(userDataPath, 'Scripts', 'questions.txt')
      : path.join(userDataPath, 'questions.txt');

    // FIX: Stringify the array safely right before writing to native fs disk layers
    const serializedOutput = JSON.stringify(questionsArray, null, 2);
    fs.writeFileSync(targetPath, serializedOutput);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-pdf-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: buffer };
  } catch (error) {
    return { success: false, error: error.message };
  }
});