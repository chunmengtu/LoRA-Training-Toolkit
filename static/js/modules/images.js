import {fetchJSON, postJSON} from "../core/api.js";
import {dom, formatBytes} from "../core/dom.js";
import {formatText, getText, registerTranslationHook} from "../core/i18n.js";
import {hideModal, showModal} from "../core/modal.js";
import {state} from "../core/state.js";
import {showToast} from "../core/toast.js";
import {updateGamifiedProgress} from "./console.js";

const galleryHooks = new Set();

export function registerGalleryHook(callback) {
    galleryHooks.add(callback);
}

function notifyGalleryHooks() {
    galleryHooks.forEach((callback) => callback(state.gallery.items));
}

function updateUploadAutoNote(count = 0) {
    if (!dom.uploadAutoNote) return;
    dom.uploadAutoNote.textContent = count > 0
        ? formatText("images.uploadSelectedCount", {count})
        : getText("images.uploadAutoNote");
}

export function updateSelectionHint() {
    if (!dom.selectionHint) return;
    dom.selectionHint.textContent = state.gallery.selected.size > 0
        ? getText("images.selectionSelected").replace("{{count}}", state.gallery.selected.size)
        : getText("images.selectionHint");
}

export function clearSelection() {
    state.gallery.selected.clear();
    document.querySelectorAll(".image-card").forEach((element) => element.classList.remove("selected"));
    updateSelectionHint();
}

export async function loadGallery(keyword = "") {
    if (!dom.imageGrid) return;
    state.gallery.filterKeyword = keyword;
    try {
        const response = await fetchJSON(
            keyword ? `/api/images/list?keyword=${encodeURIComponent(keyword)}` : "/api/images/list",
        );
        state.gallery.items = response.images || [];
        renderGallery(state.gallery.items);
        notifyGalleryHooks();
    } catch (error) {
        console.error("load gallery failed", error);
        dom.imageGrid.textContent = getText("images.galleryEmpty");
    }
}

export function renderGallery(images) {
    if (!dom.imageGrid) return;
    dom.imageGrid.innerHTML = "";
    if (!images.length) {
        dom.imageGrid.textContent = getText("images.galleryEmpty");
        return;
    }

    const available = new Set(images.map((item) => item.relative_path));
    Array.from(state.gallery.selected).forEach((path) => {
        if (!available.has(path)) state.gallery.selected.delete(path);
    });

    images.forEach((image) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "image-card";
        if (state.gallery.selected.has(image.relative_path)) card.classList.add("selected");
        card.innerHTML = `
            <div class="image-thumb">
                <img src="/api/thumbnail/source/${image.relative_path}?t=${image.modified}" alt="${image.name}" loading="lazy">
            </div>
            <div class="image-meta">
                <strong>${image.name}</strong>
                <span>${formatBytes(image.size)}</span>
            </div>
        `;
        card.addEventListener("click", () => {
            if (state.gallery.selected.has(image.relative_path)) {
                state.gallery.selected.delete(image.relative_path);
                card.classList.remove("selected");
            } else {
                state.gallery.selected.add(image.relative_path);
                card.classList.add("selected");
            }
            updateSelectionHint();
            galleryHooks.forEach((callback) => callback(state.gallery.items));
        });
        dom.imageGrid.appendChild(card);
    });

    updateSelectionHint();
}

function disposeUploadPreviews() {
    state.uploadProgress.trackers.forEach((tracker) => {
        if (tracker?.previewUrl) {
            URL.revokeObjectURL(tracker.previewUrl);
            tracker.previewUrl = null;
        }
    });
}

function updateUploadProgressHint() {
    if (!dom.uploadProgressHint) return;
    const {total, finished, failed} = state.uploadProgress;
    if (!total) {
        dom.uploadProgressHint.textContent = getText("images.uploadProgressIdle");
    } else if (finished === 0) {
        dom.uploadProgressHint.textContent = getText("images.uploadProgressPreparing").replace("{{count}}", total);
    } else if (finished < total) {
        dom.uploadProgressHint.textContent = getText("images.uploadProgressRunning")
            .replace("{{done}}", finished)
            .replace("{{total}}", total);
    } else {
        dom.uploadProgressHint.textContent = failed ? getText("images.uploadProgressError") : getText("images.uploadProgressDone");
    }
}

function createUploadProgressCard(file, index, total) {
    if (!dom.uploadProgressList) return null;
    const card = document.createElement("div");
    card.className = "upload-progress-card";
    card.innerHTML = `
        <div class="upload-progress-thumb">
            <img alt="${file.name}">
            <span class="upload-progress-index">${index + 1}/${total}</span>
        </div>
        <div class="upload-progress-bar"><div class="upload-progress-bar-fill"></div></div>
        <p class="upload-progress-name">${file.name}</p>
        <p class="upload-progress-status">${getText("images.uploadProgressWaiting")}</p>
    `;
    dom.uploadProgressList.appendChild(card);
    return {
        card,
        fill: card.querySelector(".upload-progress-bar-fill"),
        status: card.querySelector(".upload-progress-status"),
        img: card.querySelector("img"),
        previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : null,
    };
}

function initUploadProgress(files) {
    if (!files.length) return [];
    if (state.uploadProgress.timer) {
        clearTimeout(state.uploadProgress.timer);
        state.uploadProgress.timer = null;
    }
    disposeUploadPreviews();
    state.uploadProgress.total = files.length;
    state.uploadProgress.finished = 0;
    state.uploadProgress.failed = 0;
    if (dom.uploadProgressList) dom.uploadProgressList.innerHTML = "";
    dom.uploadProgressTray?.classList.remove("hidden");
    state.uploadProgress.trackers = files.map((file, index) => createUploadProgressCard(file, index, files.length));
    updateUploadProgressHint();
    return state.uploadProgress.trackers;
}

function setUploadCardProgress(tracker, percent) {
    if (!tracker?.fill) return;
    const clamped = Math.min(100, Math.max(0, percent));
    tracker.fill.style.width = `${clamped}%`;
    if (tracker.status && clamped > 0 && clamped < 100) tracker.status.textContent = `${clamped}%`;
}

function markUploadCardDone(tracker, success, message) {
    if (tracker?.card) {
        tracker.card.classList.remove("is-success", "is-error");
        tracker.card.classList.add(success ? "is-success" : "is-error");
    }
    if (tracker?.status) tracker.status.textContent = message || (success ? getText("images.uploadProgressSuccess") : getText("images.uploadProgressFailed"));
    setUploadCardProgress(tracker, 100);
    if (success && tracker?.previewUrl && tracker?.img) {
        tracker.img.src = tracker.previewUrl;
        tracker.img.classList.add("visible");
        setTimeout(() => {
            if (tracker.previewUrl) URL.revokeObjectURL(tracker.previewUrl);
        }, 8000);
    }
    state.uploadProgress.finished += 1;
    if (!success) state.uploadProgress.failed += 1;
    updateUploadProgressHint();
}

function finalizeUploadProgress() {
    if (state.uploadProgress.timer) clearTimeout(state.uploadProgress.timer);
    state.uploadProgress.timer = setTimeout(() => {
        dom.uploadProgressTray?.classList.add("hidden");
        if (dom.uploadProgressList) dom.uploadProgressList.innerHTML = "";
        disposeUploadPreviews();
        state.uploadProgress.trackers = [];
        state.uploadProgress.total = 0;
        state.uploadProgress.finished = 0;
        state.uploadProgress.failed = 0;
        updateUploadProgressHint();
        state.uploadProgress.timer = null;
    }, state.uploadProgress.failed ? 3200 : 1800);
}

function uploadSingleFile(file, tracker) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/images/upload");
        xhr.responseType = "json";
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            setUploadCardProgress(tracker, Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () => reject(new Error(getText("images.uploadProgressNetwork")));
        xhr.onload = () => {
            const data = xhr.response || {};
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(data);
            } else {
                reject(new Error(data.message || `${getText("images.uploadProgressFailed")} (${xhr.status})`));
            }
        };
        const formData = new FormData();
        formData.append("files", file, file.webkitRelativePath || file.name);
        xhr.send(formData);
    });
}

async function handleUploadSubmit(event, droppedFiles = null) {
    event?.preventDefault?.();
    const files = droppedFiles ? Array.from(droppedFiles) : Array.from(dom.imageInput?.files || []);
    if (!files.length) {
        updateUploadAutoNote();
        showToast(getText("images.uploadEmpty"));
        return;
    }
    updateUploadAutoNote(files.length);
    if (state.isUploading) {
        showToast(getText("images.uploadBusy"));
        return;
    }
    state.isUploading = true;
    updateGamifiedProgress("images", 0, true);
    const trackers = initUploadProgress(files);
    const stats = {added: 0, skipped: 0, failed: 0};
    try {
        for (let index = 0; index < files.length; index += 1) {
            updateGamifiedProgress("images", Math.round((index / files.length) * 100), true);
            try {
                const result = await uploadSingleFile(files[index], trackers[index]);
                stats.added += Number(result?.added ?? (Array.isArray(result?.items) ? result.items.length : 1)) || 0;
                stats.skipped += Number(result?.skipped ?? 0) || 0;
                markUploadCardDone(trackers[index], true, getText("images.uploadProgressSuccess"));
            } catch (error) {
                stats.failed += 1;
                markUploadCardDone(trackers[index], false, error.message || getText("images.uploadProgressFailed"));
            }
        }
        dom.uploadForm?.reset();
        await loadGallery(state.gallery.filterKeyword);
        const parts = [];
        if (stats.added) parts.push(getText("images.uploadSummarySuccess").replace("{{count}}", stats.added));
        if (stats.skipped) parts.push(getText("images.uploadSummarySkip").replace("{{count}}", stats.skipped));
        if (stats.failed) parts.push(getText("images.uploadSummaryFail").replace("{{count}}", stats.failed));
        showModal(getText("modal.title"), `${getText(stats.failed ? "images.uploadProgressError" : "images.uploadProgressDone")}：${parts.join("，")}`);
        updateGamifiedProgress("images", 100, true);
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("images.uploadProgressFailed"));
    } finally {
        finalizeUploadProgress();
        state.isUploading = false;
        updateUploadAutoNote();
        setTimeout(() => updateGamifiedProgress("images", 0, false), 2000);
    }
}

async function handleClearAllClick() {
    showModal(getText("modal.title"), getText("images.clearConfirm"), [
        {
            label: getText("images.clearAll"),
            variant: "primary",
            handler: async () => {
                dom.clearAllBtn.disabled = true;
                hideModal();
                try {
                    const response = await postJSON("/api/images/clear", {});
                    clearSelection();
                    await loadGallery(state.gallery.filterKeyword);
                    showModal(getText("modal.title"), response.message || getText("images.clearSuccess"));
                } catch (error) {
                    showModal(getText("modal.title"), error.message || getText("images.clearSuccess"));
                } finally {
                    dom.clearAllBtn.disabled = false;
                }
            },
        },
        {label: getText("step.prev"), variant: "secondary", handler: hideModal},
    ]);
}

async function handleDeleteSelectedClick() {
    if (!state.gallery.selected.size) {
        showToast(getText("images.deleteEmpty"));
        return;
    }

    showModal(getText("modal.title"), getText("images.deleteConfirm"), [
        {
            label: getText("images.deleteSelected"),
            variant: "primary",
            handler: async () => {
                dom.deleteSelectedBtn.disabled = true;
                hideModal();
                try {
                    const response = await postJSON("/api/images/delete", {targets: Array.from(state.gallery.selected)});
                    clearSelection();
                    await loadGallery(state.gallery.filterKeyword);
                    showModal(getText("modal.title"), response.message || getText("images.deleteSuccess"));
                } catch (error) {
                    showModal(getText("modal.title"), error.message || getText("images.deleteSuccess"));
                } finally {
                    dom.deleteSelectedBtn.disabled = false;
                }
            },
        },
        {label: getText("step.prev"), variant: "secondary", handler: hideModal},
    ]);
}

async function handleOrganizeSubmit(event) {
    event.preventDefault();
    const submitButton = dom.renameForm?.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const response = await postJSON("/api/images/organize", {
            prefix: dom.prefixInput?.value.trim() || "",
            start_number: Number(dom.startNumberInput?.value) || 1,
            apply_prefix: true,
            apply_sequence: true,
            keyword: dom.keywordInput?.value.trim() || "",
            keyword_action: dom.keywordActionSelect?.value || "none",
            targets: Array.from(state.gallery.selected),
        });
        showModal(getText("modal.title"), response.message);
        loadGallery(state.gallery.filterKeyword);
    } catch (error) {
        showModal(getText("modal.title"), error.message);
    } finally {
        submitButton.disabled = false;
    }
}

function bindUploadZone() {
    const uploadZone = document.querySelector(".upload-zone");
    if (!uploadZone) return;
    const preventDefaults = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((name) => uploadZone.addEventListener(name, preventDefaults));
    ["dragenter", "dragover"].forEach((name) => uploadZone.addEventListener(name, () => uploadZone.classList.add("highlight")));
    ["dragleave", "drop"].forEach((name) => uploadZone.addEventListener(name, () => uploadZone.classList.remove("highlight")));
    uploadZone.addEventListener("drop", (event) => {
        const files = event.dataTransfer?.files;
        if (files?.length) handleUploadSubmit(null, files);
    });
}

export function initImagesModule() {
    dom.uploadForm?.addEventListener("submit", handleUploadSubmit);
    dom.imageInput?.addEventListener("change", () => {
        const count = dom.imageInput?.files?.length || 0;
        updateUploadAutoNote(count);
        if (count) handleUploadSubmit();
    });
    dom.refreshGalleryBtn?.addEventListener("click", () => loadGallery(state.gallery.filterKeyword));
    dom.clearAllBtn?.addEventListener("click", handleClearAllClick);
    dom.deleteSelectedBtn?.addEventListener("click", handleDeleteSelectedClick);
    dom.renameForm?.addEventListener("submit", handleOrganizeSubmit);
    dom.applyFilterBtn?.addEventListener("click", () => loadGallery(dom.galleryFilter?.value.trim() || ""));
    dom.clearSelectionBtn?.addEventListener("click", clearSelection);
    bindUploadZone();

    registerTranslationHook(() => {
        updateSelectionHint();
        updateUploadProgressHint();
        updateUploadAutoNote(dom.imageInput?.files?.length || 0);
        if (state.gallery.items.length) renderGallery(state.gallery.items);
    });
}
