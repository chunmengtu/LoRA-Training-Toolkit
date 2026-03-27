import {dom} from "../core/dom.js";
import {getText} from "../core/i18n.js";
import {STATUS_KEYS} from "../core/state.js";
import {showToast} from "../core/toast.js";

export function updateGamifiedProgress(pageId, percent, isActive) {
    const container = document.getElementById(`gamifiedProgress_${pageId}`);
    const track = document.getElementById(`gamifiedTrack_${pageId}`);
    const thumb = document.getElementById(`gamifiedThumb_${pageId}`);
    if (!container || !track || !thumb) return;
    if (!isActive) {
        container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");
    const clamped = Math.min(100, Math.max(0, percent));
    track.style.width = `${clamped}%`;
    thumb.style.left = `${clamped}%`;
}

export function applySectionState(section, data) {
    if (!data) return;
    const prefixMap = {setup: "setup", download: "download", generation: "generation", ai_clean: "aiClean"};
    const prefix = prefixMap[section];
    if (!prefix) return;

    const pageMap = {setup: "setup", download: "download", generation: "ai", ai_clean: "ai-clean"};
    updateGamifiedProgress(pageMap[section], typeof data.progress === "number" ? data.progress : 0, data.status === "running");

    const progressEl = dom[`${prefix}Progress`];
    const statusEl = dom[`${prefix}Status`];
    const percentEl = dom[`${prefix}Percent`];
    const messageEl = dom[`${prefix}Message`];
    const logEl = dom[`${prefix}Log`];

    if (progressEl) progressEl.style.width = `${typeof data.progress === "number" ? data.progress : 0}%`;
    if (percentEl) percentEl.textContent = `${typeof data.progress === "number" ? data.progress : 0}%`;
    if (statusEl) statusEl.textContent = `${getText("status.label")}${getText(STATUS_KEYS[data.status] || "status.idle")}`;
    if (messageEl) messageEl.textContent = data.message || getText("log.waiting");
    if (logEl) logEl.textContent = data.log && data.log.length ? data.log.slice(-100).join("\n") : getText("log.waiting");
}

function bindCopy(button, logEl) {
    if (!button || !logEl) return;
    button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(logEl.textContent || "");
            showToast(getText("toast.copyOk"));
        } catch {
            showToast(getText("toast.copyFail"));
        }
    });
}

export function initConsoleModule() {
    bindCopy(dom.copySetupLog, dom.setupLog);
    bindCopy(dom.copyDownloadLog, dom.downloadLog);
    bindCopy(dom.copyGenerationLog, dom.generationLog);
    bindCopy(dom.copyAiCleanLog, dom.aiCleanLog);
}
