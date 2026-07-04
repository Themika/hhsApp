function getEditableFieldValue(id) {
    const element = document.getElementById(id);
    if (!element) return "";
    return typeof element.value === 'string' ? element.value.trim() : "";
}

function setEditableFieldValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value == null ? "" : String(value);
}

function placeCaretAtEnd(element) {
    if (!element) return;
    element.focus();
    if (typeof element.setSelectionRange === 'function') {
        const caretPos = typeof element.value === 'string' ? element.value.length : 0;
        element.setSelectionRange(caretPos, caretPos);
    }
}

function focusEditorTextField(fieldId) {
    const element = document.getElementById(fieldId);
    if (!element) return;
    placeCaretAtEnd(element);
    console.log('[HHS DEBUG] focusEditorTextField', {
        fieldId,
        activeElementId: document.activeElement ? document.activeElement.id : null,
        value: element.value,
        selectionStart: typeof element.selectionStart === 'number' ? element.selectionStart : null,
        selectionEnd: typeof element.selectionEnd === 'number' ? element.selectionEnd : null
    });
}

function getSelectionRange(element) {
    return {
        start: typeof element.selectionStart === 'number' ? element.selectionStart : 0,
        end: typeof element.selectionEnd === 'number' ? element.selectionEnd : 0
    };
}

function setSelectionRange(element, start, end) {
    if (!element || typeof element.setSelectionRange !== 'function') return;
    element.setSelectionRange(start, end);
}

function applyTextInputMutation(element, insertedText, deleteBackward = false, deleteForward = false) {
    if (!element) return;
    const currentValue = typeof element.value === 'string' ? element.value : '';
    const bounds = getSelectionRange(element);
    let start = bounds.start;
    let end = bounds.end;

    if (deleteBackward && start === end && start > 0) {
        start -= 1;
    }
    if (deleteForward && start === end && end < currentValue.length) {
        end += 1;
    }

    const nextValue = currentValue.slice(0, start) + insertedText + currentValue.slice(end);
    element.value = nextValue;
    const nextCaret = start + insertedText.length;
    setSelectionRange(element, nextCaret, nextCaret);
}

function bindTextAreaEditing(element) {
    if (!element || element.dataset.hhsTextEditBound === 'true') return;
    element.dataset.hhsTextEditBound = 'true';

    element.addEventListener('keydown', (event) => {
        console.log('[HHS DEBUG] field:manualKeydown', {
            id: element.id,
            key: event.key,
            valueBefore: element.value,
            selection: getSelectionRange(element),
            activeElementId: document.activeElement ? document.activeElement.id : null
        });

        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key.length === 1) {
            event.preventDefault();
            applyTextInputMutation(element, event.key);
            return;
        }

        if (event.key === 'Backspace') {
            event.preventDefault();
            applyTextInputMutation(element, '', true, false);
            return;
        }

        if (event.key === 'Delete') {
            event.preventDefault();
            applyTextInputMutation(element, '', false, true);
            return;
        }

        if (event.key === 'Enter' && element.id !== 'newTitle') {
            event.preventDefault();
            applyTextInputMutation(element, '\n');
        }
    });

    element.addEventListener('paste', (event) => {
        const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        console.log('[HHS DEBUG] field:manualPaste', {
            id: element.id,
            pasteLength: text.length,
            valueBefore: element.value,
            selection: getSelectionRange(element)
        });
        if (!text) return;
        event.preventDefault();
        applyTextInputMutation(element, text);
    });

    element.addEventListener('input', () => {
        console.log('[HHS DEBUG] field:manualInput', {
            id: element.id,
            valueAfter: element.value,
            activeElementId: document.activeElement ? document.activeElement.id : null
        });
    });

    element.addEventListener('pointerdown', () => {
        window.setTimeout(() => focusEditorTextField(element.id), 0);
    });
}

function openControlPage(isEditMode = false, targetStepId = null, insertionPosition = null) {
    console.log('[HHS DEBUG] openControlPage', { isEditMode, targetStepId, insertionPosition, stepCount: Array.isArray(QUESTIONS_CONFIG) ? QUESTIONS_CONFIG.length : 0 });
    document.getElementById('screeningView').classList.add('hidden');
    document.getElementById('creatorView').classList.remove('hidden');

    clearDraftOptionForm();

    const creatorFields = ['newTitle', 'newPrompt', 'tName', 'tContact', 'tDesc', 'bulletInput', 'commitTrialBtn', 'formSubmitBtn'];
    creatorFields.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
    });

    if (isEditMode && targetStepId !== null) {
        editingStepNumber = targetStepId;
        document.getElementById('pageViewModeTitle').textContent = "Protocol Stage Editor";
        document.getElementById('managementActionLabel').textContent = "Modify";
        document.getElementById('routingEngineHelperText').textContent = "Modifying parameters inside an existing runtime structural workflow step.";
        document.getElementById('formSubmitBtn').textContent = "Save and Update Protocol Step & Options";

        const stepData = QUESTIONS_CONFIG.find(q => q.step === targetStepId);
        if (!stepData) {
            console.error('[HHS DEBUG] openControlPage:stepDataMissing');
            closeControlPage();
            return;
        }
        document.getElementById('autoStepBadge').textContent = `Step #${targetStepId}`;
        document.getElementById('autoStepBadge').dataset.stepval = targetStepId;
        setEditableFieldValue('newTitle', stepData.title);
        setEditableFieldValue('newPrompt', stepData.prompt);
        stagedTrialsArray = stepData.trials ? JSON.parse(JSON.stringify(stepData.trials)) : [];
    } else {
        editingStepNumber = null;
        setEditableFieldValue('newTitle', '');
        setEditableFieldValue('newPrompt', '');
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

    // FOCUS TARGET DEBUGGING
    const initialField = document.getElementById('newTitle') || document.getElementById('tName');
    
    if (initialField) {
        // Send status to VS Code terminal
        if (window.electronAPI?.send) {
            window.electronAPI.send('hhs-focus-log', {
                timestamp: new Date().toISOString(),
                target: initialField.id,
                activeElement: document.activeElement?.id || 'none',
                isFocused: document.activeElement === initialField
            });
        }

        placeCaretAtEnd(initialField);
        
        window.setTimeout(() => {
            focusEditorTextField(initialField.id);
            
            // Send final status to VS Code terminal
            if (window.electronAPI?.send) {
                window.electronAPI.send('hhs-focus-log', {
                    timestamp: new Date().toISOString(),
                    event: 'AFTER_TIMEOUT',
                    target: initialField.id,
                    activeElement: document.activeElement?.id || 'none',
                    isFocused: document.activeElement === initialField
                });
            }
        }, 250);
    }
}

function closeControlPage() {
    document.getElementById('creatorView').classList.add('hidden');
    document.getElementById('screeningView').classList.remove('hidden');
    document.querySelectorAll('#creatorView input, #creatorView textarea').forEach(el => {
        el.value = "";
    });
    delete document.getElementById('autoStepBadge').dataset.isInsertion;
    stagedTrialsArray = [];
    activeBulletPointsArr = [];
    stagedPdfData = null;
    stagedPdfPath = null;
    editingStepNumber = null;
    editingTrialIndex = null;
    editingBulletIndex = null;
    renderQueuedTrialsList();
}

function addBulletPointToDraft() {
    const field = document.getElementById('bulletInput');
    const rawValue = field.value.trim();
    if (!rawValue) return;

    console.log('[HHS DEBUG] addBulletPointToDraft', { editingBulletIndex, rawValue });

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
    if (!container) return;
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
    console.log('[HHS DEBUG] editDraftBullet', { index, currentValue: activeBulletPointsArr[index] });
    editingBulletIndex = index;
    const field = document.getElementById('bulletInput');
    if (field) {
        field.value = activeBulletPointsArr[index];
        document.querySelector('.add-bullet-btn').textContent = "💾 Save Bullet";
        field.focus();
    }
}

function removeDraftBullet(index) {
    console.log('[HHS DEBUG] removeDraftBullet', { index, currentValue: activeBulletPointsArr[index] });
    if (editingBulletIndex === index) {
        editingBulletIndex = null;
        document.getElementById('bulletInput').value = "";
        document.querySelector('.add-bullet-btn').textContent = "+ Add Bullet";
    }
    activeBulletPointsArr.splice(index, 1);
    renderBulletDraftPreview();
}

function editOptionFromStepQueue(index) {
    console.log('[HHS DEBUG] editOptionFromStepQueue', { index, trial: stagedTrialsArray[index] });
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
    stagedPdfPath = trial.pdfPath || null;

    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        if (stagedPdfData) {
            pdfViewer.innerHTML = `<iframe src="${stagedPdfData}" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;"></iframe>`;
            document.getElementById('contentModeSwitcher').value = 'pdf';
        } else if (stagedPdfPath) {
            window.electronAPI.readPdfFile(stagedPdfPath).then(result => {
                if (result.success && document.getElementById('pdfViewer')) {
                    document.getElementById('pdfViewer').innerHTML = `<iframe src="${result.data}" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;"></iframe>`;
                }
            });
            document.getElementById('contentModeSwitcher').value = 'pdf';
        } else {
            document.getElementById('contentModeSwitcher').value = 'bullets';
        }
    }
    toggleContentMode();
    document.getElementById('trialDraftingCard').scrollIntoView({ behavior: 'smooth' });
}

function commitOptionToStepQueue() {
    const name = document.getElementById('tName').value.trim();
    const contact = document.getElementById('tContact').value.trim() || "N/A";
    const desc = document.getElementById('tDesc').value.trim() || "No descriptive notes recorded.";

    console.log('[HHS DEBUG] commitOptionToStepQueue:start', {
        editingTrialIndex,
        name,
        contact,
        desc,
        bulletCount: activeBulletPointsArr.length,
        hasPdfData: !!stagedPdfData,
        hasPdfPath: !!stagedPdfPath
    });

    if (!name) {
        alert("To attach a trial option block, you must input a 'Trial Program Name'.");
        return;
    }

    const compiledTrialPayload = {
        name: name,
        contact: contact,
        desc: desc,
        criteria: [...activeBulletPointsArr],
        pdfData: stagedPdfData,
        pdfPath: stagedPdfPath
    };

    if (editingTrialIndex !== null) {
        stagedTrialsArray[editingTrialIndex] = compiledTrialPayload;
    } else {
        stagedTrialsArray.push(compiledTrialPayload);
    }

    console.log('[HHS DEBUG] commitOptionToStepQueue:queuedTrials', {
        total: stagedTrialsArray.length,
        editingTrialIndex,
        lastTrial: stagedTrialsArray[stagedTrialsArray.length - 1]
    });

    clearDraftOptionForm();
    renderQueuedTrialsList();
}

function renderQueuedTrialsList() {
    const container = document.getElementById('queuedTrialsContainer');
    if (!container) return;
    if (stagedTrialsArray.length === 0) {
        container.innerHTML = `<p class="empty-state-text">No trial allocation options attached to this step yet.</p>`;
        return;
    }

    container.innerHTML = stagedTrialsArray.map((trial, index) => `
        <div class="queued-trial-item-row">
            <div class="queued-item-meta">
                <strong>${trial.name}</strong> <span style="color:#64748b; font-size:12px;">(${trial.contact})</span>
                <div style="font-size:12px; color:#475569; margin-top:2px;">${trial.desc}</div>
                <div style="font-size:11px; color:#3b82f6; margin-top:4px; cursor:pointer; user-select:none; display:inline-block; font-weight:500;" onclick="toggleInlineCriteria(this, ${index})">
                    • Includes ${trial.criteria ? trial.criteria.length : 0} inclusion bullet points <span class="toggle-arrow" style="font-size:9px; vertical-align:middle; margin-left:2px;">▶</span>
                </div>
                <ul id="inline-criteria-${index}" style="display:none; margin-top:6px; margin-bottom:6px; padding-left:20px; font-size:12px; color:#475569; list-style-type:disc; line-height:1.4;">
                    ${(trial.criteria || []).map(c => `<li style="margin-bottom:2px;">${c}</li>`).join('')}
                </ul>
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
    console.log('[HHS DEBUG] clearDraftOptionForm:start', {
        editingTrialIndex,
        editingBulletIndex,
        stagedTrialsCount: stagedTrialsArray.length,
        activeBulletPointsCount: activeBulletPointsArr.length,
        stagedPdfData: !!stagedPdfData,
        stagedPdfPath: !!stagedPdfPath
    });
    document.getElementById('tName').value = "";
    document.getElementById('tContact').value = "";
    document.getElementById('tDesc').value = "";
    document.getElementById('bulletInput').value = "";
    const fileSelectorInput = document.getElementById('pdfUpload');
    if (fileSelectorInput) fileSelectorInput.value = "";

    activeBulletPointsArr = [];
    stagedPdfData = null;
    stagedPdfPath = null;
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

    console.log('[HHS DEBUG] clearDraftOptionForm:complete', {
        tName: document.getElementById('tName')?.value,
        tContact: document.getElementById('tContact')?.value,
        tDesc: document.getElementById('tDesc')?.value,
        bulletInput: document.getElementById('bulletInput')?.value,
        activeElementId: document.activeElement ? document.activeElement.id : null
    });
}

function saveNewStepAndReturn() {
    const computedStep = parseInt(document.getElementById('autoStepBadge').dataset.stepval);
    const title = getEditableFieldValue('newTitle');
    const prompt = getEditableFieldValue('newPrompt');
    const isInsertion = document.getElementById('autoStepBadge').dataset.isInsertion === "true";

    console.log('[HHS DEBUG] saveNewStepAndReturn:start', {
        editingStepNumber,
        computedStep,
        title,
        prompt,
        isInsertion,
        stagedTrialsCount: stagedTrialsArray.length
    });

    if (!title || !prompt) {
        alert("Validation Fault: A Stage Section Title and Clinical Question Prompt description are required parameters.");
        return;
    }

    console.log('[HHS DEBUG] saveNewStepAndReturn:fieldSnapshot', {
        title,
        prompt,
        titleElementState: {
            disabled: document.getElementById('newTitle')?.disabled,
            readOnly: document.getElementById('newTitle')?.readOnly,
            value: document.getElementById('newTitle')?.value
        },
        promptElementState: {
            disabled: document.getElementById('newPrompt')?.disabled,
            readOnly: document.getElementById('newPrompt')?.readOnly,
            value: document.getElementById('newPrompt')?.value
        }
    });

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
            if (q.step >= computedStep) q.step += 1;
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

    console.log('[HHS DEBUG] saveNewStepAndReturn:postNormalize', {
        totalSteps: QUESTIONS_CONFIG.length,
        firstStep: QUESTIONS_CONFIG[0] ? QUESTIONS_CONFIG[0].step : null,
        lastStep: QUESTIONS_CONFIG.length > 0 ? QUESTIONS_CONFIG[QUESTIONS_CONFIG.length - 1].step : null,
        focusedStep: stepToFocus,
        savedStepSnapshot: QUESTIONS_CONFIG.find(q => q.step === stepToFocus) || null
    });

    commitDatabaseChangesToDisk();
    buildWorkflowUI();
    closeControlPage();

    console.log('[HHS DEBUG] saveNewStepAndReturn:complete', { stepToFocus });

    const modifiedCard = document.getElementById(`cardStep-${stepToFocus}`);
    if (modifiedCard) {
        modifiedCard.classList.remove('hidden');
        modifiedCard.classList.add('active-card');
        modifiedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

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
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert("Please select a valid PDF file.");
        return;
    }

    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        const previewUrl = URL.createObjectURL(file);
        pdfViewer.innerHTML = `<iframe src="${previewUrl}" style="width: 100%; height: 350px; border: 1px solid #cbd5e1; border-radius: 4px;"></iframe>`;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        stagedPdfData = e.target.result;
        stagedPdfPath = null;
    };
    reader.readAsDataURL(file);
}

function toggleInlineCriteria(element, index) {
    const targetList = document.getElementById(`inline-criteria-${index}`);
    const arrow = element.querySelector('.toggle-arrow');

    if (targetList) {
        if (targetList.style.display === 'none') {
            targetList.style.display = 'block';
            if (arrow) arrow.textContent = '▼';
        } else {
            targetList.style.display = 'none';
            if (arrow) arrow.textContent = '▶';
        }
    }
}

function closeCustomPrompt() {
    document.getElementById('addStepModal').classList.add('hidden');
    document.getElementById('stepInput').value = "";
}

function submitCustomPrompt() {
    const val = document.getElementById('stepInput').value;
    const config = Array.isArray(QUESTIONS_CONFIG) ? QUESTIONS_CONFIG : [];
    const nextEndStepNum = config.length > 0 ? config[config.length - 1].step + 1 : 1;

    closeCustomPrompt();

    if (val === "" || parseInt(val) === nextEndStepNum) {
        openControlPage(false, null, null);
    } else {
        const targetPos = parseInt(val);
        if (isNaN(targetPos) || targetPos < 1 || targetPos > nextEndStepNum) {
            alert("Invalid step position selected.");
        } else {
            openControlPage(false, null, targetPos);
        }
    }
}