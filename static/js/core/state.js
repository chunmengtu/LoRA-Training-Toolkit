export const pollingIntervalMs = 2500;
export const storageKeys = {
    theme: "aitoolkit-theme",
    lang: "aitoolkit-lang",
};

export const STEPS = ["overview", "environment", "download", "images", "ai", "ai-clean", "ai-tag", "console"];
export const STATUS_KEYS = {
    idle: "status.idle",
    queued: "status.queued",
    running: "status.running",
    success: "status.success",
    error: "status.error",
};

export const DEFAULT_AI_TAG_PROMPT = `# Role
你是一个用于图像理解的视觉标注助手，负责将图片内容提炼成结构化 JSON 数据。

# Objective
分析用户上传的图片，提取关键视觉信息，并按 5 个核心维度输出简洁标签。请忽略冗长修饰语，只输出准确、可复用的中文关键词。

# Response Format
必须只输出一段合法 JSON，不要包含 Markdown 代码块或任何额外解释。

JSON 结构如下：
{
  "main_subject": ["关键词", "关键词"],
  "appearance": ["关键词", "关键词"],
  "action_state": ["关键词", "关键词"],
  "environment": ["关键词", "关键词"],
  "visual_style": ["关键词", "关键词"]
}

# Rules
1. 所有字段都必须是数组，内容使用简体中文。
2. 每个关键词尽量控制在 2 到 6 个字以内，不要写成长句。
3. 适用于人物、动物、物体、场景等各种类型的图片。
4. 某个维度不适用时，返回空数组 []。`;

export const AI_TAG_DIMENSIONS = [
    {key: "main_subject", labelKey: "ai.cleanDimension.main_subject"},
    {key: "appearance", labelKey: "ai.cleanDimension.appearance"},
    {key: "action_state", labelKey: "ai.cleanDimension.action_state"},
    {key: "environment", labelKey: "ai.cleanDimension.environment"},
    {key: "visual_style", labelKey: "ai.cleanDimension.visual_style"},
];

export const appConfig = window.__APP_CONFIG__ || {};

export const state = {
    currentStepIndex: 0,
    pollingHandle: null,
    currentTheme: "dark",
    currentLang: "zh",
    aiProviderConfig: null,
    isUploading: false,
    gallery: {
        items: [],
        selected: new Set(),
        filterKeyword: "",
    },
    aiGallery: {
        items: [],
        selected: new Set(),
        filterKeyword: "",
    },
    extraReference: {
        files: [],
    },
    aiTagging: {
        baseItems: [],
        filterKeyword: "",
        itemsByPath: new Map(),
        processing: new Set(),
        selectedTags: {
            main_subject: new Set(),
            appearance: new Set(),
            action_state: new Set(),
            environment: new Set(),
            visual_style: new Set(),
        },
        dimensionTags: {
            main_subject: new Set(),
            appearance: new Set(),
            action_state: new Set(),
            environment: new Set(),
            visual_style: new Set(),
        },
    },
    aiCleaning: {
        referenceFile: null,
        referencePreviewUrl: null,
        filterKeyword: "",
        baseItems: [],
        displayItems: [],
        hasSimilarity: false,
        selected: new Set(),
        running: false,
    },
    generating: {
        active: false,
        targets: new Set(),
    },
    uploadProgress: {
        trackers: [],
        total: 0,
        finished: 0,
        failed: 0,
        timer: null,
    },
    features: {
        autodlAccelerator: "off",
        githubAccelerator: "off",
    },
};

export function resetAiTaggingFilters() {
    state.aiTagging.selectedTags = {
        main_subject: new Set(),
        appearance: new Set(),
        action_state: new Set(),
        environment: new Set(),
        visual_style: new Set(),
    };
}
