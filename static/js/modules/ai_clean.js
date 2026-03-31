import {dom, formatBytes} from "../core/dom.js";
import {fetchJSON} from "../core/api.js";
import {formatText, getText, registerTranslationHook} from "../core/i18n.js";
import {showModal} from "../core/modal.js";
import {state} from "../core/state.js";

const COCO_KEYPOINT_EDGES = [
    [5, 7], [7, 9],
    [6, 8], [8, 10],
    [5, 6],
    [5, 11], [6, 12],
    [11, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [0, 1], [0, 2],
    [1, 3], [2, 4],
    [3, 5], [4, 6],
];

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

function clearPoseReferenceState() {
    state.aiCleaning.referencePersons = [];
    state.aiCleaning.referencePersonId = null;
    state.aiCleaning.referenceImageSize = null;
    state.aiCleaning.referencePoseLoading = false;
    if (dom.aiCleanPosePickerOverlay) dom.aiCleanPosePickerOverlay.innerHTML = "";
    if (dom.aiCleanPosePickerSelected) {
        dom.aiCleanPosePickerSelected.textContent = "";
        dom.aiCleanPosePickerSelected.classList.add("hidden");
    }
    if (dom.aiCleanPoseParsingOverlay) dom.aiCleanPoseParsingOverlay.classList.add("hidden");
    if (dom.aiCleanPoseReferenceCanvas) {
        const context = dom.aiCleanPoseReferenceCanvas.getContext("2d");
        if (context) context.clearRect(0, 0, dom.aiCleanPoseReferenceCanvas.width, dom.aiCleanPoseReferenceCanvas.height);
        dom.aiCleanPoseReferenceCanvas.style.display = "none";
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

function updateAiCleanRunLabel() {
    if (!dom.aiCleanRunBtn) return;
    dom.aiCleanRunBtn.textContent = state.aiCleaning.mode === "pose"
        ? getText("ai.imageCleanPoseRunBtn")
        : getText("ai.imageCleanRunBtn");
}

function syncAiCleanModeUi() {
    const isPose = state.aiCleaning.mode === "pose";
    const hasReference = Boolean(state.aiCleaning.referencePreviewUrl);
    if (dom.aiCleanPosePicker) dom.aiCleanPosePicker.classList.toggle("hidden", !isPose || !hasReference);
    if (dom.aiCleanPoseOverlayRow) dom.aiCleanPoseOverlayRow.classList.toggle("hidden", !isPose);
    if (dom.aiCleanPoseOverlayToggle) dom.aiCleanPoseOverlayToggle.checked = Boolean(state.aiCleaning.showPoseOverlay);
    if (dom.aiCleanReferencePreview) dom.aiCleanReferencePreview.classList.toggle("hidden", isPose || !state.aiCleaning.referencePreviewUrl);
    if (dom.aiCleanPosePickerImg) {
        if (isPose && state.aiCleaning.referencePreviewUrl) {
            dom.aiCleanPosePickerImg.src = state.aiCleaning.referencePreviewUrl;
        } else {
            dom.aiCleanPosePickerImg.removeAttribute("src");
        }
    }
    updateAiCleanRunLabel();
    renderReferencePoseOverlay();
}

function setReferencePoseParsing(isParsing) {
    state.aiCleaning.referencePoseLoading = Boolean(isParsing);
    if (dom.aiCleanPoseParsingOverlay) dom.aiCleanPoseParsingOverlay.classList.toggle("hidden", !state.aiCleaning.referencePoseLoading);
}

function renderReferencePoseOverlay() {
    if (!dom.aiCleanPoseReferenceCanvas || !dom.aiCleanPosePickerImg) return;
    const shouldShow = state.aiCleaning.mode === "pose"
        && Boolean(state.aiCleaning.showPoseOverlay)
        && !state.aiCleaning.referencePoseLoading
        && state.aiCleaning.referencePersonId !== null
        && state.aiCleaning.referencePersonId !== undefined;

    dom.aiCleanPoseReferenceCanvas.style.display = shouldShow ? "" : "none";
    if (!shouldShow) return;

    const stage = dom.aiCleanPosePickerImg.parentElement;
    if (!stage) return;

    const persons = Array.isArray(state.aiCleaning.referencePersons) ? state.aiCleaning.referencePersons : [];
    const person = persons.find((item) => Number(item?.person_id) === Number(state.aiCleaning.referencePersonId))
        || persons[Number(state.aiCleaning.referencePersonId)];
    const keypoints = person?.keypoints_norm;
    if (!Array.isArray(keypoints) || !keypoints.length) return;

    const rect = stage.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;
    dom.aiCleanPoseReferenceCanvas.width = Math.floor(w * dpr);
    dom.aiCleanPoseReferenceCanvas.height = Math.floor(h * dpr);
    drawPoseOverlay(dom.aiCleanPoseReferenceCanvas, keypoints);
}

async function loadReferencePosePreview() {
    const reference = state.aiCleaning.referenceFile;
    if (!reference) {
        clearPoseReferenceState();
        return;
    }
    if (!dom.aiCleanPosePickerHint) return;

    dom.aiCleanPosePickerHint.textContent = getText("ai.imageCleanPoseLoading");
    clearPoseReferenceState();
    setReferencePoseParsing(true);

    try {
        const formData = new FormData();
        formData.append("reference", reference);
        const response = await postForm("/api/ai/clean/pose/reference", formData);
        const persons = Array.isArray(response.persons) ? response.persons : [];
        state.aiCleaning.referencePersons = persons;
        state.aiCleaning.referenceImageSize = response.image_size || null;

        if (!persons.length) {
            dom.aiCleanPosePickerHint.textContent = getText("ai.imageCleanPoseNoPersons");
            return;
        }
        dom.aiCleanPosePickerHint.textContent = getText("ai.imageCleanPosePickHint");

        if (persons.length === 1) {
            state.aiCleaning.referencePersonId = 0;
        }
        renderPosePickerOverlay();
        renderReferencePoseOverlay();
    } catch (error) {
        dom.aiCleanPosePickerHint.textContent = getText("ai.imageCleanPosePickHint");
        showModal(getText("modal.title"), error.message || getText("ai.imageCleanFail"));
    } finally {
        setReferencePoseParsing(false);
        renderReferencePoseOverlay();
    }
}

function setSelectedReferencePerson(personId) {
    state.aiCleaning.referencePersonId = Number.isFinite(Number(personId)) ? Number(personId) : null;
    renderPosePickerOverlay();
    renderReferencePoseOverlay();
}

function renderPosePickerOverlay(imageSize) {
    if (!dom.aiCleanPosePickerOverlay) return;
    const persons = Array.isArray(state.aiCleaning.referencePersons) ? state.aiCleaning.referencePersons : [];
    dom.aiCleanPosePickerOverlay.innerHTML = "";
    if (!persons.length) return;

    const size = imageSize || state.aiCleaning.referenceImageSize || {w: 1, h: 1};
    const width = Number(size?.w) || 1;
    const height = Number(size?.h) || 1;

    persons.forEach((person) => {
        const personId = Number(person.person_id);
        const bbox = Array.isArray(person.bbox_xyxy) ? person.bbox_xyxy : [0, 0, 0, 0];
        const [x1, y1, x2, y2] = bbox.map((value) => Number(value) || 0);
        const box = document.createElement("button");
        box.type = "button";
        box.className = "ai-clean-pose-box";
        if (state.aiCleaning.referencePersonId === personId) box.classList.add("selected");
        box.style.left = `${Math.max(0, (x1 / width) * 100)}%`;
        box.style.top = `${Math.max(0, (y1 / height) * 100)}%`;
        box.style.width = `${Math.max(0, ((x2 - x1) / width) * 100)}%`;
        box.style.height = `${Math.max(0, ((y2 - y1) / height) * 100)}%`;
        box.addEventListener("click", () => setSelectedReferencePerson(personId));

        const label = document.createElement("span");
        label.className = "ai-clean-pose-box-label";
        label.textContent = `${personId + 1}`;
        box.appendChild(label);
        dom.aiCleanPosePickerOverlay.appendChild(box);
    });

    if (!dom.aiCleanPosePickerSelected) return;
    if (state.aiCleaning.referencePersonId === null || state.aiCleaning.referencePersonId === undefined) {
        dom.aiCleanPosePickerSelected.textContent = "";
        dom.aiCleanPosePickerSelected.classList.add("hidden");
        return;
    }
    dom.aiCleanPosePickerSelected.textContent = formatText("ai.imageCleanPoseSelected", {id: state.aiCleaning.referencePersonId + 1});
    dom.aiCleanPosePickerSelected.classList.remove("hidden");
    renderReferencePoseOverlay();
}

function setReferenceFile(file, {clearResults = true} = {}) {
    if (file && file.type && !file.type.startsWith("image/")) {
        showModal(getText("modal.title"), getText("ai.imageCleanRefNotImage"));
        return;
    }

    disposeReferencePreview();
    clearPoseReferenceState();
    state.aiCleaning.referenceFile = file;
    if (clearResults) {
        state.aiCleaning.displayItems = state.aiCleaning.baseItems.slice();
        state.aiCleaning.hasSimilarity = false;
        state.aiCleaning.selected.clear();
    }
    state.aiCleaning.referencePreviewUrl = file ? URL.createObjectURL(file) : null;
    updateUploadNote();
    renderReferencePreview();
    syncAiCleanModeUi();
    if (state.aiCleaning.mode === "pose" && file) {
        loadReferencePosePreview();
    }
    renderAiCleanResults();
}

function drawPoseOverlay(canvas, keypoints) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);

    const dpr = window.devicePixelRatio || 1;
    context.save();
    context.scale(dpr, dpr);
    const w = width / dpr;
    const h = height / dpr;

    const kp = Array.isArray(keypoints) ? keypoints : [];
    const valid = (index) => {
        const item = kp[index];
        if (!Array.isArray(item) || item.length < 3) return null;
        const [x, y, c] = item;
        if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y)) || Number(c) < 0.3) return null;
        return {x: Number(x) * w, y: Number(y) * h};
    };

    context.lineWidth = 2;
    context.strokeStyle = "rgba(34, 197, 94, 0.9)";
    COCO_KEYPOINT_EDGES.forEach(([a, b]) => {
        const left = valid(a);
        const right = valid(b);
        if (!left || !right) return;
        context.beginPath();
        context.moveTo(left.x, left.y);
        context.lineTo(right.x, right.y);
        context.stroke();
    });

    context.fillStyle = "rgba(34, 197, 94, 0.95)";
    kp.forEach((_, index) => {
        const point = valid(index);
        if (!point) return;
        context.beginPath();
        context.arc(point.x, point.y, 3, 0, Math.PI * 2);
        context.fill();
    });

    context.restore();
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

        if (state.aiCleaning.mode === "pose" && state.aiCleaning.showPoseOverlay && Array.isArray(image.pose_keypoints)) {
            const thumb = card.querySelector(".image-thumb");
            const img = card.querySelector("img");
            if (thumb && img) {
                thumb.style.position = "relative";
            const canvas = document.createElement("canvas");
            canvas.className = "ai-clean-pose-canvas";
            thumb.appendChild(canvas);
                const redraw = () => {
                    const rect = thumb.getBoundingClientRect();
                    const w = Math.max(1, Math.floor(rect.width));
                    const h = Math.max(1, Math.floor(rect.height));
                    const dpr = window.devicePixelRatio || 1;
                    canvas.width = Math.floor(w * dpr);
                    canvas.height = Math.floor(h * dpr);
                    drawPoseOverlay(canvas, image.pose_keypoints);
                };
                if (img.complete) {
                    requestAnimationFrame(redraw);
                } else {
                    img.addEventListener("load", () => requestAnimationFrame(redraw), {once: true});
                }
            }
        }

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
    if (state.aiCleaning.mode === "pose") {
        if (state.aiCleaning.referencePoseLoading) {
            return showModal(getText("modal.title"), getText("ai.imageCleanPoseWait"));
        }
        if (!Array.isArray(state.aiCleaning.referencePersons) || state.aiCleaning.referencePersons.length === 0) {
            return showModal(getText("modal.title"), getText("ai.imageCleanPoseNoPersons"));
        }
        if (state.aiCleaning.referencePersonId === null || state.aiCleaning.referencePersonId === undefined) {
            return showModal(getText("modal.title"), getText("ai.imageCleanPoseNeedPick"));
        }
    }

    state.aiCleaning.running = true;
    dom.aiCleanRunBtn.disabled = true;
    try {
        const formData = new FormData();
        formData.append("reference", reference);
        formData.append("mode", state.aiCleaning.mode || "similarity");
        if (state.aiCleaning.mode === "pose") {
            formData.append("reference_person_id", String(state.aiCleaning.referencePersonId));
        }

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
    dom.aiCleanPoseOverlayToggle?.addEventListener("change", () => {
        state.aiCleaning.showPoseOverlay = Boolean(dom.aiCleanPoseOverlayToggle.checked);
        renderAiCleanResults();
        renderReferencePoseOverlay();
    });
    dom.aiCleanModeGroup?.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.name !== "aiCleanMode") return;
        state.aiCleaning.mode = target.value === "pose" ? "pose" : "similarity";
        syncAiCleanModeUi();
        if (state.aiCleaning.mode === "pose" && state.aiCleaning.referenceFile) loadReferencePosePreview();
    });
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
    syncAiCleanModeUi();
    dom.aiCleanPosePickerImg?.addEventListener("load", renderReferencePoseOverlay);

    registerTranslationHook(() => {
        updateUploadNote();
        updateAiCleanRunLabel();
        renderAiCleanResults();
        renderReferencePoseOverlay();
    });
}
