import {fetchJSON} from "../core/api.js";
import {dom} from "../core/dom.js";
import {getLocalizedLabelFromConfig, getText, formatText, registerTranslationHook} from "../core/i18n.js";
import {appConfig, state} from "../core/state.js";

function modelCardHTML(model, checked) {
    const desc = model.desc[state.currentLang] || model.desc.zh;
    return `<label class="radio-card">
        <input type="radio" name="model" value="${model.name}" ${checked ? "checked" : ""}>
        <div class="radio-content">
            <span class="radio-title">${model.name}</span>
            <span class="radio-desc">${desc}</span>
        </div>
    </label>`;
}

export function renderModelCards() {
    const raw = appConfig.modelRegistry;
    const registry = typeof raw === "string" ? JSON.parse(raw) : raw || [];
    const featured = registry.filter((item) => item.featured);
    const more = registry.filter((item) => !item.featured);
    const selected = document.querySelector('input[name="model"]:checked')?.value;

    if (dom.modelFeaturedGroup) {
        dom.modelFeaturedGroup.innerHTML = featured
            .map((item, index) => modelCardHTML(item, selected ? item.name === selected : index === 0))
            .join("");
    }

    if (dom.modelMoreGroup && dom.toggleMoreModels) {
        if (more.length > 0) {
            dom.toggleMoreModels.classList.remove("hidden");
            dom.modelMoreGroup.innerHTML = more.map((item) => modelCardHTML(item, item.name === selected)).join("");
        } else {
            dom.toggleMoreModels.classList.add("hidden");
            dom.modelMoreGroup.innerHTML = "";
        }
    }
    updateToggleMoreText();
}

export function updateToggleMoreText() {
    if (!dom.toggleMoreText) return;
    const raw = appConfig.modelRegistry;
    const registry = typeof raw === "string" ? JSON.parse(raw) : raw || [];
    const count = registry.filter((item) => !item.featured).length;
    const expanded = dom.modelMoreGroup && !dom.modelMoreGroup.classList.contains("hidden");
    dom.toggleMoreText.textContent = expanded ? getText("download.showLess") : formatText("download.showMore", {n: count});
}

export function toggleMoreModels() {
    if (!dom.modelMoreGroup) return;
    dom.modelMoreGroup.classList.toggle("hidden");
    dom.toggleMoreModels?.querySelector(".toggle-chevron")?.classList.toggle(
        "expanded",
        !dom.modelMoreGroup.classList.contains("hidden"),
    );
    updateToggleMoreText();
}

export async function loadAiProviderConfig() {
    if (!dom.aiProviderSelect || !dom.aiModelPresetSelect) return;
    state.aiProviderConfig = await fetchJSON(`/static/ai_providers.json?_=${Date.now()}`);
    populateAiProviderOptions();
    syncModelPresetWithProvider();
}

export function populateAiProviderOptions(selectedId) {
    if (!state.aiProviderConfig || !dom.aiProviderSelect) return;
    const providers = state.aiProviderConfig.providers || [];
    const current = selectedId || dom.aiProviderSelect.value;
    dom.aiProviderSelect.innerHTML = "";
    providers.forEach((provider) => {
        const option = document.createElement("option");
        option.value = provider.id;
        option.textContent = getLocalizedLabelFromConfig(provider);
        dom.aiProviderSelect.appendChild(option);
    });
    if (current) dom.aiProviderSelect.value = current;
}

export function syncModelPresetWithProvider() {
    if (!dom.aiProviderSelect || !dom.aiModelPresetSelect || !state.aiProviderConfig) return;
    const providers = state.aiProviderConfig.providers || [];
    const providerCfg = providers.find((item) => item.id === dom.aiProviderSelect.value) || providers[0];
    const previousModel = dom.aiModelPresetSelect.value;
    dom.aiModelPresetSelect.innerHTML = "";

    (providerCfg?.models || []).forEach((model) => {
        const option = document.createElement("option");
        option.value = model.model;
        option.textContent = getLocalizedLabelFromConfig(model);
        dom.aiModelPresetSelect.appendChild(option);
    });

    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = getText("ai.platformCustomModel");
    dom.aiModelPresetSelect.appendChild(customOption);

    if (previousModel && Array.from(dom.aiModelPresetSelect.options).some((option) => option.value === previousModel)) {
        dom.aiModelPresetSelect.value = previousModel;
    } else if (providerCfg?.default_model) {
        dom.aiModelPresetSelect.value = providerCfg.default_model;
    }

    handleAiModelPresetVisibility();
}

export function handleAiModelPresetVisibility() {
    if (!dom.aiModelPresetSelect) return;
    const isCustom = dom.aiModelPresetSelect.value === "custom";
    if (isCustom) {
        const input = document.createElement("input");
        input.id = "aiModelPresetSelect";
        input.type = "text";
        input.placeholder = getText("ai.platformCustomModelPlaceholder");
        input.className = dom.aiModelPresetSelect.className;
        input.value = dom.aiModelPresetSelect.dataset.customValue || "";
        input.addEventListener("input", (event) => {
            input.dataset.customValue = event.target.value;
        });
        dom.aiModelPresetSelect.parentNode.replaceChild(input, dom.aiModelPresetSelect);
        dom.aiModelPresetSelect = input;
        bindAiModelPresetChange();
        return;
    }

    if (dom.aiModelPresetSelect.tagName === "INPUT") {
        const select = document.createElement("select");
        select.id = "aiModelPresetSelect";
        select.className = dom.aiModelPresetSelect.className;
        select.dataset.customValue = dom.aiModelPresetSelect.value;
        dom.aiModelPresetSelect.parentNode.replaceChild(select, dom.aiModelPresetSelect);
        dom.aiModelPresetSelect = select;
        syncModelPresetWithProvider();
    }
}

export function bindAiModelPresetChange() {
    if (!dom.aiModelPresetSelect) return;
    dom.aiModelPresetSelect.onchange = () => handleAiModelPresetVisibility();
}

export function getAiPlatformConfig() {
    const provider = dom.aiProviderSelect?.value || state.aiProviderConfig?.providers?.[0]?.id || "openai";
    let model = "";
    if (dom.aiModelPresetSelect) {
        if (dom.aiModelPresetSelect.tagName === "INPUT") {
            model = dom.aiModelPresetSelect.value.trim();
        } else if (dom.aiModelPresetSelect.value && dom.aiModelPresetSelect.value !== "custom") {
            model = dom.aiModelPresetSelect.value;
        }
    }
    return {
        provider,
        model,
        apiKey: dom.aiApiKeyInput?.value.trim() || "",
        baseUrl: dom.aiBaseUrlInput?.value.trim() || "",
    };
}

export function validateAiPlatformConfig(config) {
    if (!config.model) return getText("ai.platformErrorModelMissing");
    if (!config.apiKey) return getText("ai.platformErrorApiKeyMissing");
    if (config.provider === "custom" && !config.baseUrl) return getText("ai.platformErrorBaseUrlMissing");
    return null;
}

export function initModelsModule() {
    dom.toggleMoreModels?.addEventListener("click", toggleMoreModels);
    dom.aiProviderSelect?.addEventListener("change", () => syncModelPresetWithProvider());
    registerTranslationHook(() => {
        populateAiProviderOptions(dom.aiProviderSelect?.value);
        syncModelPresetWithProvider();
        renderModelCards();
    });
}
