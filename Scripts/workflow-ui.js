function buildWorkflowUI() {
    const container = document.getElementById("dynamicQuestionsContainer");
    if (!container) return;
    console.log('[HHS DEBUG] buildWorkflowUI:start', {
        stepCount: Array.isArray(QUESTIONS_CONFIG) ? QUESTIONS_CONFIG.length : 0,
        activeDataFilePath,
        hasContainer: !!container
    });
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

    console.log('[HHS DEBUG] buildWorkflowUI:complete', {
        renderedCards: QUESTIONS_CONFIG.length,
        firstStep: QUESTIONS_CONFIG[0] ? QUESTIONS_CONFIG[0].step : null,
        lastStep: QUESTIONS_CONFIG.length > 0 ? QUESTIONS_CONFIG[QUESTIONS_CONFIG.length - 1].step : null
    });
}

function handleUnifiedAddStepClick() {
    // window.prompt() is not implemented in Electron's renderer, so we build
    // a small position-picker ourselves instead of relying on the app's
    // pre-existing addStepModal — that modal was never actually wired to
    // any button before (Add Step always used prompt()), so its markup/CSS
    // is untested and was very likely leaving an invisible overlay behind
    // that blocked typing in the editor panel underneath it.
    const config = Array.isArray(QUESTIONS_CONFIG) ? QUESTIONS_CONFIG : [];
    const lastStep = config.length > 0 ? config[config.length - 1].step : 0;
    const nextEndStepNum = lastStep + 1;

    console.log("[HHS DEBUG] handleUnifiedAddStepClick:openingPicker", { nextEndStepNum });

    showAddStepPositionPicker(nextEndStepNum, (targetPos) => {
        if (targetPos === null) return; // cancelled
        if (targetPos === nextEndStepNum) {
            openControlPage(false, null, null);
        } else {
            openControlPage(false, null, targetPos);
        }
    });
}

function showAddStepPositionPicker(nextEndStepNum, onSubmit) {
    // Remove any stray leftover picker first, just in case.
    document.getElementById('hhsAddStepPicker')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'hhsAddStepPicker';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); display:flex; align-items:center; justify-content:center; z-index:99999;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#ffffff; border-radius:8px; padding:20px; width:360px; max-width:90vw; font-family:system-ui, -apple-system, sans-serif; box-shadow:0 10px 30px rgba(0,0,0,0.35);';
    box.innerHTML = `
        <h3 style="margin:0 0 10px; font-size:16px; color:#1e293b;">Where should this step go?</h3>
        <p style="margin:0 0 12px; font-size:13px; color:#475569; line-height:1.4;">Leave blank or enter <strong>${nextEndStepNum}</strong> to add it at the end, or enter a number 1&ndash;${nextEndStepNum} to insert it there.</p>
        <input id="hhsAddStepPickerInput" type="number" min="1" max="${nextEndStepNum}" placeholder="${nextEndStepNum}" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px; margin-bottom:14px;">
        <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" id="hhsAddStepPickerCancel" style="background:#e2e8f0; color:#334155; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-size:13px;">Cancel</button>
            <button type="button" id="hhsAddStepPickerOk" style="background:#2563eb; color:#ffffff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:600;">Add Step</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const input = box.querySelector('#hhsAddStepPickerInput');
    input.focus();

    function cleanup() {
        overlay.remove();
    }

    function submit() {
        const raw = input.value.trim();
        let targetPos = nextEndStepNum;
        if (raw !== "") {
            const parsed = parseInt(raw, 10);
            if (isNaN(parsed) || parsed < 1 || parsed > nextEndStepNum) {
                alert("Invalid step position selected.");
                return;
            }
            targetPos = parsed;
        }
        cleanup();
        onSubmit(targetPos);
    }

    box.querySelector('#hhsAddStepPickerOk').addEventListener('click', submit);
    box.querySelector('#hhsAddStepPickerCancel').addEventListener('click', () => { cleanup(); onSubmit(null); });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); submit(); }
        if (event.key === 'Escape') { event.preventDefault(); cleanup(); onSubmit(null); }
    });
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) { cleanup(); onSubmit(null); }
    });
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
    console.log('[HHS DEBUG] processChoice', {
        stepNum,
        isYes,
        found: !!config,
        trialCount: config && config.trials ? config.trials.length : 0,
        nextStep: config ? config.ifNoGoToStep : null
    });
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

    window.activeMatchesRuntimeCache = trialsArray || [];

    if (!trialsArray || trialsArray.length === 0) {
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
                ${(trial.pdfData || trial.pdfPath) ? `
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

function advanceWorkflow() { if (currentStepTarget) activateStepCard(currentStepTarget); hideResultsPanel(); }

function activateStepCard(stepId) {
    console.log('[HHS DEBUG] activateStepCard', { stepId });
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active-card'));
    const targetCard = document.getElementById(`cardStep-${stepId}`);
    if (targetCard) { targetCard.classList.remove('hidden'); targetCard.classList.add('active-card'); }
}

function clearDownstreamCards(fromStepNum) {
    console.log('[HHS DEBUG] clearDownstreamCards', { fromStepNum });
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

function hideResultsPanel() {
    console.log('[HHS DEBUG] hideResultsPanel');
    document.getElementById('cardResults').classList.add('hidden');
}

function resetWorkflowEngine() {
    console.log('[HHS DEBUG] resetWorkflowEngine');
    buildWorkflowUI();
    hideResultsPanel();
}