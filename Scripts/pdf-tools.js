window.openFullscreenPdfViewer = async function(cachedIndex) {
    const trialObj = window.activeMatchesRuntimeCache ? window.activeMatchesRuntimeCache[cachedIndex] : null;

    if (!trialObj || (!trialObj.pdfData && !trialObj.pdfPath)) {
        alert("Execution Error: No protocol asset mapped for this entry.");
        return;
    }

    const overlay = document.getElementById('fullscreenPdfOverlay');
    const frame = document.getElementById('fullscreenPdfFrame');
    const titleLabel = document.getElementById('fullscreenPdfTitle');

    if (overlay && frame && titleLabel) {
        titleLabel.textContent = `Protocol Reference Map — ${trialObj.name}`;

        if (trialObj.pdfPath) {
            const result = await window.electronAPI.readPdfFile(trialObj.pdfPath);
            if (result.success) {
                frame.src = result.data;
            } else {
                alert("Error loading PDF file: " + result.error);
                return;
            }
        } else {
            frame.src = trialObj.pdfData;
        }

        overlay.style.display = 'flex';
    }
};

window.closeFullscreenPdfViewer = function() {
    const overlay = document.getElementById('fullscreenPdfOverlay');
    const frame = document.getElementById('fullscreenPdfFrame');
    if (overlay && frame) {

        // The embedded PDF plugin view can hold onto keyboard focus even
        // after this iframe is hidden/cleared, which silently blocks
        // typing anywhere else in the app afterward. Explicitly blur it
        // and hand focus back to the document before tearing it down.
        try { frame.blur(); } catch (e) {}

        overlay.style.display = 'none';
        frame.src = "";

        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        document.body.focus();
    }
};