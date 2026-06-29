let QUESTIONS_CONFIG = [];
let currentStepTarget = null;

// Temporary staging state holders for editing/creating step options
let stagedTrialsArray = []; 
let activeBulletPointsArr = []; 
let stagedPdfData = null; // Caches Base64 file data strings securely
let editingStepNumber = null; 
let editingTrialIndex = null; 
let editingBulletIndex = null; 

document.addEventListener("DOMContentLoaded", () => {
    let protocolPath = 'questions.txt'; 
    
    if (window.location.pathname.includes('/Templates/')) {
        protocolPath = '../Scripts/questions.txt';
    } else if (window.location.protocol === 'file:') {
        protocolPath = '../Scripts/questions.txt';
    }
    
    fetch(protocolPath)
        .then(response => {
            if (!response.ok) {
                return fetch('../Scripts/questions.txt');
            }
            return response;
        })
        .then(response => {
            if (!response.ok) throw new Error("Could not find configuration registry database.");
            return response.json();
        })
        .then(data => {
            QUESTIONS_CONFIG = data;
            buildWorkflowUI();
        })
        .catch(err => {
            console.error("Fetch Error details:", err);
            alert("Database Error: Cannot locate or load 'questions.txt'. Ensure the file exists inside your hhsApp/Scripts/ folder!");
        });

    // Wire up file selectors on load
    const pdfUploadInput = document.getElementById('pdfUpload');
    if (pdfUploadInput) {
        pdfUploadInput.addEventListener('change', handlePdfUpload);
    }

    const importTxtInput = document.getElementById('importTxtInput');
    if (importTxtInput) {
        importTxtInput.addEventListener('change', handleTxtImport);
    }
});

function buildWorkflowUI() {
    const container = document.getElementById("dynamicQuestionsContainer");
    container.innerHTML = ""; 
    
    QUESTIONS_CONFIG.sort((a, b) => a.step - b.step);

    QUESTIONS_CONFIG.forEach((q) => {
        const card = document.createElement("div");
        card.className = `step-card ${q.step === 1 ? 'active-card' : 'hidden'}`;
        card.id = `cardStep-${q.step}`;
        card.innerHTML = `
            <div class="card-num">${String(q.step).padStart(2, '0')}</div>
            <div class="question-body">
                <div class="card-title-row" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${q.title}</h3>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="edit-step-inline-btn" style="background: #e2e8f0; color: #334155;" onclick="openControlPage(true, ${q.step})">✏️ Edit Step & Options</button>
                        <button type="button" class="delete-step-inline-btn" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;" onclick="deleteExistingStep(${q.step})">🗑️ Delete Step</button>
                    </div>
                </div>
                <p class="question-prompt">${q.prompt}</p>
                <div class="action-buttons">
                    <button type="button" class="btn btn-yes" id="btn-yes-${q.step}" onclick="processChoice(${q.step}, true)">Yes</button>
                    <button type="button" class="btn btn-no" id="btn-no-${q.step}" onclick="processChoice(${q.step}, false)">No</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function handleUnifiedAddStepClick() {
    if (QUESTIONS_CONFIG.length === 0) {
        openControlPage(false);
        return;
    }
    const nextEndStepNum = QUESTIONS_CONFIG[QUESTIONS_CONFIG.length - 1].step + 1;
    const choice = prompt(
        `Where would you like to place this new step?\n\n` +
        `• Press ENTER or type "${nextEndStepNum}" to add it to the VERY END.\n` +
        `• Type any number between 1 and ${QUESTIONS_CONFIG.length} to INSERT it in-between existing steps.`
    );
    if (choice === null) return; 
    const cleanChoice = choice.trim();
    if (cleanChoice === "") {
        openControlPage(false);
        return;
    }
    const targetPos = parseInt(cleanChoice);
    if (isNaN(targetPos) || targetPos < 1 || targetPos > nextEndStepNum) {
        alert("Invalid step position selected. Action cancelled.");
        return;
    }
    if (targetPos === nextEndStepNum) {
        openControlPage(false);
    } else {
        openControlPage(false, null, targetPos);
    }
}

function deleteExistingStep(stepNum) {
    const confirmation = confirm(`Are you absolutely sure you want to delete Step #${stepNum}?\nThis will remove its trial criteria entirely and automatically fix the routing flow mapping layout for all remaining steps.`);
    if (!confirmation) return;
    const targetIndex = QUESTIONS_CONFIG.findIndex(q => q.step === stepNum);
    if (targetIndex === -1) return;
    QUESTIONS_CONFIG.splice(targetIndex, 1);
    QUESTIONS_CONFIG.sort((a, b) => a.step - b.step);
    QUESTIONS_CONFIG.forEach((q, idx) => {
        q.step = idx + 1;
        q.ifNoGoToStep = (idx < QUESTIONS_CONFIG.length - 1) ? (idx + 2) : null;
    });
    commitDatabaseChangesToDisk();
    buildWorkflowUI();
}

function processChoice(stepNum, isYes) {
    const config = QUESTIONS_CONFIG.find(q => q.step === stepNum);
    document.getElementById(`btn-yes-${stepNum}`).classList.toggle('selected', isYes);
    document.getElementById(`btn-no-${stepNum}`).classList.toggle('selected', !isYes);
    clearDownstreamCards(stepNum);

    if (isYes) {
        displayTrialPayload(config.trials, config.ifNoGoToStep);
    } else {
        hideResultsPanel();
        if (config.ifNoGoToStep) {
            activateStepCard(config.ifNoGoToStep);
        } else {
            alert("Protocol processing complete. No further actions required.");
        }
    }
}

function displayTrialPayload(trialsArray, nextStepPointer) {
    const resultsCard = document.getElementById('cardResults');
    const contentArea = document.getElementById('resultsContent');
    const continueBtn = document.getElementById('continueBtn');
    const badge = document.getElementById('matchBadge');
    
    currentStepTarget = nextStepPointer;
    badge.textContent = `${trialsArray ? trialsArray.length : 0} Target Trial Match(es)`;

    // Cache match objects into global scope for references
    window.activeMatchesRuntimeCache = trialsArray || [];

    if(!trialsArray || trialsArray.length === 0) {
        contentArea.innerHTML = `<div class="trial-panel">No active open trial profiles map directly to this setting.</div>`;
    } else {
        contentArea.innerHTML = trialsArray.map((trial, index) => `
            <div class="trial-panel" style="margin-bottom: 15px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div class="trial-title-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span class="trial-name" style="font-weight: bold; font-size: 16px; color: #1e3a8a;">${trial.name}</span>
                    <span class="trial-contact" style="font-size: 13px; color: #64748b;">${trial.contact}</span>
                </div>
                <div class="trial-desc" style="font-size: 14px; color: #334155; margin-bottom: 10px;">${trial.desc}</div>
                
                ${trial.criteria && trial.criteria.length > 0 ? `
                    <ul class="trial-crit-list" style="margin-bottom: 10px; padding-left: 20px;">
                        ${trial.criteria.map(c => `<li style="font-size: 13px; color: #475569; margin-bottom: 2px;">${c}</li>`).join('')}
                    </ul>
                ` : ''}

                ${trial.pdfData ? `
                    <div class="pdf-action-block" style="margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                        <button type="button" class="ctrl-btn" style="background: #2563eb; color: white; padding: 8px 14px; border-radius: 4px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;" onclick="openFullscreenPdfViewer(${index})">
                            📄 View Full Screen Protocol Document
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    resultsCard.classList.remove('hidden');
    continueBtn.classList.toggle('hidden', nextStepPointer === null);
}

// Overlay Framework Handlers
window.openFullscreenPdfViewer = function(cachedIndex) {
    const trialObj = window.activeMatchesRuntimeCache ? window.activeMatchesRuntimeCache[cachedIndex] : null;
    if (!trialObj || !trialObj.pdfData) {
        alert("Execution Error: No protocol asset string mapped for this entry reference.");
        return;
    }
    const overlay = document.getElementById('fullscreenPdfOverlay');
    const frame = document.getElementById('fullscreenPdfFrame');
    const titleLabel = document.getElementById('fullscreenPdfTitle');
    
    if (overlay && frame && titleLabel) {
        titleLabel.textContent = `Protocol Reference Map — ${trialObj.name}`;
        frame.src = trialObj.pdfData;
        overlay.style.display = 'flex';
    }
};

window.closeFullscreenPdfViewer = function() {
    const overlay = document.getElementById('fullscreenPdfOverlay');
    const frame = document.getElementById('fullscreenPdfFrame');
    if (overlay && frame) {
        overlay.style.display = 'none';
        frame.src = "";
    }
};

function openControlPage(isEditMode = false, targetStepId = null, insertionPosition = null) {
    document.getElementById('screeningView').classList.add('hidden');
    document.getElementById('creatorView').classList.remove('hidden');
    
    clearDraftOptionForm();

    if (isEditMode && targetStepId !== null) {
        editingStepNumber = targetStepId;
        document.getElementById('pageViewModeTitle').textContent = "Protocol Stage Editor";
        document.getElementById('managementActionLabel').textContent = "Modify";
        document.getElementById('routingEngineHelperText').textContent = "Modifying parameters inside an existing runtime structural workflow step.";
        document.getElementById('formSubmitBtn').textContent = "Save and Update Protocol Step & Options";

        const stepData = QUESTIONS_CONFIG.find(q => q.step === targetStepId);
        document.getElementById('autoStepBadge').textContent = `Step #${targetStepId}`;
        document.getElementById('autoStepBadge').dataset.stepval = targetStepId;
        document.getElementById('newTitle').value = stepData.title;
        document.getElementById('newPrompt').value = stepData.prompt;

        stagedTrialsArray = stepData.trials ? JSON.parse(JSON.stringify(stepData.trials)) : [];
    } else {
        editingStepNumber = null;
        document.getElementById('pageViewModeTitle').textContent = "Protocol Stage Configurator";
        document.getElementById('managementActionLabel').textContent = "Create";
        document.getElementById('formSubmitBtn').textContent = "Save Complete Step with Options";

        let assignedPositionNum;
        if (insertionPosition !== null) {
            assignedPositionNum = insertionPosition;
            document.getElementById('routingEngineHelperText').textContent = `Inserting a mid-chain step sequence explicitly at Position #${insertionPosition}. Steps downstream will be offset automatically.`;
            document.getElementById('autoStepBadge').dataset.isInsertion = "true";
        } else {
            QUESTIONS_CONFIG.sort((a, b) => a.step - b.step);
            assignedPositionNum = QUESTIONS_CONFIG.length > 0 ? QUESTIONS_CONFIG[QUESTIONS_CONFIG.length - 1].step + 1 : 1;
            document.getElementById('routingEngineHelperText').textContent = "The system automatically links this new step into the end of your protocol chain.";
            document.getElementById('autoStepBadge').dataset.isInsertion = "false";
        }
        
        document.getElementById('autoStepBadge').textContent = `Step #${assignedPositionNum}`;
        document.getElementById('autoStepBadge').dataset.stepval = assignedPositionNum;
        
        stagedTrialsArray = [];
    }
    
    renderQueuedTrialsList();
}

function closeControlPage() {
    document.getElementById('creatorView').classList.add('hidden');
    document.getElementById('screeningView').classList.remove('hidden');
    document.querySelectorAll('#creatorView input, #creatorView textarea').forEach(el => el.value = "");
    delete document.getElementById('autoStepBadge').dataset.isInsertion;
    stagedTrialsArray = [];
    activeBulletPointsArr = [];
    stagedPdfData = null;
    editingStepNumber = null;
    editingTrialIndex = null;
    editingBulletIndex = null;
    renderQueuedTrialsList();
}

function addBulletPointToDraft() {
    const field = document.getElementById('bulletInput');
    const rawValue = field.value.trim();
    if(!rawValue) return;

    if (editingBulletIndex !== null) {
        activeBulletPointsArr[editingBulletIndex] = rawValue;
        editingBulletIndex = null;
        document.querySelector('.add-bullet-btn').textContent = "+ Add Bullet";
    } else {
        activeBulletPointsArr.push(rawValue);
    }
    
    field.value = "";
    renderBulletDraftPreview();
}

function renderBulletDraftPreview() {
    const container = document.getElementById('bulletPreviewList');
    container.innerHTML = activeBulletPointsArr.map((str, index) => `
        <li style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; padding:6px 10px; margin-bottom:4px; border-radius:4px;">
            <span style="font-size:13px; color:#334155;">&bull; ${str}</span>
            <div style="display:flex; gap:4px;">
                <button type="button" class="edit-bullet-btn" style="background:none; border:none; color:#2563eb; cursor:pointer; font-size:12px;" onclick="editDraftBullet(${index})">✏️</button>
                <button type="button" class="del-bullet-btn" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:14px; font-weight:bold;" onclick="removeDraftBullet(${index})">&times;</button>
            </div>
        </li>
    `).join('');
}

function editDraftBullet(index) {
    editingBulletIndex = index;
    const field = document.getElementById('bulletInput');
    field.value = activeBulletPointsArr[index];
    document.querySelector('.add-bullet-btn').textContent = "💾 Save Bullet";
    field.focus();
}

function removeDraftBullet(index) {
    if (editingBulletIndex === index) {
        editingBulletIndex = null;
        document.getElementById('bulletInput').value = "";
        document.querySelector('.add-bullet-btn').textContent = "+ Add Bullet";
    }
    activeBulletPointsArr.splice(index, 1);
    renderBulletDraftPreview();
}

function editOptionFromStepQueue(index) {
    editingTrialIndex = index;
    const trial = stagedTrialsArray[index];

    document.getElementById('trialDraftingCard').classList.add('editing-active-pulse');
    document.getElementById('trialFormActionHeading').innerHTML = `✏️ Modify Trial Option: <strong>${trial.name}</strong>`;
    document.getElementById('commitTrialBtn').textContent = "Apply Changes to Option";
    document.getElementById('cancelTrialEditBtn').classList.remove('hidden');

    document.getElementById('tName').value = trial.name;
    document.getElementById('tContact').value = trial.contact;
    document.getElementById('tDesc').value = trial.desc;
    
    activeBulletPointsArr = trial.criteria ? [...trial.criteria] : [];
    renderBulletDraftPreview();

    stagedPdfData = trial.pdfData || null;
    const pdfViewer = document.getElementById('pdfViewer');
    if (stagedPdfData && pdfViewer) {
        pdfViewer.innerHTML = `<iframe src="${stagedPdfData}" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;"></iframe>`;
        document.getElementById('contentModeSwitcher').value = 'pdf';
    } else {
        document.getElementById('contentModeSwitcher').value = 'bullets';
    }
    toggleContentMode();
    
    document.getElementById('trialDraftingCard').scrollIntoView({ behavior: 'smooth' });
}

function commitOptionToStepQueue() {
    const name = document.getElementById('tName').value.trim();
    const contact = document.getElementById('tContact').value.trim() || "N/A";
    const desc = document.getElementById('tDesc').value.trim() || "No descriptive notes recorded.";

    if (!name) {
        alert("To attach a trial option block, you must input a 'Trial Program Name'.");
        return;
    }

    const compiledTrialPayload = {
        name: name,
        contact: contact,
        desc: desc,
        criteria: [...activeBulletPointsArr],
        pdfData: stagedPdfData
    };

    if (editingTrialIndex !== null) {
        stagedTrialsArray[editingTrialIndex] = compiledTrialPayload;
    } else {
        stagedTrialsArray.push(compiledTrialPayload);
    }

    clearDraftOptionForm();
    renderQueuedTrialsList();
}

function renderQueuedTrialsList() {
    const container = document.getElementById('queuedTrialsContainer');
    if (stagedTrialsArray.length === 0) {
        container.innerHTML = `<p class="empty-state-text">No trial allocation options attached to this step yet.</p>`;
        return;
    }

    container.innerHTML = stagedTrialsArray.map((trial, index) => `
        <div class="queued-trial-item-row">
            <div class="queued-item-meta">
                <strong>${trial.name}</strong> <span style="color:#64748b; font-size:12px;">(${trial.contact})</span>
                <div style="font-size:12px; color:#475569; margin-top:2px;">${trial.desc}</div>
                <div style="font-size:11px; color:#3b82f6; margin-top:2px;">
                    ${trial.pdfData ? '📄 Linked directly to internal reference protocol document.' : `• Includes ${trial.criteria ? trial.criteria.length : 0} criteria items.`}
                </div>
            </div>
            <div class="queued-item-control-buttons">
                <button type="button" class="edit-option-inline-btn" onclick="editOptionFromStepQueue(${index})">✏️ Edit Option</button>
                <button type="button" class="remove-option-from-queue-btn" onclick="removeOptionFromStepQueue(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

function removeOptionFromStepQueue(index) {
    if (editingTrialIndex === index) {
        clearDraftOptionForm();
    }
    stagedTrialsArray.splice(index, 1);
    renderQueuedTrialsList();
}

function clearDraftOptionForm() {
    document.getElementById('tName').value = "";
    document.getElementById('tContact').value = "";
    document.getElementById('tDesc').value = "";
    document.getElementById('bulletInput').value = "";
    const fileSelectorInput = document.getElementById('pdfUpload');
    if (fileSelectorInput) fileSelectorInput.value = "";
    
    activeBulletPointsArr = [];
    stagedPdfData = null;
    editingTrialIndex = null;
    editingBulletIndex = null;
    document.getElementById('bulletPreviewList').innerHTML = "";
    
    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        pdfViewer.innerHTML = `<p style="color: #64748b; text-align: center; padding-top: 80px;">No document uploaded yet. Select a PDF file above to load the internal workflow previewer.</p>`;
    }

    document.querySelector('.add-bullet-btn').textContent = "+ Add Bullet";
    document.getElementById('trialDraftingCard').classList.remove('editing-active-pulse');
    document.getElementById('trialFormActionHeading').innerHTML = "➕ Add / Draft a Trial Option";
    document.getElementById('commitTrialBtn').textContent = "Attach Option to Step Data Matrix";
    document.getElementById('cancelTrialEditBtn').classList.add('hidden');
}

function saveNewStepAndReturn() {
    const computedStep = parseInt(document.getElementById('autoStepBadge').dataset.stepval);
    const title = document.getElementById('newTitle').value.trim();
    const prompt = document.getElementById('newPrompt').value.trim();
    const isInsertion = document.getElementById('autoStepBadge').dataset.isInsertion === "true";

    if (!title || !prompt) {
        alert("Validation Fault: A Stage Section Title and Clinical Question Prompt description are required parameters.");
        return;
    }

    let stepToFocus = computedStep;

    if (editingStepNumber !== null) {
        stepToFocus = editingStepNumber;
        const targetIdx = QUESTIONS_CONFIG.findIndex(q => q.step === editingStepNumber);
        if (targetIdx !== -1) {
            const originalNextPointer = QUESTIONS_CONFIG[targetIdx].ifNoGoToStep;
            QUESTIONS_CONFIG[targetIdx] = { step: editingStepNumber, title, prompt, ifNoGoToStep: originalNextPointer, trials: [...stagedTrialsArray] };
        }
    } else if (isInsertion) {
        QUESTIONS_CONFIG.forEach(q => {
            if (q.step >= computedStep) {
                q.step += 1;
            }
        });
        QUESTIONS_CONFIG.push({ step: computedStep, title, prompt, ifNoGoToStep: null, trials: [...stagedTrialsArray] });
    } else {
        if (QUESTIONS_CONFIG.length > 0) {
            QUESTIONS_CONFIG.sort((a, b) => a.step - b.step);
            QUESTIONS_CONFIG[QUESTIONS_CONFIG.length - 1].ifNoGoToStep = computedStep;
        }
        QUESTIONS_CONFIG.push({ step: computedStep, title, prompt, ifNoGoToStep: null, trials: [...stagedTrialsArray] });
    }
    
    QUESTIONS_CONFIG.sort((a, b) => a.step - b.step);
    QUESTIONS_CONFIG.forEach((q, idx) => {
        q.ifNoGoToStep = (idx < QUESTIONS_CONFIG.length - 1) ? (QUESTIONS_CONFIG[idx + 1].step) : null;
    });

    commitDatabaseChangesToDisk();
    buildWorkflowUI();
    closeControlPage();

    const modifiedCard = document.getElementById(`cardStep-${stepToFocus}`);
    if (modifiedCard) {
        modifiedCard.classList.remove('hidden');
        modifiedCard.classList.add('active-card');
        modifiedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function commitDatabaseChangesToDisk() {
    const updatedDataString = JSON.stringify(QUESTIONS_CONFIG, null, 2);
    if (window.electronAPI && window.electronAPI.saveData) {
        window.electronAPI.saveData(updatedDataString)
            .then(result => {
                if (result && !result.success) alert("Automated backend disk write error: " + result.error);
            });
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

// 📂 TEXT FILE METADATA IMPORT INTERCEPTOR ENGINE
function triggerTxtImport() {
    document.getElementById('importTxtInput').click();
}

function handleTxtImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedPayload = JSON.parse(e.target.result);
            if (!Array.isArray(importedPayload)) {
                throw new Error("Target payload structural matrix must be formatted as an array list sequence.");
            }

            // Bind parsed dataset structure directly into global context schema configuration
            QUESTIONS_CONFIG = importedPayload;
            QUESTIONS_CONFIG.sort((a, b) => a.step - b.step);

            // Re-sequence structural flow pointers safely
            QUESTIONS_CONFIG.forEach((q, idx) => {
                q.ifNoGoToStep = (idx < QUESTIONS_CONFIG.length - 1) ? (QUESTIONS_CONFIG[idx + 1].step) : null;
            });

            commitDatabaseChangesToDisk();
            buildWorkflowUI();
            hideResultsPanel();
            
            alert("📂 Configuration File Successfully Imported! Your screening workflow has been refreshed.");
        } catch (err) {
            console.error("Import failure execution route trace logic exception:", err);
            alert("Import Failure: Invalid text dataset format. Please ensure that you select a valid configuration text file exported from this workflow app.");
        }
        // Flush structural input state reference to allow re-selection
        event.target.value = "";
    };
    reader.readAsText(file);
}

function advanceWorkflow() { if (currentStepTarget) activateStepCard(currentStepTarget); hideResultsPanel(); }
function activateStepCard(stepId) {
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active-card'));
    const targetCard = document.getElementById(`cardStep-${stepId}`);
    if (targetCard) { targetCard.classList.remove('hidden'); targetCard.classList.add('active-card'); }
}
function clearDownstreamCards(fromStepNum) {
    QUESTIONS_CONFIG.forEach(q => {
        if (q.step > fromStepNum) {
            const card = document.getElementById(`cardStep-${q.step}`);
            if (card) {
                card.classList.add('hidden'); card.classList.remove('active-card');
                document.getElementById(`btn-yes-${q.step}`).classList.remove('selected');
                document.getElementById(`btn-no-${q.step}`).classList.remove('selected');
            }
        }
    });
    hideResultsPanel();
}
function hideResultsPanel() { document.getElementById('cardResults').classList.add('hidden'); }
function resetWorkflowEngine() { buildWorkflowUI(); hideResultsPanel(); }

function toggleContentMode() {
    const mode = document.getElementById('contentModeSwitcher').value;
    const bulletContainer = document.getElementById('bulletModeContainer');
    const pdfContainer = document.getElementById('pdfModeContainer');
    
    if (mode === 'pdf') {
        bulletContainer.classList.add('hidden');
        pdfContainer.classList.remove('hidden');
    } else {
        bulletContainer.classList.remove('hidden');
        pdfContainer.classList.add('hidden');
    }
}

function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    const reader = new FileReader();
    reader.onload = function(e) {
        stagedPdfData = e.target.result;
        const pdfViewer = document.getElementById('pdfViewer');
        if (pdfViewer) {
            pdfViewer.innerHTML = `<iframe src="${stagedPdfData}" style="width: 100%; height: 350px; border: 1px solid #cbd5e1; border-radius: 4px;"></iframe>`;
        }
    };
    reader.readAsDataURL(file);
}