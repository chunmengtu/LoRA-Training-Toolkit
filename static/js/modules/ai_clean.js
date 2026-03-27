import {postJSON} from "../core/api.js";
import {dom, formatBytes} from "../core/dom.js";
import {getText, registerTranslationHook} from "../core/i18n.js";
import {showModal} from "../core/modal.js";
import {AI_CLEAN_DIMENSIONS, DEFAULT_AI_CLEAN_PROMPT, resetAiCleaningFilters, state} from "../core/state.js";
import {getAiPlatformConfig, validateAiPlatformConfig} from "./models.js";

export function updateAiCleanSelectionHint() {
    if (!dom.aiCleanSelectionHint) return;
    dom.aiCleanSelectionHint.textContent = state.gallery.selected.size > 0
        ? getText("images.selectionSelected").replace("{{count}}", state.gallery.selected.size)
        : getText("ai.cleanSelectionHint");
}

export function syncBaseFromGallery() {
    state.aiCleaning.baseItems = Array.isArray(state.gallery.items) ? state.gallery.items.slice() : [];
    renderAiCleanGallery();
    updateAiCleanSelectionHint();
}

function computeAiCleanDimensionTags() {
    state.aiCleaning.dimensionTags = {
        main_subject: new Set(),
        appearance: new Set(),
        action_state: new Set(),
        environment: new Set(),
        visual_style: new Set(),
    };
    state.aiCleaning.itemsByPath.forEach((payload) => {
        const tags = payload?.tags || {};
        AI_CLEAN_DIMENSIONS.forEach(({key}) => {
            (Array.isArray(tags[key]) ? tags[key] : []).forEach((value) => {
                if (value) state.aiCleaning.dimensionTags[key].add(String(value));
            });
        });
    });
}

export function renderAiCleanFilters() {
    if (!dom.aiCleanFilters) return;
    dom.aiCleanFilters.innerHTML = "";
    if (state.aiCleaning.itemsByPath.size === 0) {
        const paragraph = document.createElement("p");
        paragraph.className = "tool-hint";
        paragraph.textContent = getText("ai.cleanNoTags");
        dom.aiCleanFilters.appendChild(paragraph);
        return;
    }

    AI_CLEAN_DIMENSIONS.forEach(({key, labelKey}) => {
        const values = Array.from(state.aiCleaning.dimensionTags[key] || []);
        if (!values.length) return;
        const section = document.createElement("div");
        section.className = "clean-filter-section";
        section.innerHTML = `<div class="clean-filter-title">${getText(labelKey)}</div><div class="clean-filter-tags"></div>`;
        const wrapper = section.querySelector(".clean-filter-tags");
        values.forEach((tag) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `clean-tag-chip${state.aiCleaning.selectedTags[key].has(tag) ? " active" : ""}`;
            chip.textContent = tag;
            chip.addEventListener("click", () => {
                const selectedSet = state.aiCleaning.selectedTags[key];
                if (selectedSet.has(tag)) selectedSet.delete(tag); else selectedSet.add(tag);
                renderAiCleanFilters();
                renderAiCleanGallery();
            });
            wrapper.appendChild(chip);
        });
        dom.aiCleanFilters.appendChild(section);
    });
}

export function renderAiCleanGallery() {
    if (!dom.aiCleanGrid) return;
    const sourceItems = Array.isArray(state.aiCleaning.baseItems) ? state.aiCleaning.baseItems : [];
    if (!sourceItems.length) {
        dom.aiCleanGrid.textContent = getText("images.galleryEmpty");
        return;
    }

    const hasFilter = Object.values(state.aiCleaning.selectedTags).some((tagSet) => tagSet.size > 0);
    const filtered = sourceItems.filter((image) => {
        if (state.aiCleaning.itemsByPath.size === 0) return true;
        const payload = state.aiCleaning.itemsByPath.get(image.relative_path);
        if (!payload?.tags) return !hasFilter;
        return AI_CLEAN_DIMENSIONS.every(({key}) => {
            const selectedTags = state.aiCleaning.selectedTags[key];
            if (!selectedTags.size) return true;
            const values = Array.isArray(payload.tags[key]) ? payload.tags[key] : [];
            return values.some((value) => selectedTags.has(String(value)));
        });
    });

    dom.aiCleanGrid.innerHTML = "";
    if (!filtered.length) {
        dom.aiCleanGrid.textContent = getText("images.galleryEmpty");
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
        if (state.aiCleaning.processing.has(image.relative_path)) {
            const overlay = document.createElement("div");
            overlay.className = "ai-loading-overlay";
            overlay.innerHTML = '<div class="spinner-md"></div>';
            card.appendChild(overlay);
        }
        dom.aiCleanGrid.appendChild(card);
    });
}

function applyCleaningResults(items) {
    items.forEach((item) => {
        if (item?.relative_path) {
            state.aiCleaning.itemsByPath.set(item.relative_path, {tags: item.tags || {}});
        }
    });
    computeAiCleanDimensionTags();
    renderAiCleanFilters();
    renderAiCleanGallery();
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

async function handleAiCleanSubmit(event) {
    event.preventDefault();
    const config = getAiPlatformConfig();
    const errorMessage = validateAiPlatformConfig(config);
    if (errorMessage) return showModal(getText("modal.title"), errorMessage);

    const promptValue = dom.aiCleanPromptInput?.value.trim() || DEFAULT_AI_CLEAN_PROMPT;
    const baseItems = state.aiCleaning.baseItems.length ? state.aiCleaning.baseItems : state.gallery.items;
    const targets = Array.from(state.gallery.selected);
    state.aiCleaning.processing = new Set(targets.length ? targets : baseItems.map((item) => item.relative_path));
    renderAiCleanGallery();
    dom.aiCleanRunBtn.disabled = true;

    try {
        const response = await postJSON("/api/ai/clean", {
            prompt: promptValue,
            provider: config.provider,
            model: config.model,
            api_key: config.apiKey,
            base_url: config.baseUrl,
            targets,
        });
        applyCleaningResults(response.items || []);
        showModal(getText("modal.title"), response.message || getText("ai.cleanResultTitle"));
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("ai.platformTestFail"));
    } finally {
        dom.aiCleanRunBtn.disabled = false;
        state.aiCleaning.processing = new Set();
        renderAiCleanGallery();
    }
}

export function initAiCleanModule() {
    if (dom.aiCleanPromptInput && !dom.aiCleanPromptInput.value) dom.aiCleanPromptInput.value = DEFAULT_AI_CLEAN_PROMPT;
    dom.aiTestConfigBtn?.addEventListener("click", handleAiConfigTestClick);
    dom.aiCleanForm?.addEventListener("submit", handleAiCleanSubmit);
    dom.aiCleanResetBtn?.addEventListener("click", () => {
        resetAiCleaningFilters();
        computeAiCleanDimensionTags();
        renderAiCleanFilters();
        renderAiCleanGallery();
    });

    registerTranslationHook(() => {
        updateAiCleanSelectionHint();
        renderAiCleanFilters();
        if (state.aiCleaning.baseItems.length) renderAiCleanGallery();
    });
}
