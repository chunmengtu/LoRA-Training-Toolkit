import {postJSON} from "../core/api.js";
import {dom, formatBytes} from "../core/dom.js";
import {getText, registerTranslationHook} from "../core/i18n.js";
import {showModal} from "../core/modal.js";
import {AI_TAG_DIMENSIONS, DEFAULT_AI_TAG_PROMPT, resetAiTaggingFilters, state} from "../core/state.js";
import {getAiPlatformConfig, validateAiPlatformConfig} from "./models.js";

export function updateAiTagSelectionHint() {
    if (!dom.aiTagSelectionHint) return;
    dom.aiTagSelectionHint.textContent = state.gallery.selected.size > 0
        ? getText("images.selectionSelected").replace("{{count}}", state.gallery.selected.size)
        : getText("ai.cleanSelectionHint");
}

export function syncTagBaseFromGallery() {
    state.aiTagging.baseItems = Array.isArray(state.gallery.items) ? state.gallery.items.slice() : [];
    renderAiTagGallery();
    updateAiTagSelectionHint();
}

function computeAiTagDimensionTags() {
    state.aiTagging.dimensionTags = {
        main_subject: new Set(),
        appearance: new Set(),
        action_state: new Set(),
        environment: new Set(),
        visual_style: new Set(),
    };
    state.aiTagging.itemsByPath.forEach((payload) => {
        const tags = payload?.tags || {};
        AI_TAG_DIMENSIONS.forEach(({key}) => {
            (Array.isArray(tags[key]) ? tags[key] : []).forEach((value) => {
                if (value) state.aiTagging.dimensionTags[key].add(String(value));
            });
        });
    });
}

export function renderAiTagFilters() {
    if (!dom.aiTagFilters) return;
    dom.aiTagFilters.innerHTML = "";
    if (state.aiTagging.itemsByPath.size === 0) {
        const paragraph = document.createElement("p");
        paragraph.className = "tool-hint";
        paragraph.textContent = getText("ai.cleanNoTags");
        dom.aiTagFilters.appendChild(paragraph);
        return;
    }

    AI_TAG_DIMENSIONS.forEach(({key, labelKey}) => {
        const values = Array.from(state.aiTagging.dimensionTags[key] || []);
        if (!values.length) return;
        const section = document.createElement("div");
        section.className = "clean-filter-section";
        section.innerHTML = `<div class="clean-filter-title">${getText(labelKey)}</div><div class="clean-filter-tags"></div>`;
        const wrapper = section.querySelector(".clean-filter-tags");
        values.forEach((tag) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `clean-tag-chip${state.aiTagging.selectedTags[key].has(tag) ? " active" : ""}`;
            chip.textContent = tag;
            chip.addEventListener("click", () => {
                const selectedSet = state.aiTagging.selectedTags[key];
                if (selectedSet.has(tag)) selectedSet.delete(tag); else selectedSet.add(tag);
                renderAiTagFilters();
                renderAiTagGallery();
            });
            wrapper.appendChild(chip);
        });
        dom.aiTagFilters.appendChild(section);
    });
}

export function renderAiTagGallery() {
    if (!dom.aiTagGrid) return;
    const sourceItems = Array.isArray(state.aiTagging.baseItems) ? state.aiTagging.baseItems : [];
    if (!sourceItems.length) {
        dom.aiTagGrid.textContent = getText("images.galleryEmpty");
        return;
    }

    const keyword = (state.aiTagging.filterKeyword || "").trim().toLowerCase();
    const hasFilter = Object.values(state.aiTagging.selectedTags).some((tagSet) => tagSet.size > 0);
    const filtered = sourceItems.filter((image) => {
        if (keyword && !String(image?.name || "").toLowerCase().includes(keyword)) return false;
        if (state.aiTagging.itemsByPath.size === 0) return true;
        const payload = state.aiTagging.itemsByPath.get(image.relative_path);
        if (!payload?.tags) return !hasFilter;
        return AI_TAG_DIMENSIONS.every(({key}) => {
            const selectedTags = state.aiTagging.selectedTags[key];
            if (!selectedTags.size) return true;
            const values = Array.isArray(payload.tags[key]) ? payload.tags[key] : [];
            return values.some((value) => selectedTags.has(String(value)));
        });
    });

    dom.aiTagGrid.innerHTML = "";
    if (!filtered.length) {
        dom.aiTagGrid.textContent = getText("images.galleryEmpty");
        return;
    }

    filtered.forEach((image) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "image-card";
        card.innerHTML = `
            <div class="image-thumb">
                <img src="/api/thumbnail/source/${image.relative_path}?t=${image.modified}" alt="${image.name}" loading="lazy">
            </div>
            <div class="image-meta">
                <strong>${image.name}</strong>
                <span>${formatBytes(image.size)}</span>
            </div>
        `;
        if (state.aiTagging.processing.has(image.relative_path)) {
            const overlay = document.createElement("div");
            overlay.className = "ai-loading-overlay";
            overlay.innerHTML = '<div class="spinner-md"></div>';
            card.appendChild(overlay);
        }
        dom.aiTagGrid.appendChild(card);
    });
}

function applyAiTagGalleryFilter() {
    state.aiTagging.filterKeyword = dom.aiTagGalleryFilter?.value.trim() || "";
    renderAiTagGallery();
}

function applyTaggingResults(items) {
    items.forEach((item) => {
        if (item?.relative_path) {
            state.aiTagging.itemsByPath.set(item.relative_path, {tags: item.tags || {}});
        }
    });
    computeAiTagDimensionTags();
    renderAiTagFilters();
    renderAiTagGallery();
}

async function handleAiConfigTestClick() {
    const config = getAiPlatformConfig();
    const errorMessage = validateAiPlatformConfig(config);
    if (errorMessage) return showModal(getText("modal.title"), errorMessage);
    dom.aiTestConfigBtn.disabled = true;
    try {
        const response = await postJSON("/api/ai/config/test", {
            provider: config.provider,
            model: config.model,
            api_key: config.apiKey,
            base_url: config.baseUrl,
        });
        showModal(getText("modal.title"), response.message || getText("ai.platformTestOk"));
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("ai.platformTestFail"));
    } finally {
        dom.aiTestConfigBtn.disabled = false;
    }
}

async function handleAiTagSubmit(event) {
    event.preventDefault();
    const config = getAiPlatformConfig();
    const errorMessage = validateAiPlatformConfig(config);
    if (errorMessage) return showModal(getText("modal.title"), errorMessage);

    const promptValue = dom.aiTagPromptInput?.value.trim() || DEFAULT_AI_TAG_PROMPT;
    const baseItems = state.aiTagging.baseItems.length ? state.aiTagging.baseItems : state.gallery.items;
    const targets = Array.from(state.gallery.selected);
    state.aiTagging.processing = new Set(targets.length ? targets : baseItems.map((item) => item.relative_path));
    renderAiTagGallery();
    dom.aiTagRunBtn.disabled = true;

    try {
        const response = await postJSON("/api/ai/tag", {
            prompt: promptValue,
            provider: config.provider,
            model: config.model,
            api_key: config.apiKey,
            base_url: config.baseUrl,
            targets,
        });
        applyTaggingResults(response.items || []);
        showModal(getText("modal.title"), response.message || getText("ai.cleanResultTitle"));
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("ai.platformTestFail"));
    } finally {
        dom.aiTagRunBtn.disabled = false;
        state.aiTagging.processing = new Set();
        renderAiTagGallery();
    }
}

export function initAiTagModule() {
    if (dom.aiTagPromptInput && !dom.aiTagPromptInput.value) dom.aiTagPromptInput.value = DEFAULT_AI_TAG_PROMPT;
    dom.aiTestConfigBtn?.addEventListener("click", handleAiConfigTestClick);
    dom.aiTagForm?.addEventListener("submit", handleAiTagSubmit);
    dom.applyAiTagFilterBtn?.addEventListener("click", applyAiTagGalleryFilter);
    dom.aiTagGalleryFilter?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        applyAiTagGalleryFilter();
    });
    dom.aiTagResetBtn?.addEventListener("click", () => {
        resetAiTaggingFilters();
        computeAiTagDimensionTags();
        renderAiTagFilters();
        renderAiTagGallery();
    });

    registerTranslationHook(() => {
        updateAiTagSelectionHint();
        renderAiTagFilters();
        if (state.aiTagging.baseItems.length) renderAiTagGallery();
    });
}
