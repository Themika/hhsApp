let currentFileHandle = null; // Stores the file handle for "Pro" saving

function logImportDebug(stage, details = {}) {
    console.log(`[HHS DEBUG] ${stage}`, details);
}

async function commitDatabaseChangesToDisk() {
    const updatedDataString = JSON.stringify(QUESTIONS_CONFIG, null, 2);
    
    // 1. Existing Electron Support
    if (window.electronAPI && window.electronAPI.saveData) {
        const result = await window.electronAPI.saveData(updatedDataString);
        if (result && !result.success) alert("Backend disk write error: " + result.error);
        return;
    }

    // 2. "Pro" Web Implementation (File System Access API)
    if ('showSaveFilePicker' in window) {
        try {
            // If we don't have a handle, prompt for a save location
            if (!currentFileHandle) {
                currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: 'questions.txt',
                    types: [{ description: 'JSON File', accept: { 'application/json': ['.txt', '.json'] } }],
                });
            }

            // Write the data to the handle
            const writable = await currentFileHandle.createWritable();
            await writable.write(updatedDataString);
            await writable.close();
            logImportDebug('commitDatabaseChangesToDisk:savedNative', { path: currentFileHandle.name });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Save failed:', err);
                alert("Failed to save file: " + err.message);
            }
        }
    } else {
        // 3. Fallback for browsers without File System Access API
        downloadTxtFile();
    }
}

function downloadTxtFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(QUESTIONS_CONFIG, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "questions.txt");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

let __hhsImportInProgress = false;

async function triggerTxtImport() {
    // 1. Existing Electron Support
    if (window.electronAPI && window.electronAPI.pickTxtImportFile) {
        // ... (Keep your existing electronAPI logic here)
        return;
    }

    // 2. "Pro" Web Implementation
    if ('showOpenFilePicker' in window) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'JSON/Text Files', accept: { 'text/plain': ['.txt', '.json'] } }],
                multiple: false
            });
            
            const file = await handle.getFile();
            const content = await file.text();
            
            // Store the handle for future saves
            currentFileHandle = handle;
            
            applyImportedTxtPayload(content, file.name);
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Import failed:', err);
        }
    } else {
        // 3. Fallback: Standard Input
        document.getElementById('importTxtInput').click();
    }
}

// In storage-tools.js, update your applyImportedTxtPayload
function applyImportedTxtPayload(jsonString, filePath) {
    const importedData = JSON.parse(jsonString);
    QUESTIONS_CONFIG = importedData;
    
    // Explicitly update the global file path tracking
    activeDataFilePath = filePath; 

    // Sync to disk so subsequent edits have a target
    commitDatabaseChangesToDisk(); 
    
    // Force a fresh UI build
    buildWorkflowUI(); 
    
    // Ensure the editor view is cleared so it doesn't hold onto stale "draft" data
    closeControlPage(); 
    
    alert("✅ Data imported successfully.\n\nPlease close and relaunch the app for the imported changes to be fully editable.");
}

function handleTxtImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    logImportDebug('handleTxtImport:fileSelected', {
        name: file.name,
        type: file.type,
        size: file.size,
        hasPath: !!file.path
    });

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            applyImportedTxtPayload(e.target.result, file.path || null);
        } catch (err) {
            alert("Error importing: " + err.message);
        }
        if (event.target) {
            event.target.value = "";
        }
    };
    reader.readAsText(file);
}