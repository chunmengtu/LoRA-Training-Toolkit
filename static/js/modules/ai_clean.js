import {dom, formatBytes} from "../core/dom.js";
import {fetchJSON} from "../core/api.js";
import {formatText, getText, registerTranslationHook} from "../core/i18n.js";
import {showModal} from "../core/modal.js";
import {state} from "../core/state.js";

async function postForm(url, formData) {
    const response = await fetch(url, {method: "POST", body: formData});
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }
    return data;
}

function disposeReferencePreview() {
    if (state.aiCleaning.referencePreviewUrl) {
        URL.revokeObjectURL(state.aiCleaning.referencePreviewUrl);
        state.aiCleaning.referencePreviewUrl = null;
    }
}

function updateUploadNote() {
    if (!dom.aiCleanUploadNote) return;
    dom.aiCleanUploadNote.textContent = state.aiCleaning.referenceFile
        ? formatText("ai.imageCleanUploadSelected", {name: state.aiCleaning.referenceFile.name})
        : getText("ai.imageCleanUploadNote");
}

function renderReferencePreview() {
    if (!dom.aiCleanReferencePreview || !dom.aiCleanReferenceImg) return;
    if (state.aiCleaning.referencePreviewUrl) {
        dom.aiCleanReferenceImg.src = state.aiCleaning.referencePreviewUrl;
        dom.aiCleanReferencePreview.classList.remove("hidden");
    } else {
        dom.aiCleanReferenceImg.removeAttribute("src");
        dom.aiCleanReferencePreview.classList.add("hidden");
    }
}

function setReferenceFile(file, {clearResults = true} = {}) {
    if (file && file.type && !file.type.startsWith("image/")) {
        showModal(getText("modal.title"), getText("ai.imageCleanRefNotImage"));
        return;
    }

    disposeReferencePreview();
    state.aiCleaning.referenceFile = file;
    if (clearResults) {
        state.aiCleaning.displayItems = state.aiCleaning.baseItems.slice();
        state.aiCleaning.hasSimilarity = false;
        state.aiCleaning.selected.clear();
    }
    state.aiCleaning.referencePreviewUrl = file ? URL.createObjectURL(file) : null;
    updateUploadNote();
    renderReferencePreview();
    renderAiCleanResults();
}

function renderAiCleanResults() {
    if (!dom.aiCleanGrid) return;
    dom.aiCleanGrid.innerHTML = "";
    const items = Array.isArray(state.aiCleaning.displayItems) ? state.aiCleaning.displayItems : [];
    const keyword = (state.aiCleaning.filterKeyword || "").trim().toLowerCase();
    const visibleItems = keyword
        ? items.filter((item) => String(item?.name || "").toLowerCase().includes(keyword))
        : items;
    if (!visibleItems.length) {
        dom.aiCleanGrid.textContent = getText("ai.imageCleanEmpty");
        return;
    }

    const available = new Set(visibleItems.map((item) => item.relative_path));
    Array.from(state.aiCleaning.selected).forEach((path) => {
        if (!available.has(path)) state.aiCleaning.selected.delete(path);
    });

    visibleItems.forEach((image) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "image-card";
        if (state.aiCleaning.selected.has(image.relative_path)) card.classList.add("selected");

        const probability = Number(image.probability);
        const showScore = Number.isFinite(probability);
        const scoreLabel = showScore ? `${probability.toFixed(probability % 1 === 0 ? 0 : 2)}%` : "";

        card.innerHTML = `
            <div class="image-thumb">
                <img src="/api/thumbnail/${image.bucket || "source"}/${image.relative_path}?t=${image.modified}" alt="${image.name}" loading="lazy">
            </div>
            <div class="image-meta">
                <strong>${image.name}</strong>
                <span>${formatBytes(image.size)}</span>
            </div>
            ${showScore ? `<span class="ai-clean-score">${scoreLabel}</span>` : ""}
        `;
        card.addEventListener("click", () => {
            if (state.aiCleaning.selected.has(image.relative_path)) {
                state.aiCleaning.selected.delete(image.relative_path);
                card.classList.remove("selected");
            } else {
                state.aiCleaning.selected.add(image.relative_path);
                card.classList.add("selected");
            }
        });
        dom.aiCleanGrid.appendChild(card);
    });
}

async function handleReferenceInputChange() {
    const files = Array.from(dom.aiCleanReferenceInput?.files || []);
    if (files.length > 1) {
        showModal(getText("modal.title"), getText("ai.imageCleanRefTooMany"));
        if (dom.aiCleanReferenceInput) dom.aiCleanReferenceInput.value = "";
        setReferenceFile(null, {clearResults: false});
        return;
    }
    setReferenceFile(files[0] || null);
}

async function handleAiCleanSubmit(event) {
    event.preventDefault();
    if (state.aiCleaning.running) return;
    const reference = state.aiCleaning.referenceFile;
    if (!reference) return showModal(getText("modal.title"), getText("ai.imageCleanMissingRef"));

    state.aiCleaning.running = true;
    dom.aiCleanRunBtn.disabled = true;
    try {
        const formData = new FormData();
        formData.append("reference", reference);

        const response = await postForm("/api/ai/clean/similar", formData);
        state.aiCleaning.displayItems = Array.isArray(response.items) ? response.items : [];
        state.aiCleaning.hasSimilarity = true;
        state.aiCleaning.selected.clear();
        renderAiCleanResults();
        showModal(getText("modal.title"), response.message || getText("ai.imageCleanDone"));
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("ai.imageCleanFail"));
    } finally {
        state.aiCleaning.running = false;
        dom.aiCleanRunBtn.disabled = false;
    }
}

function handleAiCleanRemoveReference() {
    if (dom.aiCleanReferenceInput) dom.aiCleanReferenceInput.value = "";
    setReferenceFile(null, {clearResults: false});
}

function handleAiCleanReset() {
    state.aiCleaning.displayItems = state.aiCleaning.baseItems.slice();
    state.aiCleaning.hasSimilarity = false;
    state.aiCleaning.selected.clear();
    renderAiCleanResults();
}

function bindReferenceUploadZone() {
    const uploadZone = dom.aiCleanUploadZone;
    if (!uploadZone) return;
    const preventDefaults = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((name) => uploadZone.addEventListener(name, preventDefaults));
    ["dragenter", "dragover"].forEach((name) => uploadZone.addEventListener(name, () => uploadZone.classList.add("highlight")));
    ["dragleave", "drop"].forEach((name) => uploadZone.addEventListener(name, () => uploadZone.classList.remove("highlight")));
    uploadZone.addEventListener("drop", (event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return;
        if (files.length > 1) {
            showModal(getText("modal.title"), getText("ai.imageCleanRefTooMany"));
            return;
        }
        setReferenceFile(files[0]);
    });
}

function applyAiCleanGalleryFilter() {
    const keyword = dom.aiCleanGalleryFilter?.value.trim() || "";
    state.aiCleaning.filterKeyword = keyword;
    if (state.aiCleaning.hasSimilarity) {
        renderAiCleanResults();
    } else {
        loadAiCleanGallery(keyword);
    }
}

export async function loadAiCleanGallery(keyword = "") {
    state.aiCleaning.filterKeyword = keyword;
    try {
        const response = await fetchJSON(
            keyword ? `/api/images/list?keyword=${encodeURIComponent(keyword)}` : "/api/images/list",
        );
        state.aiCleaning.baseItems = Array.isArray(response.images) ? response.images : [];
        if (!state.aiCleaning.hasSimilarity) {
            state.aiCleaning.displayItems = state.aiCleaning.baseItems.slice();
            state.aiCleaning.selected.clear();
            renderAiCleanResults();
        }
    } catch (error) {
        console.error("load ai clean gallery failed", error);
        state.aiCleaning.baseItems = [];
        if (!state.aiCleaning.hasSimilarity) {
            state.aiCleaning.displayItems = [];
            state.aiCleaning.selected.clear();
            renderAiCleanResults();
        }
    }
}

function getExportTargetsFromCriteria() {
    if (!state.aiCleaning.hasSimilarity) {
        showModal(getText("modal.title"), getText("ai.imageCleanExportNeedSimilarity"));
        return null;
    }

    const items = Array.isArray(state.aiCleaning.displayItems) ? state.aiCleaning.displayItems : [];
    const withScore = items.filter((item) => Number.isFinite(Number(item.probability)));
    if (!withScore.length) return [];

    const minScore = Number(dom.aiCleanMinScoreInput?.value);
    const limit = Number(dom.aiCleanTopCountInput?.value);
    let filtered = withScore.slice().sort((left, right) => Number(right.probability) - Number(left.probability));
    if (Number.isFinite(minScore)) {
        filtered = filtered.filter((item) => Number(item.probability) >= minScore);
    }
    if (Number.isFinite(limit) && limit > 0) {
        filtered = filtered.slice(0, Math.floor(limit));
    }
    return filtered.map((item) => item.relative_path);
}

function getSelectedTargets() {
    return Array.from(state.aiCleaning.selected).filter((item) => typeof item === "string" && item.length);
}

function filenameFromDisposition(disposition) {
    if (!disposition) return "";
    const match = disposition.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)\"?/i);
    return match ? decodeURIComponent(match[1]) : "";
}

async function exportTargets(targets) {
    const safeTargets = targets.filter((item) => typeof item === "string" && item.length);
    if (!safeTargets.length) {
        showModal(getText("modal.title"), getText("ai.imageCleanExportEmpty"));
        return;
    }

    const response = await fetch("/api/ai/clean/export", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({targets: safeTargets}),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Request failed");
    }
    const blob = await response.blob();
    const filename = filenameFromDisposition(response.headers.get("Content-Disposition")) || "ai_clean_export.zip";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function handleExportSelected() {
    try {
        await exportTargets(getSelectedTargets());
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("ai.imageCleanExportFail"));
    }
}

async function handleExportFiltered() {
    try {
        const targets = getExportTargetsFromCriteria();
        if (targets === null) return;
        await exportTargets(targets);
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("ai.imageCleanExportFail"));
    }
}

export function initAiCleanModule() {
    dom.aiCleanReferenceInput?.addEventListener("change", handleReferenceInputChange);
    dom.aiCleanForm?.addEventListener("submit", handleAiCleanSubmit);
    dom.aiCleanRemoveRefBtn?.addEventListener("click", handleAiCleanRemoveReference);
    dom.aiCleanResetBtn?.addEventListener("click", handleAiCleanReset);
    dom.applyAiCleanFilterBtn?.addEventListener("click", applyAiCleanGalleryFilter);
    dom.aiCleanGalleryFilter?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        applyAiCleanGalleryFilter();
    });
    dom.aiCleanExportSelectedBtn?.addEventListener("click", handleExportSelected);
    dom.aiCleanExportFilteredBtn?.addEventListener("click", handleExportFiltered);
    bindReferenceUploadZone();
    loadAiCleanGallery();

    registerTranslationHook(() => {
        updateUploadNote();
        renderAiCleanResults();
    });
}
