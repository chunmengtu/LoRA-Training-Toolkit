import {fetchJSON} from "./core/api.js";
import {dom} from "./core/dom.js";
import {applyTranslations, getText, setLanguage, toggleLanguage, updateStepText} from "./core/i18n.js";
import {hideModal, showModal} from "./core/modal.js";
import {startPolling} from "./core/polling.js";
import {state, STEPS, storageKeys} from "./core/state.js";
import {applyTheme, toggleTheme} from "./core/theme.js";
import {showToast} from "./core/toast.js";
import {initAiCleanModule, renderAiCleanFilters, renderAiCleanGallery, syncBaseFromGallery, updateAiCleanSelectionHint} from "./modules/ai_clean.js";
import {initAiGenerateModule, initializeGenerationDefaults, loadAiGallery, renderExtraReferenceList} from "./modules/ai_generate.js";
import {applySectionState, initConsoleModule} from "./modules/console.js";
import {initDownloadModule} from "./modules/download.js";
import {initImagesModule, loadGallery, registerGalleryHook, updateSelectionHint} from "./modules/images.js";
import {initModelsModule, loadAiProviderConfig, renderModelCards} from "./modules/models.js";
import {initSetupModule} from "./modules/setup.js";

function goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= STEPS.length) return;
    state.currentStepIndex = stepIndex;
    document.querySelectorAll(".wizard-page").forEach((page, index) => page.classList.toggle("active", index === stepIndex));
    document.querySelectorAll(".step-nav-item").forEach((item, index) => {
        item.classList.toggle("active", index === stepIndex);
        if (index < stepIndex) item.classList.add("completed");
    });
    if (dom.progressFill) dom.progressFill.style.width = `${((stepIndex + 1) / STEPS.length) * 100}%`;
    updateStepText();

    const stepName = STEPS[stepIndex];
    if (stepName === "ai") loadAiGallery(state.aiGallery.filterKeyword);
    if (stepName === "ai-clean") {
        if (!state.aiCleaning.baseItems.length) {
            loadGallery(state.gallery.filterKeyword || "");
        } else {
            renderAiCleanFilters();
            renderAiCleanGallery();
            updateAiCleanSelectionHint();
        }
    }
}

function initNavigation() {
    document.querySelectorAll(".step-nav-item").forEach((button, index) => button.addEventListener("click", () => goToStep(index)));
    document.querySelectorAll(".btn-prev").forEach((button) => button.addEventListener("click", () => goToStep(state.currentStepIndex - 1)));
    document.querySelectorAll(".btn-next").forEach((button) => button.addEventListener("click", () => goToStep(state.currentStepIndex + 1 >= STEPS.length ? 0 : state.currentStepIndex + 1)));
}

function compareVersions(v1, v2) {
    const left = v1.split(".").map(Number);
    const right = v2.split(".").map(Number);
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if ((left[index] || 0) > (right[index] || 0)) return 1;
        if ((left[index] || 0) < (right[index] || 0)) return -1;
    }
    return 0;
}

async function checkUpdate(silent = false) {
    if (!silent) showToast(getText("update.checking"));
    try {
        const data = await fetchJSON(`/api/check_update?_=${Date.now()}`);
        if (compareVersions(data.latest_version, data.current_version) > 0) {
            showModal(getText("update.title"), "", [
                {label: getText("update.btn"), variant: "primary", handler: () => window.open(data.release_url, "_blank")},
            ], {
                force: true,
                html: `<div style="text-align:left"><p><strong>${getText("update.current")}</strong> ${data.current_version}</p><p><strong>${getText("update.latest")}</strong> ${data.latest_version}</p><hr style="margin:10px 0;border:0;border-top:1px solid var(--border)"><p><strong>${getText("update.notes")}</strong></p><pre style="background:var(--panel-alt);padding:10px;border-radius:6px;max-height:200px;overflow-y:auto;white-space:pre-wrap;font-size:12px;font-family:inherit">${data.release_notes}</pre></div>`,
            });
        } else if (!silent) {
            showToast(getText("update.latestMsg"));
        }
    } catch (error) {
        if (!silent) showModal(getText("modal.title"), error.message || getText("update.fail"));
    }
}

function bootstrapPreferences() {
    applyTheme(localStorage.getItem(storageKeys.theme) || "dark");
    setLanguage(localStorage.getItem(storageKeys.lang) || "zh");
}

function handleStatusPayload(data) {
    applySectionState("setup", data.setup);
    applySectionState("download", data.download);
    applySectionState("generation", data.image_generation);
    applySectionState("ai_clean", data.ai_clean);
    if (data.image_generation.status === "running" && STEPS[state.currentStepIndex] === "ai") loadAiGallery(state.aiGallery.filterKeyword);
    if (data.image_generation.status !== "running" && state.generating.active) {
        state.generating.active = false;
        state.generating.targets.clear();
        loadAiGallery(state.aiGallery.filterKeyword);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    bootstrapPreferences();
    dom.modalClose?.addEventListener("click", hideModal);
    dom.modal?.addEventListener("click", (event) => !dom.modal.classList.contains("modal-force") && event.target === dom.modal && hideModal());
    dom.themeToggle?.addEventListener("click", toggleTheme);
    dom.langToggle?.addEventListener("click", toggleLanguage);
    dom.updateBtn?.addEventListener("click", () => checkUpdate(false));

    initNavigation();
    initConsoleModule();
    initModelsModule();
    initSetupModule();
    initDownloadModule();
    initImagesModule();
    initAiGenerateModule();
    initAiCleanModule();
    registerGalleryHook(syncBaseFromGallery);
    registerGalleryHook(updateAiCleanSelectionHint);
    registerGalleryHook(updateSelectionHint);

    initializeGenerationDefaults();
    renderExtraReferenceList();
    renderModelCards();
    try {
        await loadAiProviderConfig();
    } catch (error) {
        console.error("load ai provider config failed", error);
    }
    applyTranslations();
    loadGallery();
    goToStep(0);
    startPolling(handleStatusPayload);
    checkUpdate(true);
});
