let QUESTIONS_CONFIG = [];
let currentStepTarget = null;
let activeDataFilePath = null;

let stagedTrialsArray = [];
let activeBulletPointsArr = [];
let stagedPdfData = null;
let stagedPdfPath = null;
let editingStepNumber = null;
let editingTrialIndex = null;
let editingBulletIndex = null;

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById('pdfUpload')?.addEventListener('change', handlePdfUpload);
    document.getElementById('importTxtInput')?.addEventListener('change', handleTxtImport);

    try {
        if (window.electronAPI && window.electronAPI.readData) {
            const savedData = await window.electronAPI.readData();
            if (savedData) {
                QUESTIONS_CONFIG = savedData;
                buildWorkflowUI();
                return;
            }
        }

        let protocolPath = 'questions.txt';
        if (window.location.pathname.includes('/Templates/')) protocolPath = '../Scripts/questions.txt';

        const response = await fetch(protocolPath);
        if (!response.ok) throw new Error("Could not find configuration registry database.");
        QUESTIONS_CONFIG = await response.json();
        buildWorkflowUI();
    } catch (err) {
        console.error("Initialization Error:", err);
        alert("Database Error: Could not locate configuration data.");
    }
});