export const dom = {
    setupBtn: document.getElementById("setupBtn"),
    startBtn: document.getElementById("startBtn"),
    downloadForm: document.getElementById("downloadForm"),
    downloadBtn: document.getElementById("downloadBtn"),
    modelFeaturedGroup: document.getElementById("modelFeaturedGroup"),
    modelMoreGroup: document.getElementById("modelMoreGroup"),
    toggleMoreModels: document.getElementById("toggleMoreModels"),
    toggleMoreText: document.getElementById("toggleMoreText"),
    setupProgress: document.getElementById("setupProgress"),
    setupStatus: document.getElementById("setupStatus"),
    setupPercent: document.getElementById("setupPercent"),
    setupMessage: document.getElementById("setupMessage"),
    setupLog: document.getElementById("setupLog"),
    downloadProgress: document.getElementById("downloadProgress"),
    downloadStatus: document.getElementById("downloadStatus"),
    downloadPercent: document.getElementById("downloadPercent"),
    downloadMessage: document.getElementById("downloadMessage"),
    downloadLog: document.getElementById("downloadLog"),
    copySetupLog: document.getElementById("copySetupLog"),
    copyDownloadLog: document.getElementById("copyDownloadLog"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalClose: document.getElementById("modalClose"),
    modalActions: document.getElementById("modalActions"),
    toast: document.getElementById("toast"),
    themeToggle: document.getElementById("themeToggle"),
    langToggle: document.getElementById("langToggle"),
    updateBtn: document.getElementById("updateBtn"),
    uploadForm: document.getElementById("uploadForm"),
    imageInput: document.getElementById("imageInput"),
    uploadAutoNote: document.getElementById("uploadAutoNote"),
    refreshGalleryBtn: document.getElementById("refreshGalleryBtn"),
    clearAllBtn: document.getElementById("clearAllBtn"),
    deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
    imageGrid: document.getElementById("imageGrid"),
    uploadProgressTray: document.getElementById("uploadProgressTray"),
    uploadProgressList: document.getElementById("uploadProgressList"),
    uploadProgressHint: document.getElementById("uploadProgressHint"),
    galleryFilter: document.getElementById("galleryFilter"),
    applyFilterBtn: document.getElementById("applyFilterBtn"),
    renameForm: document.getElementById("renameForm"),
    prefixInput: document.getElementById("prefixInput"),
    startNumberInput: document.getElementById("startNumberInput"),
    keywordInput: document.getElementById("keywordInput"),
    keywordActionSelect: document.getElementById("keywordActionSelect"),
    generationForm: document.getElementById("generationForm"),
    promptInput: document.getElementById("promptInput"),
    overwriteToggle: document.getElementById("overwriteToggle"),
    runninghubApiKeyInput: document.getElementById("runninghubApiKeyInput"),
    runninghubModelInput: document.getElementById("runninghubModelInput"),
    aspectRatioSelect: document.getElementById("aspectRatioSelect"),
    customAspectRatioInput: document.getElementById("customAspectRatioInput"),
    aspectRatioCustomRow: document.getElementById("aspectRatioCustomRow"),
    aspectRatioBackBtn: document.getElementById("aspectRatioBackBtn"),
    runninghubImageUrlInput: document.getElementById("runninghubImageUrlInput"),
    runninghubQueryUrlInput: document.getElementById("runninghubQueryUrlInput"),
    runninghubExtraParamsInput: document.getElementById("runninghubExtraParamsInput"),
    extraReferenceInput: document.getElementById("extraReferenceInput"),
    extraReferenceList: document.getElementById("extraReferenceList"),
    extraReferenceSummary: document.getElementById("extraReferenceSummary"),
    runninghubExampleFileInput: document.getElementById("runninghubExampleFileInput"),
    runninghubExampleTextInput: document.getElementById("runninghubExampleTextInput"),
    runninghubParseBtn: document.getElementById("runninghubParseBtn"),
    generateBtn: document.getElementById("generateBtn"),
    clearSelectionBtn: document.getElementById("clearSelectionBtn"),
    clearAiSelectionBtn: document.getElementById("clearAiSelectionBtn"),
    selectionHint: document.getElementById("selectionHint"),
    aiSelectionHint: document.getElementById("aiSelectionHint"),
    generationProgress: document.getElementById("generationProgress"),
    generationStatus: document.getElementById("generationStatus"),
    generationPercent: document.getElementById("generationPercent"),
    generationMessage: document.getElementById("generationMessage"),
    generationLog: document.getElementById("generationLog"),
    copyGenerationLog: document.getElementById("copyGenerationLog"),
    progressFill: document.getElementById("progressFill"),
    progressText: document.getElementById("progressText"),
    aiGrid: document.getElementById("aiGrid"),
    aiGalleryFilter: document.getElementById("aiGalleryFilter"),
    applyAiFilterBtn: document.getElementById("applyAiFilterBtn"),
    tagForm: document.getElementById("tagForm"),
    tagInput: document.getElementById("tagInput"),
    autodlSwitch: document.getElementById("autodlSwitch"),
    githubSwitch: document.getElementById("githubSwitch"),
    aiConfigForm: document.getElementById("aiConfigForm"),
    aiProviderSelect: document.getElementById("aiProviderSelect"),
    aiModelPresetSelect: document.getElementById("aiModelPresetSelect"),
    aiApiKeyInput: document.getElementById("aiApiKeyInput"),
    aiBaseUrlInput: document.getElementById("aiBaseUrlInput"),
    aiTestConfigBtn: document.getElementById("aiTestConfigBtn"),
    aiCleanForm: document.getElementById("aiCleanForm"),
    aiCleanPromptInput: document.getElementById("aiCleanPromptInput"),
    aiCleanRunBtn: document.getElementById("aiCleanRunBtn"),
    aiCleanResetBtn: document.getElementById("aiCleanResetBtn"),
    aiCleanSelectionHint: document.getElementById("aiCleanSelectionHint"),
    aiCleanFilters: document.getElementById("aiCleanFilters"),
    aiCleanGrid: document.getElementById("aiCleanGrid"),
    aiCleanProgress: document.getElementById("aiCleanProgress"),
    aiCleanStatus: document.getElementById("aiCleanStatus"),
    aiCleanPercent: document.getElementById("aiCleanPercent"),
    aiCleanMessage: document.getElementById("aiCleanMessage"),
    aiCleanLog: document.getElementById("aiCleanLog"),
    copyAiCleanLog: document.getElementById("copyAiCleanLog"),
};

export function formatBytes(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size)) return "--";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let idx = 0;
    let value = size;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`;
}

export function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
}

export function readDataUrlFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}
