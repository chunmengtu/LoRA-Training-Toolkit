import {fetchJSON, postJSON} from "../core/api.js";
import {dom, readDataUrlFile, readTextFile} from "../core/dom.js";
import {appConfig, state} from "../core/state.js";
import {getText, registerTranslationHook} from "../core/i18n.js";
import {showModal} from "../core/modal.js";
import {showToast} from "../core/toast.js";

function updateAspectRatioInputState() {
    if (!dom.aspectRatioSelect) return;
    const isCustom = dom.aspectRatioSelect.value === "custom";
    dom.aspectRatioSelect.classList.toggle("hidden", isCustom);
    dom.aspectRatioCustomRow?.classList.toggle("hidden", !isCustom);
    if (isCustom) dom.customAspectRatioInput?.focus();
}

function resolveAspectRatioValue() {
    if (!dom.aspectRatioSelect) return "auto";
    return dom.aspectRatioSelect.value === "custom"
        ? dom.customAspectRatioInput?.value.trim() || ""
        : dom.aspectRatioSelect.value || "auto";
}

function setAspectRatioValue(value) {
    const resolved = (value || "").trim();
    if (!dom.aspectRatioSelect) return;
    if (!resolved) {
        dom.aspectRatioSelect.value = "auto";
        dom.customAspectRatioInput.value = "";
        updateAspectRatioInputState();
        return;
    }
    const hasOption = Array.from(dom.aspectRatioSelect.options).some((option) => option.value === resolved);
    if (hasOption) {
        dom.aspectRatioSelect.value = resolved;
        dom.customAspectRatioInput.value = "";
    } else {
        dom.aspectRatioSelect.value = "custom";
        dom.customAspectRatioInput.value = resolved;
    }
    updateAspectRatioInputState();
}

function formatExtraParams(params = {}) {
    return Object.keys(params || {}).length ? JSON.stringify(params, null, 2) : "";
}

function parseManualExtraParams() {
    const raw = dom.runninghubExtraParamsInput?.value.trim() || "";
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error(getText("images.runninghubExtraParamsInvalid"));
        }
        return parsed;
    } catch (error) {
        throw new Error(getText("images.runninghubExtraParamsInvalid"));
    }
}

export function updateAiSelectionHint() {
    if (!dom.aiSelectionHint) return;
    dom.aiSelectionHint.textContent = state.aiGallery.selected.size > 0
        ? getText("images.selectionSelected").replace("{{count}}", state.aiGallery.selected.size)
        : getText("images.selectionHint");
}

export function clearAiSelection() {
    state.aiGallery.selected.clear();
    document.querySelectorAll(".ai-card").forEach((element) => element.classList.remove("selected"));
    updateAiSelectionHint();
}

export function renderExtraReferenceList() {
    if (!dom.extraReferenceList) return;
    dom.extraReferenceSummary.textContent = state.extraReference.files.length
        ? getText("images.extraReferenceSummarySelected").replace("{{count}}", state.extraReference.files.length)
        : getText("images.extraReferenceSummaryIdle");
    if (!state.extraReference.files.length) {
        dom.extraReferenceList.classList.add("hidden");
        dom.extraReferenceList.innerHTML = "";
        return;
    }

    dom.extraReferenceList.classList.remove("hidden");
    dom.extraReferenceList.innerHTML = "";
    state.extraReference.files.forEach((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        const item = document.createElement("div");
        item.className = "reference-item";
        item.innerHTML = `
            <div class="reference-item-thumb">
                <img src="${previewUrl}" alt="${file.name}">
                <span class="reference-item-badge">${index + 2}</span>
                <button type="button" class="btn-reference-remove">x</button>
            </div>
            <span class="reference-item-label">${file.name}</span>
        `;
        item.querySelector("img").addEventListener("load", () => URL.revokeObjectURL(previewUrl));
        item.querySelector(".btn-reference-remove").addEventListener("click", () => {
            state.extraReference.files.splice(index, 1);
            renderExtraReferenceList();
        });
        dom.extraReferenceList.appendChild(item);
    });
}

function applyParsedRunningHubExample(data = {}) {
    if (data.model && dom.runninghubModelInput) dom.runninghubModelInput.value = data.model;
    if (data.image_api_url && dom.runninghubImageUrlInput) dom.runninghubImageUrlInput.value = data.image_api_url;
    if (data.query_url && dom.runninghubQueryUrlInput) dom.runninghubQueryUrlInput.value = data.query_url;
    if (data.prompt && dom.promptInput) dom.promptInput.value = data.prompt;
    if (Object.prototype.hasOwnProperty.call(data, "aspect_ratio")) setAspectRatioValue(data.aspect_ratio || "");
    if (dom.runninghubExtraParamsInput) dom.runninghubExtraParamsInput.value = formatExtraParams(data.extra_params || {});
}

async function handleRunningHubExampleParse() {
    dom.runninghubParseBtn.disabled = true;
    try {
        let exampleText = dom.runninghubExampleTextInput?.value.trim() || "";
        if (!exampleText && dom.runninghubExampleFileInput?.files?.length) {
            exampleText = (await readTextFile(dom.runninghubExampleFileInput.files[0])).trim();
            dom.runninghubExampleTextInput.value = exampleText;
        }
        if (!exampleText) throw new Error(getText("images.exampleParseRequired"));
        const response = await postJSON("/api/runninghub/parse_example", {example_text: exampleText});
        applyParsedRunningHubExample(response.data || {});
        showToast(response.message || getText("images.exampleParseSuccess"));
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("images.exampleParseRequired"));
    } finally {
        dom.runninghubParseBtn.disabled = false;
    }
}

export function initializeGenerationDefaults() {
    if (!dom.runninghubQueryUrlInput?.value) dom.runninghubQueryUrlInput.value = appConfig.runninghubQueryUrl || "";
    setAspectRatioValue(appConfig.runninghubDefaultAspectRatio || "auto");
}

export async function loadAiGallery(keyword = "") {
    if (!dom.aiGrid) return;
    state.aiGallery.filterKeyword = keyword;
    try {
        const response = await fetchJSON(keyword ? `/api/ai/list?keyword=${encodeURIComponent(keyword)}` : "/api/ai/list");
        state.aiGallery.items = response.pairs || [];
        renderAiGallery(state.aiGallery.items);
    } catch (error) {
        console.error("load ai gallery failed", error);
        dom.aiGrid.textContent = getText("images.galleryEmpty");
    }
}

function attachAiCardEvents(card, stem, srcPath) {
    card.addEventListener("click", (event) => {
        if (event.target.closest(".btn-upload-gen") || event.target.closest(".hidden-file-input")) return;
        if (state.aiGallery.selected.has(srcPath)) {
            state.aiGallery.selected.delete(srcPath);
            card.classList.remove("selected");
        } else {
            state.aiGallery.selected.add(srcPath);
            card.classList.add("selected");
        }
        updateAiSelectionHint();
    });

    const uploadButton = card.querySelector(".btn-upload-gen");
    const fileInput = card.querySelector(".hidden-file-input");
    if (uploadButton && fileInput) {
        uploadButton.addEventListener("click", (event) => {
            event.stopPropagation();
            fileInput.click();
        });
        fileInput.addEventListener("change", async () => {
            if (!fileInput.files.length) return;
            const formData = new FormData();
            formData.append("file", fileInput.files[0]);
            formData.append("target_stem", stem);
            try {
                uploadButton.disabled = true;
                uploadButton.innerHTML = '<div class="spinner-sm"></div>';
                const response = await fetch("/api/ai/upload_generated", {method: "POST", body: formData});
                const json = await response.json();
                if (!response.ok) throw new Error(json.message);
                showToast(getText("images.manualUploadSuccess"));
                loadAiGallery(state.aiGallery.filterKeyword);
            } catch (error) {
                showToast(error.message || getText("images.manualUploadFailed"));
                uploadButton.disabled = false;
                uploadButton.innerHTML = "<span>+</span>";
            }
        });
    }

    card.querySelectorAll("img").forEach((image) => {
        image.addEventListener("click", (event) => {
            event.stopPropagation();
            window.open(image.dataset.full || image.src, "_blank");
        });
    });
}

export function renderAiGallery(pairs) {
    if (!dom.aiGrid) return;
    const existingCards = new Map();
    dom.aiGrid.querySelectorAll(".ai-card").forEach((card) => existingCards.set(card.dataset.src, card));
    const newKeys = new Set();
    if (!pairs.length) {
        dom.aiGrid.textContent = getText("images.galleryEmpty");
        return;
    }
    if (dom.aiGrid.firstChild?.nodeType === Node.TEXT_NODE) dom.aiGrid.innerHTML = "";

    const available = new Set(pairs.map((pair) => pair.source.relative_path));
    Array.from(state.aiGallery.selected).forEach((path) => !available.has(path) && state.aiGallery.selected.delete(path));

    pairs.forEach((pair) => {
        const srcPath = pair.source.relative_path;
        const stem = pair.source.name.replace(/\.[^/.]+$/, "");
        const isGenerating = state.generating.active && state.generating.targets.has(srcPath);
        const sourceUrl = `/api/thumbnail/source/${srcPath}?t=${pair.source.modified}`;
        const fullSourceUrl = `${pair.source.url}?t=${pair.source.modified}`;
        const generated = pair.generated[0];
        const generatedUrl = generated ? `/api/thumbnail/generated/${generated.relative_path}?t=${generated.modified}` : "";
        const fullGeneratedUrl = generated ? `${generated.url}?t=${generated.modified}` : "";
        const generatedHtml = generated
            ? `<img src="${generatedUrl}" data-full="${fullGeneratedUrl}" class="ai-img-gen" alt="Generated" loading="lazy">`
            : `<div class="ai-img-placeholder"><button type="button" class="btn-upload-gen" title="${getText("images.manualUploadTitle")}"><span>+</span></button><input type="file" class="hidden-file-input" accept="image/*" style="display:none"></div>`;
        const loadingHtml = isGenerating && !generated ? '<div class="ai-loading-overlay"><div class="spinner-md"></div></div>' : "";
        const innerHTML = `
            <div class="ai-pair">
                <div class="ai-img-box"><img src="${sourceUrl}" data-full="${fullSourceUrl}" class="ai-img-src" alt="Source" loading="lazy"></div>
                <div class="ai-img-box">${generatedHtml}${loadingHtml}</div>
            </div>
            <div class="ai-meta">
                <div class="ai-tags">${pair.tags || ""}</div>
                <div class="ai-name">${pair.source.name}</div>
            </div>
        `;

        let card = existingCards.get(srcPath);
        if (!card) {
            card = document.createElement("div");
            card.className = "ai-card";
            card.dataset.src = srcPath;
            card.innerHTML = innerHTML;
            dom.aiGrid.appendChild(card);
            attachAiCardEvents(card, stem, srcPath);
        } else if (card.innerHTML !== innerHTML) {
            card.innerHTML = innerHTML;
            attachAiCardEvents(card, stem, srcPath);
        }

        card.classList.toggle("selected", state.aiGallery.selected.has(srcPath));
        newKeys.add(srcPath);
    });

    existingCards.forEach((card, path) => !newKeys.has(path) && card.remove());
    updateAiSelectionHint();
}

async function handleGenerateSubmit(event) {
    event.preventDefault();
    dom.generateBtn.disabled = true;

    let extraParams = {};
    try {
        extraParams = parseManualExtraParams();
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("images.runninghubExtraParamsInvalid"));
        dom.generateBtn.disabled = false;
        return;
    }

    const payload = {
        model: dom.runninghubModelInput?.value.trim() || "",
        prompt: dom.promptInput?.value.trim() || "",
        overwrite: dom.overwriteToggle?.checked ?? false,
        targets: Array.from(state.aiGallery.selected),
        api_key: dom.runninghubApiKeyInput?.value.trim() || "",
        aspect_ratio: resolveAspectRatioValue(),
        image_api_url: dom.runninghubImageUrlInput?.value.trim() || "",
        query_url: dom.runninghubQueryUrlInput?.value.trim() || appConfig.runninghubQueryUrl || "",
        extra_params: extraParams,
    };

    if (!payload.api_key) {
        showModal(getText("modal.title"), getText("images.configRequired"));
        dom.generateBtn.disabled = false;
        return;
    }
    if (!payload.model && !payload.image_api_url) {
        showModal(getText("modal.title"), getText("images.runninghubModelRequired"));
        dom.generateBtn.disabled = false;
        return;
    }
    if (!payload.image_api_url) {
        showModal(getText("modal.title"), getText("images.requestUrlRequired"));
        dom.generateBtn.disabled = false;
        return;
    }
    if (!payload.query_url) {
        showModal(getText("modal.title"), getText("images.queryUrlRequired"));
        dom.generateBtn.disabled = false;
        return;
    }

    try {
        if (state.extraReference.files.length) {
            payload.extra_reference_images = await Promise.all(
                state.extraReference.files.map(async (file) => ({name: file.name, data_url: await readDataUrlFile(file)})),
            );
        }
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("images.extraReferenceNodeMissing"));
        dom.generateBtn.disabled = false;
        return;
    }

    state.generating.active = true;
    state.generating.targets = new Set(payload.targets.length ? payload.targets : state.aiGallery.items.map((item) => item.source.relative_path));
    renderAiGallery(state.aiGallery.items);

    try {
        const response = await postJSON("/api/images/generate", payload);
        showModal(getText("modal.title"), response.message);
        loadAiGallery(state.aiGallery.filterKeyword);
    } catch (error) {
        showModal(getText("modal.title"), error.message);
        state.generating.active = false;
        state.generating.targets.clear();
        renderAiGallery(state.aiGallery.items);
    } finally {
        dom.generateBtn.disabled = false;
    }
}

async function handleTagSubmit(event) {
    event.preventDefault();
    const submitButton = dom.tagForm?.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const response = await postJSON("/api/images/tag", {
            targets: Array.from(state.aiGallery.selected),
            tags: dom.tagInput?.value.trim() || "",
        });
        showToast(response.message || getText("ai.tagSuccess"));
        loadAiGallery(state.aiGallery.filterKeyword);
    } catch (error) {
        showModal(getText("modal.title"), error.message);
    } finally {
        submitButton.disabled = false;
    }
}

export function initAiGenerateModule() {
    dom.aspectRatioSelect?.addEventListener("change", updateAspectRatioInputState);
    dom.aspectRatioBackBtn?.addEventListener("click", () => {
        dom.aspectRatioSelect.value = "auto";
        dom.customAspectRatioInput.value = "";
        updateAspectRatioInputState();
    });
    dom.extraReferenceInput?.addEventListener("change", () => {
        const files = Array.from(dom.extraReferenceInput.files || []).filter((file) => file.type.startsWith("image/"));
        if (files.length) state.extraReference.files.push(...files);
        renderExtraReferenceList();
        dom.extraReferenceInput.value = "";
    });
    dom.runninghubParseBtn?.addEventListener("click", handleRunningHubExampleParse);
    dom.runninghubExampleFileInput?.addEventListener("change", async () => {
        const file = dom.runninghubExampleFileInput?.files?.[0];
        if (!file) return;
        try {
            dom.runninghubExampleTextInput.value = await readTextFile(file);
        } catch (error) {
            showModal(getText("modal.title"), error.message || getText("images.exampleParseRequired"));
        }
    });
    dom.generationForm?.addEventListener("submit", handleGenerateSubmit);
    dom.clearAiSelectionBtn?.addEventListener("click", clearAiSelection);
    dom.applyAiFilterBtn?.addEventListener("click", () => loadAiGallery(dom.aiGalleryFilter?.value.trim() || ""));
    dom.tagForm?.addEventListener("submit", handleTagSubmit);

    registerTranslationHook(() => {
        renderExtraReferenceList();
        updateAiSelectionHint();
        if (state.aiGallery.items.length) renderAiGallery(state.aiGallery.items);
    });
}
