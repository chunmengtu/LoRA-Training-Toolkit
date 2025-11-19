const pollingIntervalMs = 2500;
const storageKeys = {
  theme: "aitoolkit-theme",
  lang: "aitoolkit-lang",
};

const STEPS = ["overview", "environment", "download", "images", "ai", "console"];
let currentStepIndex = 0;

const dictionary = {
  zh: {
    "brand.eyebrow": "AI Toolkit",
    "brand.title": "Lora 训练工具箱",
    "nav.overview": "概览",
    "nav.environment": "环境初始化",
    "nav.download": "模型下载",
    "nav.images": "图像处理",
    "nav.ai": "AI 处理",
    "nav.console": "控制台",
    "nav.system": "系统",
    "nav.linux": "状态",
    "overview.title": "一站式部署 & 下载文档",
    "overview.lead": "先阅读每个章节的说明，再依次触发命令。系统将自动记录所有日志与进度。",
    "overview.step1": "步骤 1 · 初始化",
    "overview.step1Desc": "安装依赖、准备 Node 与工具链。",
    "overview.step2": "步骤 2 · 选择模型",
    "overview.step2Desc": "挑选模型并选择 ModelScope 或 HuggingFace。",
    "overview.step3": "步骤 3 · 图像处理",
    "overview.step3Desc": "上传、管理图片，使用 AI 批量生成。",
    "overview.step5": "步骤 5 · AI 处理",
    "overview.step5Desc": "Gemini 批量生成、打标与导出。",
    "overview.step4": "步骤 6 · 监控",
    "overview.step4Desc": "在控制台查看进度、复制日志、接收弹窗提醒。",
    "environment.title": "环境初始化向导",
    "environment.desc": "自动执行依赖安装脚本。Linux 将串行安装所有依赖，Windows 会调用 Easy Install 脚本。",
    "environment.button": "开始执行",
    "environment.startBtn": "启动 UI",
    "environment.item1": "安装 huggingface_hub 与 modelscope",
    "environment.item2": "配置 Node.js 20 源并安装 nodejs",
    "environment.item3": "克隆或更新 ai-toolkit，安装 requirements",
    "environment.item4": "启动ai-toolkit，Linux默认为6006端口，Windows默认为7867端口",
    "environment.alertTitle": "温馨提醒：",
    "environment.alertDesc": "当前界面会维护一份完整的命令日志，执行期间请勿重复点击。",
    "environment.acceleratorTitle": "Autodl学术镜像加速功能",
    "environment.acceleratorBody": "仅限 Autodl 场景，解决 github/huggingface 网络慢的问题，若不需要请关闭以免影响正常网络。",
    "environment.githubTitle": "GitHub 学术加速",
    "environment.githubBody": "GitHub学术加速，第三方提供，不保证可用。开启后将使用 GitHub Proxy 代理。",
    "environment.acceleratorEnable": "开启加速",
    "environment.acceleratorDisable": "关闭加速",
    "environment.acceleratorSuccess": "命令执行成功",
    "environment.acceleratorFail": "命令执行失败",
    "environment.acceleratorUnsupported": "该功能仅在 Linux/Autodl 环境可用",
    "environment.acceleratorOn": "已开启",
    "environment.acceleratorOff": "已关闭",
    "download.title": "模型选择与下载渠道",
    "download.desc": "根据用途选择模型，并在两个下载渠道之间切换。系统会自动创建存储目录。",
    "download.modelLegend": "选择模型",
    "download.sourceLegend": "下载来源",
    "download.button": "开始下载",
    "download.note": "默认目录：{{dir}}/模型名",
    "images.title": "图像处理 · 管理",
    "images.desc": "上传单图 / 文件夹 / 压缩包，快速整理命名。",
    "images.uploadTitle": "图片上传",
    "images.uploadDrop": "拖拽文件到此或点击选择",
    "images.refreshBtn": "刷新",
    "images.uploadAutoNote": "选择或拖放文件后会自动开始上传",
    "images.deleteSelected": "删除所选",
    "images.clearAll": "清空所有",
    "images.deleteEmpty": "请先选择需要删除的图片",
    "images.deleteConfirm": "确定删除所选图片？该操作不可撤销。",
    "images.clearConfirm": "确定清空全部图片？该操作不可撤销。",
    "images.clearSuccess": "已清空全部图片",
    "images.deleteSuccess": "已删除所选图片",
    "images.renameTitle": "批量重命名",
    "images.prefixPlaceholder": "前缀",
    "images.keywordPlaceholder": "关键字",
    "images.keywordActionNone": "仅重命名",
    "images.keywordActionFilter": "只作用于命中项",
    "images.keywordActionDelete": "删除命中项",
    "images.keywordActionKeep": "仅保留命中项",
    "images.renameBtn": "执行整理",
    "images.exportTitle": "批量导出",
    "images.exportBtn": "导出图片包",
    "images.generateTitle": "Gemini 批量生成",
    "images.promptPlaceholder": "描述你想生成的风格...",
    "images.overwriteLabel": "生成后覆盖同名文件",
    "images.keyPathPlaceholder": "填写 KEY_PATH",
    "images.projectIdPlaceholder": "填写 PROJECT_ID",
    "images.locationPlaceholder": "填写 LOCATION",
    "images.configRequired": "请填写 KEY_PATH、PROJECT_ID 与 LOCATION",
    "images.selectionHint": "未选择图片时默认处理全部",
    "images.selectionSelected": "已选择 {{count}} 张图片",
    "images.generateBtn": "开始生成",
    "images.clearSelection": "清空",
    "images.galleryTitle": "图像瀑布流",
    "images.galleryFilter": "搜索...",
    "images.filterBtn": "搜索",
    "images.galleryEmpty": "暂未上传图片",
    "images.uploadProgressTitle": "上传进度",
    "images.uploadProgressIdle": "暂无上传任务",
    "images.uploadProgressPreparing": "共 {{count}} 个文件待上传",
    "images.uploadProgressRunning": "正在上传 {{done}} / {{total}}",
    "images.uploadProgressDone": "全部上传完成",
    "images.uploadProgressError": "上传完成，但部分文件失败",
    "images.uploadProgressWaiting": "等待上传",
    "images.uploadProgressSuccess": "上传完成",
    "images.uploadProgressFailed": "上传失败",
    "images.uploadProgressNetwork": "网络异常，请稍后重试",
    "images.uploadSummarySuccess": "成功 {{count}} 张",
    "images.uploadSummarySkip": "忽略 {{count}} 张",
    "images.uploadSummaryFail": "失败 {{count}} 张",
    "images.uploadBusy": "已有上传任务正在执行，请稍候",
    "images.consoleTitle": "AI 生成日志",
    "images.uploadEmpty": "请至少选择一个文件",
    "ai.title": "AI 批量处理",
    "ai.desc": "使用 Gemini 批量生成 AI 图像，打标并导出。",
    "ai.tagTitle": "🏷️ 批量打标",
    "ai.tagPlaceholder": "输入标签...",
    "ai.tagBtn": "应用标签",
    "ai.exportBtn": "导出 AI 图像",
    "ai.galleryTitle": "AI 生成预览",
    "ai.tagSuccess": "标签已更新",
    "ai.tagHint": "请用简洁的语言描述你希望将原图转换成的目标图风格或效果（优先使用英文）<br>例如：<br>- 转换为吉卜力动画风格 (Transform into Ghibli anime style)<br>- 转换为水墨画风格 (Transform into inkwash painting style)<br>- 给角色戴上眼镜 (Add glasses to the character)",
    "step.next": "下一步",
    "step.prev": "上一步",
    "step.finish": "完成",
    "console.setupTitle": "环境执行日志",
    "console.downloadTitle": "模型下载日志",
    "console.copy": "复制",
    "status.label": "状态：",
    "status.idle": "待命",
    "status.queued": "排队中",
    "status.running": "执行中",
    "status.success": "已完成",
    "status.error": "出错",
    "log.waiting": "等待任务...",
    "modal.title": "提示",
    "toast.copyOk": "已复制",
    "toast.copyFail": "复制失败",
    "toast.preview": "当前为预览模式",
    "update.title": "发现新版本",
    "update.current": "当前版本：",
    "update.latest": "最新版本：",
    "update.notes": "更新内容：",
    "update.btn": "前往更新",
    "update.checking": "正在检查更新...",
    "update.latestMsg": "当前已是最新版本",
    "update.fail": "检查更新失败",
  },
  en: {
    "brand.eyebrow": "AI Toolkit",
    "brand.title": "LoRA Training Toolkit",
    "nav.overview": "Overview",
    "nav.environment": "Environment Setup",
    "nav.download": "Model Download",
    "nav.images": "Image Processing",
    "nav.ai": "AI Processing",
    "nav.console": "Console",
    "nav.system": "System",
    "nav.linux": "Status",
    "overview.title": "One-Stop Deployment & Download Docs",
    "overview.lead": "Read instructions in each section first, then run commands sequentially. The system automatically logs all activity and progress.",
    "overview.step1": "Step 1 · Initialization",
    "overview.step1Desc": "Install dependencies, prepare Node.js and toolchain.",
    "overview.step2": "Step 2 · Select Model",
    "overview.step2Desc": "Choose a model and select between ModelScope or HuggingFace.",
    "overview.step3": "Step 3 · Image Processing",
    "overview.step3Desc": "Upload, manage images, and batch-generate with AI.",
    "overview.step5": "Step 5 · AI Processing",
    "overview.step5Desc": "Gemini batch generation, tagging, and export.",
    "overview.step4": "Step 6 · Monitoring",
    "overview.step4Desc": "Check progress, copy logs, and receive pop-up alerts in the console.",
    "environment.title": "Environment Initialization Wizard",
    "environment.desc": "Automatically runs dependency installation scripts. Linux installs all dependencies sequentially; Windows uses the Easy Install script.",
    "environment.button": "Start Execution",
    "environment.startBtn": "Start UI",
    "environment.item1": "Install huggingface_hub and modelscope",
    "environment.item2": "Configure Node.js 20 source and install nodejs",
    "environment.item3": "Clone or update ai-toolkit, install requirements",
    "environment.item4": "Launch the ai-toolkit. Linux uses the default port 6006, while Windows defaults to port 7867.",
    "environment.alertTitle": "Friendly Reminder:",
    "environment.alertDesc": "This interface maintains a complete command log. Do not click repeatedly during execution.",
    "environment.acceleratorTitle": "Autodl Academic Mirror Acceleration",
    "environment.acceleratorBody": "For Autodl environments only. Resolves slow github/huggingface connections. Disable when unused to avoid network issues.",
    "environment.githubTitle": "GitHub Academic Accelerator",
    "environment.githubBody": "GitHub Academic Accelerator, provided by third party, no guarantee. Uses GitHub Proxy proxy when enabled.",
    "environment.acceleratorEnable": "Enable Acceleration",
    "environment.acceleratorDisable": "Disable Acceleration",
    "environment.acceleratorSuccess": "Command executed successfully",
    "environment.acceleratorFail": "Command failed to execute",
    "environment.acceleratorUnsupported": "Only available on Linux/Autodl environments",
    "environment.acceleratorOn": "Enabled",
    "environment.acceleratorOff": "Disabled",
    "download.title": "Model Selection & Download Source",
    "download.desc": "Select a model based on your needs and switch between two download sources. The system auto-creates storage directories.",
    "download.modelLegend": "Select Model",
    "download.sourceLegend": "Download Source",
    "download.button": "Start Download",
    "download.note": "Default Directory: {{dir}}/model-name",
    "images.title": "Image Processing · Management",
    "images.desc": "Upload single images / folders / archives, quickly organize and rename.",
    "images.uploadTitle": "Image Upload",
    "images.uploadDrop": "Drop files here or click to select",
    "images.refreshBtn": "Refresh",
    "images.uploadAutoNote": "Upload starts automatically after selecting/dragging files",
    "images.deleteSelected": "Delete Selected",
    "images.clearAll": "Clear All",
    "images.deleteEmpty": "Please select images to delete first",
    "images.deleteConfirm": "Delete selected images? This action cannot be undone.",
    "images.clearConfirm": "Clear all images? This action cannot be undone.",
    "images.clearSuccess": "All images cleared",
    "images.deleteSuccess": "Selected images deleted",
    "images.renameTitle": "Batch Rename",
    "images.prefixPlaceholder": "Prefix",
    "images.keywordPlaceholder": "Keyword",
    "images.keywordActionNone": "Rename only",
    "images.keywordActionFilter": "Apply to matches only",
    "images.keywordActionDelete": "Delete matches",
    "images.keywordActionKeep": "Keep matches only",
    "images.renameBtn": "Execute Organization",
    "images.exportTitle": "Batch Export",
    "images.exportBtn": "Export Image Pack",
    "images.generateTitle": "Gemini Batch Generation",
    "images.promptPlaceholder": "Describe the style you want to generate...",
    "images.overwriteLabel": "Overwrite files with the same name after generation",
    "images.keyPathPlaceholder": "Enter KEY_PATH",
    "images.projectIdPlaceholder": "Enter PROJECT_ID",
    "images.locationPlaceholder": "Enter LOCATION",
    "images.configRequired": "Please fill in KEY_PATH, PROJECT_ID, and LOCATION",
    "images.selectionHint": "Process all images when none are selected",
    "images.selectionSelected": "{{count}} image(s) selected",
    "images.generateBtn": "Start Generation",
    "images.clearSelection": "Clear Selection",
    "images.galleryTitle": "Image Gallery",
    "images.galleryFilter": "Search...",
    "images.filterBtn": "Search",
    "images.galleryEmpty": "No images uploaded yet",
    "images.uploadProgressTitle": "Upload Progress",
    "images.uploadProgressIdle": "No upload tasks",
    "images.uploadProgressPreparing": "{{count}} files ready to upload",
    "images.uploadProgressRunning": "Uploading {{done}} / {{total}}",
    "images.uploadProgressDone": "All uploads completed",
    "images.uploadProgressError": "Upload finished with some failures",
    "images.uploadProgressWaiting": "Waiting to upload",
    "images.uploadProgressSuccess": "Upload completed",
    "images.uploadProgressFailed": "Upload failed",
    "images.uploadProgressNetwork": "Network error, please retry later",
    "images.uploadSummarySuccess": "{{count}} successful upload(s)",
    "images.uploadSummarySkip": "{{count}} skipped file(s)",
    "images.uploadSummaryFail": "{{count}} failed upload(s)",
    "images.uploadBusy": "An upload task is already running, please wait",
    "images.consoleTitle": "AI Generation Logs",
    "images.uploadEmpty": "Please select at least one file",
    "ai.title": "AI Processing",
    "ai.desc": "Batch generate AI images with Gemini, tag, and export.",
    "ai.tagTitle": "Batch Tagging",
    "ai.tagPlaceholder": "Enter tags...",
    "ai.tagBtn": "Apply Tags",
    "ai.exportBtn": "Export AI Images",
    "ai.galleryTitle": "AI Generation Preview",
    "ai.tagSuccess": "Tags updated",
    "ai.tagHint": "Please describe the target style or effect you want to transform the original image into (English preferred)<br>Example:<br>- Transform into Ghibli anime style<br>- Transform into inkwash painting style<br>- Add glasses to the character",
    "step.next": "Next",
    "step.prev": "Previous",
    "step.finish": "Finish",
    "console.setupTitle": "Environment Execution Logs",
    "console.downloadTitle": "Model Download Logs",
    "console.copy": "Copy",
    "status.label": "Status:",
    "status.idle": "Idle",
    "status.queued": "Queued",
    "status.running": "Running",
    "status.success": "Completed",
    "status.error": "Error",
    "log.waiting": "Waiting for task...",
    "modal.title": "Prompt",
    "toast.copyOk": "Copied",
    "toast.copyFail": "Copy failed",
    "toast.preview": "Currently in preview mode",
    "update.title": "New Version Available",
    "update.current": "Current: ",
    "update.latest": "Latest: ",
    "update.notes": "Release Notes:",
    "update.btn": "Update Now",
    "update.checking": "Checking for updates...",
    "update.latestMsg": "You are up to date",
    "update.fail": "Update check failed",
  },
};

const STATUS_KEYS = {
  idle: "status.idle",
  queued: "status.queued",
  running: "status.running",
  success: "status.success",
  error: "status.error",
};

const dom = {
  setupBtn: document.getElementById("setupBtn"),
  startBtn: document.getElementById("startBtn"),
  downloadForm: document.getElementById("downloadForm"),
  downloadBtn: document.getElementById("downloadBtn"),
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
  toast: document.getElementById("toast"),
  themeToggle: document.getElementById("themeToggle"),
  langToggle: document.getElementById("langToggle"),
  updateBtn: document.getElementById("updateBtn"),
  uploadForm: document.getElementById("uploadForm"),
  imageInput: document.getElementById("imageInput"),
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
  keyPathInput: document.getElementById("keyPathInput"),
  projectIdInput: document.getElementById("projectIdInput"),
  locationInput: document.getElementById("locationInput"),
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
  modalActions: document.getElementById("modalActions"),
  featureStatus: document.getElementById("autodlAcceleratorStatus"),
  aiGrid: document.getElementById("aiGrid"),
  aiGalleryFilter: document.getElementById("aiGalleryFilter"),
  applyAiFilterBtn: document.getElementById("applyAiFilterBtn"),
  tagForm: document.getElementById("tagForm"),
  tagInput: document.getElementById("tagInput"),
  autodlSwitch: document.getElementById("autodlSwitch"),
  githubSwitch: document.getElementById("githubSwitch"),
};

let pollingHandle = null;
let currentTheme = "dark";
let currentLang = "zh";
const galleryState = {
  items: [],
  selected: new Set(),
  filterKeyword: "",
};
const aiGalleryState = {
  items: [],
  selected: new Set(),
  filterKeyword: "",
};

const generatingState = {
    active: false,
    targets: new Set()
};

const uploadProgressState = {
  trackers: [],
  total: 0,
  finished: 0,
  failed: 0,
  timer: null,
};

const featureStates = {
  autodlAccelerator: "off",
  githubAccelerator: "off",
};

let isUploading = false;

function getText(key, lang = currentLang) {
  return dictionary[lang]?.[key] ?? dictionary.zh?.[key] ?? key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = getText(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", getText(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = getText(el.dataset.i18nHtml);
  });
  // Special handling for tag hint which contains HTML
  const tagHint = document.querySelector(".tag-hint");
  if (tagHint) {
      tagHint.innerHTML = getText("ai.tagHint");
  }
  
  updateSelectionHint();
  updateAiSelectionHint();
  updateUploadProgressHint();
  updateSwitchState(dom.autodlSwitch, featureStates.autodlAccelerator);
  updateSwitchState(dom.githubSwitch, featureStates.githubAccelerator);
}

function applyTheme(theme) {
  currentTheme = theme === "light" ? "light" : "dark";
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(`theme-${currentTheme}`);
  try {
    localStorage.setItem(storageKeys.theme, currentTheme);
  } catch {}
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function applyLanguage(lang) {
  currentLang = lang === "en" ? "en" : "zh";
  try {
    localStorage.setItem(storageKeys.lang, currentLang);
  } catch {}
  applyTranslations();
}

function toggleLanguage() {
  applyLanguage(currentLang === "zh" ? "en" : "zh");
}

function goToStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= STEPS.length) return;
  
  currentStepIndex = stepIndex;
  const stepName = STEPS[stepIndex];
  
  // 切换页面
  document.querySelectorAll(".wizard-page").forEach((page, idx) => {
    page.classList.toggle("active", idx === stepIndex);
  });
  
  // 更新导航
  document.querySelectorAll(".step-nav-item").forEach((item, idx) => {
    item.classList.toggle("active", idx === stepIndex);
    if (idx < stepIndex) {
      item.classList.add("completed");
    }
  });
  
  // 更新进度条
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  if (dom.progressFill) {
    dom.progressFill.style.width = `${progress}%`;
  }
  if (dom.progressText) {
    dom.progressText.textContent = `第 ${stepIndex + 1} / ${STEPS.length} 步`;
  }

  // 如果进入 AI 页面，加载 AI 画廊
  if (stepName === "ai") {
    loadAiGallery(aiGalleryState.filterKeyword);
  }
}

function initNavigation() {
  // 左侧步骤导航
  document.querySelectorAll(".step-nav-item").forEach((btn, idx) => {
    btn.addEventListener("click", () => goToStep(idx));
  });
  
  // 底部上一步/下一步按钮
  document.querySelectorAll(".btn-prev").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(currentStepIndex - 1));
  });
  
  document.querySelectorAll(".btn-next").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextStep = currentStepIndex + 1;
      if (nextStep >= STEPS.length) {
        goToStep(0); // 循环回到第一步
      } else {
        goToStep(nextStep);
      }
    });
  });
}

async function fetchStatus() {
  try {
    const response = await fetch(`/api/status?_=${Date.now()}`);
    const data = await response.json();
    applySectionState("setup", data.setup);
    applySectionState("download", data.download);
    applySectionState("generation", data.image_generation);
    
    // 如果正在生成图片，且当前在 AI 页面，刷新 AI 画廊
    if (data.image_generation.status === "running" && STEPS[currentStepIndex] === "ai") {
      loadAiGallery(aiGalleryState.filterKeyword);
    }

    if (data.image_generation.status !== "running" && generatingState.active) {
        generatingState.active = false;
        generatingState.targets.clear();
        loadAiGallery(aiGalleryState.filterKeyword); // Final refresh
    }
  } catch (err) {
    console.error("status fetch failed", err);
  }
}

function applySectionState(section, data) {
  if (!data) return;
  const prefixMap = {
    setup: "setup",
    download: "download",
    generation: "generation",
  };
  const prefix = prefixMap[section];
  if (!prefix) return;
  
  const progressEl = dom[`${prefix}Progress`];
  const statusEl = dom[`${prefix}Status`];
  const percentEl = dom[`${prefix}Percent`];
  const messageEl = dom[`${prefix}Message`];
  const logEl = dom[`${prefix}Log`];

  if (progressEl) {
    const progress = typeof data.progress === "number" ? data.progress : 0;
    progressEl.style.width = `${progress}%`;
  }
  
  if (percentEl) {
    percentEl.textContent = `${data.progress || 0}%`;
  }
  
  if (statusEl) {
    const statusKey = STATUS_KEYS[data.status] || "status.idle";
    statusEl.textContent = `${getText("status.label")}${getText(statusKey)}`;
  }
  
  if (messageEl) {
    messageEl.textContent = data.message || getText("log.waiting");
  }
  
  if (logEl) {
    const logs = data.log && data.log.length ? data.log.slice(-100).join("\n") : getText("log.waiting");
    logEl.textContent = logs;
  }
}

function compareVersions(v1, v2) {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

async function checkUpdate(silent = false) {
  if (!silent) {
    showToast(getText("update.checking"));
  }
  try {
    // Add timestamp to prevent caching
    const res = await fetch("/api/check_update?_=" + Date.now());
    const data = await res.json();
    
    if (!res.ok) {
       if (!silent) showModal(getText("modal.title"), data.message || getText("update.fail"));
       return;
    }
    
    const current = data.current_version;
    const latest = data.latest_version;
    
    if (compareVersions(latest, current) > 0) {
      // New version found
      const body = `
        <div style="text-align:left">
            <p><strong>${getText("update.current")}</strong> ${current}</p>
            <p><strong>${getText("update.latest")}</strong> ${latest}</p>
            <hr style="margin:10px 0;border:0;border-top:1px solid var(--border)">
            <p><strong>${getText("update.notes")}</strong></p>
            <pre style="background:var(--panel-alt);padding:10px;border-radius:6px;max-height:200px;overflow-y:auto;white-space:pre-wrap;font-size:12px;font-family:inherit">${data.release_notes}</pre>
        </div>
      `;
      
      showModal(getText("update.title"), "", [
        {
            label: getText("update.btn"),
            variant: "primary",
            handler: () => {
                window.open(data.release_url, "_blank");
            }
        }
      ], { force: true, html: body });
    } else {
      if (!silent) {
        showToast(getText("update.latestMsg"));
      }
    }
  } catch (err) {
    if (!silent) {
       showModal(getText("modal.title"), err.message || getText("update.fail"));
    }
  }
}

async function postJSON(url, payload = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function showModal(title, body, actions = [], options = {}) {
  dom.modalTitle.textContent = title || getText("modal.title");
  
  if (options.html) {
      dom.modalBody.innerHTML = options.html;
  } else {
      dom.modalBody.textContent = body || "";
  }
  
  if (options.force) {
      dom.modal.classList.add('modal-force');
      if (dom.modalClose) dom.modalClose.classList.add('hidden');
  } else {
      dom.modal.classList.remove('modal-force');
      if (dom.modalClose) dom.modalClose.classList.remove('hidden');
  }

  if (dom.modalActions) {
    dom.modalActions.innerHTML = "";
    if (Array.isArray(actions) && actions.length) {
      dom.modalActions.classList.remove("hidden");
      actions.forEach((actionConfig) => {
        const btn = document.createElement("button");
        btn.type = "button";
        const variant = actionConfig?.variant === "primary" ? "" : " secondary";
        btn.className = `btn-modal${variant}`;
        btn.textContent = actionConfig?.label || getText("modal.title");
        btn.addEventListener("click", () => {
          actionConfig?.handler?.();
        });
        dom.modalActions.appendChild(btn);
      });
    } else {
      dom.modalActions.classList.add("hidden");
    }
  }
  dom.modal.classList.remove("hidden");
}

function hideModal() {
  dom.modal.classList.add("hidden");
  if (dom.modalActions) {
    dom.modalActions.classList.add("hidden");
    dom.modalActions.innerHTML = "";
  }
}

function showToast(message, duration = 2800) {
  if (!dom.toast || !message) return;
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  setTimeout(() => dom.toast.classList.add("hidden"), duration);
}

function updateSwitchState(btn, state) {
    if (!btn) return;
    const label = btn.querySelector(".switch-label");
    if (state === "on") {
        btn.classList.add("active");
        btn.dataset.state = "on";
        if (label) label.textContent = label.dataset.on;
    } else {
        btn.classList.remove("active");
        btn.dataset.state = "off";
        if (label) label.textContent = label.dataset.off;
    }
}

async function handleAcceleratorAction(action) {
  try {
    const res = await postJSON("/api/network/accelerator", { action });
    featureStates.autodlAccelerator = action === "enable" ? "on" : "off";
    updateSwitchState(dom.autodlSwitch, featureStates.autodlAccelerator);
    showToast(res.message || getText("environment.acceleratorSuccess"));
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("environment.acceleratorFail"));
    // Revert state on failure
    updateSwitchState(dom.autodlSwitch, featureStates.autodlAccelerator);
  }
}

function bindCopy(button, logEl) {
  if (!button || !logEl) return;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(logEl.textContent || "");
      showToast(getText("toast.copyOk"));
    } catch {
      showToast(getText("toast.copyFail"));
    }
  });
}

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size)) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let value = size;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : 1;
  return `${value.toFixed(digits)}${units[idx]}`;
}

function disposeUploadPreviews() {
  uploadProgressState.trackers.forEach((tracker) => {
    if (tracker?.previewUrl) {
      URL.revokeObjectURL(tracker.previewUrl);
      tracker.previewUrl = null;
    }
  });
}

function updateUploadProgressHint() {
  if (!dom.uploadProgressHint) return;
  const { total, finished, failed } = uploadProgressState;
  if (!total) {
    dom.uploadProgressHint.textContent = getText("images.uploadProgressIdle");
    return;
  }
  if (finished === 0) {
    dom.uploadProgressHint.textContent = getText("images.uploadProgressPreparing").replace(
      "{{count}}",
      total
    );
    return;
  }
  if (finished < total) {
    dom.uploadProgressHint.textContent = getText("images.uploadProgressRunning")
      .replace("{{done}}", finished)
      .replace("{{total}}", total);
    return;
  }
  dom.uploadProgressHint.textContent = failed
    ? getText("images.uploadProgressError")
    : getText("images.uploadProgressDone");
}

function createUploadProgressCard(file, index, total) {
  if (!dom.uploadProgressList) return null;
  const card = document.createElement("div");
  card.className = "upload-progress-card";

  const thumb = document.createElement("div");
  thumb.className = "upload-progress-thumb";
  const img = document.createElement("img");
  img.alt = file.name;
  const badge = document.createElement("span");
  badge.className = "upload-progress-index";
  badge.textContent = `${index + 1}/${total}`;
  thumb.append(img, badge);

  const bar = document.createElement("div");
  bar.className = "upload-progress-bar";
  const fill = document.createElement("div");
  fill.className = "upload-progress-bar-fill";
  bar.appendChild(fill);

  const name = document.createElement("p");
  name.className = "upload-progress-name";
  name.textContent = file.name;

  const status = document.createElement("p");
  status.className = "upload-progress-status";
  status.textContent = getText("images.uploadProgressWaiting");

  card.append(thumb, bar, name, status);
  dom.uploadProgressList.appendChild(card);

  return {
    card,
    fill,
    status,
    img,
    previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : null,
  };
}

function initUploadProgress(files) {
  if (!files.length) return [];
  if (!dom.uploadProgressTray || !dom.uploadProgressList) {
    if (uploadProgressState.timer) {
      clearTimeout(uploadProgressState.timer);
      uploadProgressState.timer = null;
    }
    uploadProgressState.trackers = [];
    uploadProgressState.total = 0;
    uploadProgressState.finished = 0;
    uploadProgressState.failed = 0;
    return files.map(() => null);
  }
  if (uploadProgressState.timer) {
    clearTimeout(uploadProgressState.timer);
    uploadProgressState.timer = null;
  }
  disposeUploadPreviews();
  uploadProgressState.total = files.length;
  uploadProgressState.finished = 0;
  uploadProgressState.failed = 0;
  dom.uploadProgressList.innerHTML = "";
  dom.uploadProgressTray.classList.remove("hidden");
  const trackers = files.map((file, index) => createUploadProgressCard(file, index, files.length));
  uploadProgressState.trackers = trackers;
  updateUploadProgressHint();
  return trackers;
}

function setUploadCardProgress(tracker, percent) {
  if (!tracker?.fill) return;
  const clamped = Math.min(100, Math.max(0, percent));
  tracker.fill.style.width = `${clamped}%`;
  if (tracker.status && clamped > 0 && clamped < 100) {
    tracker.status.textContent = `${clamped}%`;
  }
}

function markUploadCardDone(tracker, success, message) {
  if (tracker?.card) {
    tracker.card.classList.remove("is-success", "is-error");
    tracker.card.classList.add(success ? "is-success" : "is-error");
  }
  if (tracker?.status) {
    tracker.status.textContent =
      message || (success ? getText("images.uploadProgressSuccess") : getText("images.uploadProgressFailed"));
  }
  setUploadCardProgress(tracker, 100);
  if (success && tracker?.previewUrl && tracker?.img) {
    tracker.img.src = tracker.previewUrl;
    tracker.img.classList.add("visible");
    setTimeout(() => {
      if (tracker.previewUrl) {
        URL.revokeObjectURL(tracker.previewUrl);
        tracker.previewUrl = null;
      }
    }, 8000);
  }
  if (uploadProgressState.total) {
    uploadProgressState.finished += 1;
    if (!success) {
      uploadProgressState.failed += 1;
    }
    updateUploadProgressHint();
  }
}

function finalizeUploadProgress() {
  if (uploadProgressState.timer) {
    clearTimeout(uploadProgressState.timer);
    uploadProgressState.timer = null;
  }
  if (!uploadProgressState.total) {
    disposeUploadPreviews();
    uploadProgressState.trackers = [];
    uploadProgressState.finished = 0;
    uploadProgressState.failed = 0;
    uploadProgressState.total = 0;
    return;
  }
  const delay = uploadProgressState.failed ? 3200 : 1800;
  uploadProgressState.timer = setTimeout(() => {
    if (dom.uploadProgressTray) {
      dom.uploadProgressTray.classList.add("hidden");
    }
    if (dom.uploadProgressList) {
      dom.uploadProgressList.innerHTML = "";
    }
    disposeUploadPreviews();
    uploadProgressState.trackers = [];
    uploadProgressState.total = 0;
    uploadProgressState.finished = 0;
    uploadProgressState.failed = 0;
    updateUploadProgressHint();
    uploadProgressState.timer = null;
  }, delay);
}

function uploadSingleFile(file, tracker) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/images/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setUploadCardProgress(tracker, percent);
    };

    xhr.onerror = () => {
      reject(new Error(getText("images.uploadProgressNetwork")));
    };

    xhr.onload = () => {
      const data = xhr.response ?? (() => {
        try {
          return JSON.parse(xhr.responseText || "{}");
        } catch {
          return {};
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        const msg =
          data?.message || `${getText("images.uploadProgressFailed")} (${xhr.status})`;
        reject(new Error(msg));
      }
    };

    const formData = new FormData();
    formData.append("files", file, file.webkitRelativePath || file.name);
    xhr.send(formData);
  });
}

async function loadGallery(keyword = "") {
  if (!dom.imageGrid) return;
  galleryState.filterKeyword = keyword;
  try {
    const url = keyword ? `/api/images/list?keyword=${encodeURIComponent(keyword)}` : "/api/images/list";
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    galleryState.items = data.images || [];
    renderGallery(galleryState.items);
  } catch (err) {
    console.error("load gallery failed", err);
    dom.imageGrid.textContent = getText("images.galleryEmpty");
  }
}

function renderGallery(images) {
  if (!dom.imageGrid) return;
  dom.imageGrid.innerHTML = "";
  if (!images.length) {
    dom.imageGrid.textContent = getText("images.galleryEmpty");
    return;
  }
  
  const available = new Set(images.map((item) => item.relative_path));
  Array.from(galleryState.selected).forEach((path) => {
    if (!available.has(path)) galleryState.selected.delete(path);
  });
  
  images.forEach((image) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "image-card";
    if (galleryState.selected.has(image.relative_path)) {
      card.classList.add("selected");
    }
    card.innerHTML = `
      <img src="${image.url}" alt="${image.name}">
      <div class="image-meta">
        <strong>${image.name}</strong>
        <span>${formatBytes(image.size)}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      if (galleryState.selected.has(image.relative_path)) {
        galleryState.selected.delete(image.relative_path);
        card.classList.remove("selected");
      } else {
        galleryState.selected.add(image.relative_path);
        card.classList.add("selected");
      }
      updateSelectionHint();
    });
    dom.imageGrid.appendChild(card);
  });
  updateSelectionHint();
}

async function loadAiGallery(keyword = "") {
  if (!dom.aiGrid) return;
  aiGalleryState.filterKeyword = keyword;
  try {
    const url = keyword ? `/api/ai/list?keyword=${encodeURIComponent(keyword)}` : "/api/ai/list";
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    aiGalleryState.items = data.pairs || [];
    renderAiGallery(aiGalleryState.items);
  } catch (err) {
    console.error("load ai gallery failed", err);
    dom.aiGrid.textContent = getText("images.galleryEmpty");
  }
}

function renderAiGallery(pairs) {
  if (!dom.aiGrid) return;
  
  // Map existing cards by source path
  const existingCards = new Map();
  dom.aiGrid.querySelectorAll('.ai-card').forEach(card => {
      const path = card.dataset.src;
      if (path) existingCards.set(path, card);
  });

  const newKeys = new Set();

  if (!pairs.length) {
    dom.aiGrid.textContent = getText("images.galleryEmpty");
    return;
  } else {
      if (dom.aiGrid.firstChild && dom.aiGrid.firstChild.nodeType === Node.TEXT_NODE) {
          dom.aiGrid.innerHTML = "";
      }
  }

  const available = new Set(pairs.map((item) => item.source.relative_path));
  Array.from(aiGalleryState.selected).forEach((path) => {
    if (!available.has(path)) aiGalleryState.selected.delete(path);
  });

  pairs.forEach((pair) => {
    const srcPath = pair.source.relative_path;
    newKeys.add(srcPath);
    
    let card = existingCards.get(srcPath);
    const isGenerating = generatingState.active && generatingState.targets.has(srcPath);

    const sourceUrl = pair.source.url;
    const generatedUrl = pair.generated.length > 0 ? pair.generated[0].url : null;
    const tags = pair.tags || "";
    const stem = pair.source.name.replace(/\.[^/.]+$/, "");

    // If we have a generated image, we can assume it's done for this item, unless overwrite is forced.
    // But to be safe and responsive, if we see a generated image, we remove the spinner.
    if (generatedUrl && isGenerating) {
        // Optional: remove from generatingState.targets if we want to stop spinner immediately
        // generatingState.targets.delete(srcPath);
    }

    let generatedHtml = "";
    if (generatedUrl) {
      generatedHtml = `<img src="${generatedUrl}" class="ai-img-gen" alt="Generated">`;
    } else {
      generatedHtml = `
        <div class="ai-img-placeholder">
            <button type="button" class="btn-upload-gen" title="上传生成图">
                <span>+</span>
            </button>
            <input type="file" class="hidden-file-input" accept="image/*" style="display:none">
        </div>`;
    }
    
    // Add spinner if generating
    if (isGenerating && !generatedUrl) {
        generatedHtml += `
        <div class="ai-loading-overlay">
            <div class="spinner-md"></div>
        </div>`;
    }

    const innerHTML = `
      <div class="ai-pair">
        <div class="ai-img-box">
          <img src="${sourceUrl}" class="ai-img-src" alt="Source">
        </div>
        <div class="ai-img-box">
          ${generatedHtml}
        </div>
      </div>
      <div class="ai-meta">
        <div class="ai-tags">${tags}</div>
        <div class="ai-name">${pair.source.name}</div>
      </div>
    `;

    if (!card) {
        card = document.createElement("div");
        card.className = "ai-card";
        card.dataset.src = srcPath;
        card.innerHTML = innerHTML;
        dom.aiGrid.appendChild(card);
        
        // Attach events for new card
        attachAiCardEvents(card, stem, srcPath);
    } else {
        // Update content if changed
        // Simple check: compare innerHTML or just update parts?
        // Updating innerHTML is easiest but destroys event listeners on children (like upload btn)
        // So we re-attach events.
        if (card.innerHTML !== innerHTML) {
            card.innerHTML = innerHTML;
            attachAiCardEvents(card, stem, srcPath);
        }
    }

    if (aiGalleryState.selected.has(srcPath)) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
  
  // Remove old cards
  existingCards.forEach((card, path) => {
      if (!newKeys.has(path)) {
          card.remove();
      }
  });

  updateAiSelectionHint();
}

function attachAiCardEvents(card, stem, srcPath) {
    // Handle selection
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-upload-gen") || e.target.closest(".hidden-file-input")) return;
      
      if (aiGalleryState.selected.has(srcPath)) {
        aiGalleryState.selected.delete(srcPath);
        card.classList.remove("selected");
      } else {
        aiGalleryState.selected.add(srcPath);
        card.classList.add("selected");
      }
      updateAiSelectionHint();
    });

    // Handle manual upload
    const uploadBtn = card.querySelector(".btn-upload-gen");
    const fileInput = card.querySelector(".hidden-file-input");
    
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        
        fileInput.addEventListener("change", async (e) => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append("file", file);
                formData.append("target_stem", stem);
                
                try {
                    uploadBtn.disabled = true;
                    uploadBtn.innerHTML = `<div class="spinner-sm"></div>`;
                    
                    const res = await fetch("/api/ai/upload_generated", {
                        method: "POST",
                        body: formData
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.message);
                    
                    showToast("上传成功");
                    loadAiGallery(aiGalleryState.filterKeyword);
                } catch (err) {
                    showToast(err.message || "上传失败");
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = `<span>+</span>`;
                }
            }
        });
    }

    // Click to enlarge
    card.querySelectorAll("img").forEach(img => {
        img.addEventListener("click", (e) => {
            e.stopPropagation();
            window.open(img.src, "_blank");
        });
    });
}

function updateSelectionHint() {
  if (!dom.selectionHint) return;
  if (galleryState.selected.size > 0) {
    dom.selectionHint.textContent = getText("images.selectionSelected").replace(
      "{{count}}",
      galleryState.selected.size
    );
  } else {
    dom.selectionHint.textContent = getText("images.selectionHint");
  }
}

function updateAiSelectionHint() {
  if (!dom.aiSelectionHint) return;
  if (aiGalleryState.selected.size > 0) {
    dom.aiSelectionHint.textContent = getText("images.selectionSelected").replace(
      "{{count}}",
      aiGalleryState.selected.size
    );
  } else {
    dom.aiSelectionHint.textContent = getText("images.selectionHint");
  }
}

function clearSelection() {
  galleryState.selected.clear();
  document.querySelectorAll(".image-card").forEach((el) => el.classList.remove("selected"));
  updateSelectionHint();
}

function clearAiSelection() {
  aiGalleryState.selected.clear();
  document.querySelectorAll(".ai-card").forEach((el) => el.classList.remove("selected"));
  updateAiSelectionHint();
}

async function handleUploadSubmit(event) {
  event?.preventDefault?.();
  const files = Array.from(dom.imageInput?.files || []);
  if (!files.length) {
    showToast(getText("images.uploadEmpty"));
    return;
  }
  if (isUploading) {
    showToast(getText("images.uploadBusy"));
    return;
  }
  isUploading = true;
  const trackers = initUploadProgress(files);
  const stats = { added: 0, skipped: 0, failed: 0 };
  try {
    for (let idx = 0; idx < files.length; idx += 1) {
      const file = files[idx];
      const tracker = trackers[idx];
      try {
        const result = await uploadSingleFile(file, tracker);
        const addedRaw =
          typeof result?.added === "number"
            ? result.added
            : Array.isArray(result?.items)
            ? result.items.length
            : 1;
        const addedValue = Number(addedRaw);
        const addedCount = Number.isFinite(addedValue) ? addedValue : 0;
        const skippedValue = Number(result?.skipped ?? 0);
        const skippedCount = Number.isFinite(skippedValue) ? skippedValue : 0;
        stats.added += addedCount;
        stats.skipped += skippedCount;
        markUploadCardDone(tracker, true, getText("images.uploadProgressSuccess"));
      } catch (error) {
        stats.failed += 1;
        console.error("upload failed", error);
        markUploadCardDone(tracker, false, error.message || getText("images.uploadProgressFailed"));
      }
    }
    dom.uploadForm?.reset();
    await loadGallery(galleryState.filterKeyword);
    const fragments = [];
    if (stats.added) {
      fragments.push(
        getText("images.uploadSummarySuccess").replace("{{count}}", stats.added)
      );
    }
    if (stats.skipped) {
      fragments.push(
        getText("images.uploadSummarySkip").replace("{{count}}", stats.skipped)
      );
    }
    if (stats.failed) {
      fragments.push(
        getText("images.uploadSummaryFail").replace("{{count}}", stats.failed)
      );
    }
    const headKey = stats.failed ? "images.uploadProgressError" : "images.uploadProgressDone";
    const body = fragments.length ? `${getText(headKey)}：${fragments.join("，")}` : getText(headKey);
    showModal(getText("modal.title"), body);
  } catch (err) {
    console.error("upload pipeline error", err);
    showModal(getText("modal.title"), err.message || getText("images.uploadProgressFailed"));
  } finally {
    finalizeUploadProgress();
    isUploading = false;
  }
}

async function handleClearAllClick() {
  if (!window.confirm(getText("images.clearConfirm"))) return;
  if (dom.clearAllBtn) dom.clearAllBtn.disabled = true;
  try {
    const res = await postJSON("/api/images/clear", {});
    clearSelection();
    await loadGallery(galleryState.filterKeyword);
    showModal(getText("modal.title"), res.message || getText("images.clearSuccess"));
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("images.clearSuccess"));
  } finally {
    if (dom.clearAllBtn) dom.clearAllBtn.disabled = false;
  }
}

async function handleDeleteSelectedClick() {
  if (galleryState.selected.size === 0) {
    showToast(getText("images.deleteEmpty"));
    return;
  }
  if (!window.confirm(getText("images.deleteConfirm"))) return;
  if (dom.deleteSelectedBtn) dom.deleteSelectedBtn.disabled = true;
  try {
    const res = await postJSON("/api/images/delete", {
      targets: Array.from(galleryState.selected),
    });
    clearSelection();
    await loadGallery(galleryState.filterKeyword);
    showModal(getText("modal.title"), res.message || getText("images.deleteSuccess"));
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("images.deleteSuccess"));
  } finally {
    if (dom.deleteSelectedBtn) dom.deleteSelectedBtn.disabled = false;
  }
}

async function handleOrganizeSubmit(event) {
  event.preventDefault();
  const payload = {
    prefix: dom.prefixInput?.value.trim() || "",
    start_number: Number(dom.startNumberInput?.value) || 1,
    apply_prefix: true,
    apply_sequence: true,
    keyword: dom.keywordInput?.value.trim() || "",
    keyword_action: dom.keywordActionSelect?.value || "none",
    targets: Array.from(galleryState.selected),
  };
  const submitBtn = dom.renameForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const res = await postJSON("/api/images/organize", payload);
    showModal(getText("modal.title"), res.message);
    loadGallery(galleryState.filterKeyword);
  } catch (err) {
    showModal(getText("modal.title"), err.message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleGenerateSubmit(event) {
  event.preventDefault();
  if (dom.generateBtn) dom.generateBtn.disabled = true;
  const payload = {
    prompt: dom.promptInput?.value.trim() || getText("images.promptPlaceholder"),
    overwrite: dom.overwriteToggle?.checked ?? false,
    targets: Array.from(aiGalleryState.selected),
    key_path: dom.keyPathInput?.value.trim() || "",
    project_id: dom.projectIdInput?.value.trim() || "",
    location: dom.locationInput?.value.trim() || "",
  };
  if (!payload.key_path || !payload.project_id || !payload.location) {
    showModal(getText("modal.title"), getText("images.configRequired"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  
  // Set generating state
  generatingState.active = true;
  generatingState.targets = new Set(payload.targets.length ? payload.targets : aiGalleryState.items.map(i => i.source.relative_path));
  renderAiGallery(aiGalleryState.items); // Re-render to show spinners immediately

  try {
    const res = await postJSON("/api/images/generate", payload);
    showModal(getText("modal.title"), res.message);
    // 触发一次刷新
    loadAiGallery(aiGalleryState.filterKeyword);
  } catch (err) {
    showModal(getText("modal.title"), err.message);
    generatingState.active = false;
    generatingState.targets.clear();
    renderAiGallery(aiGalleryState.items);
  } finally {
    if (dom.generateBtn) dom.generateBtn.disabled = false;
  }
}

async function handleTagSubmit(event) {
  event.preventDefault();
  const submitBtn = dom.tagForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  
  const payload = {
    targets: Array.from(aiGalleryState.selected),
    tags: dom.tagInput?.value.trim() || "",
  };
  
  if (!payload.targets.length) {
    showToast(getText("images.deleteEmpty")); // Reuse "Please select images"
    if (submitBtn) submitBtn.disabled = false;
    return;
  }
  
  try {
    const res = await postJSON("/api/images/tag", payload);
    showToast(res.message || getText("ai.tagSuccess"));
    loadAiGallery(aiGalleryState.filterKeyword);
  } catch (err) {
    showModal(getText("modal.title"), err.message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function initActions() {
  if (dom.setupBtn) {
    dom.setupBtn.addEventListener("click", async () => {
      dom.setupBtn.disabled = true;
      try {
        const payload = {
            github_accelerator: featureStates.githubAccelerator === "on"
        };
        const res = await postJSON("/api/run-setup", payload);
        showModal(getText("modal.title"), res.message);
      } catch (err) {
        showModal(getText("modal.title"), err.message);
      } finally {
        dom.setupBtn.disabled = false;
      }
    });
  }

  if (dom.startBtn) {
      dom.startBtn.addEventListener("click", async () => {
          dom.startBtn.disabled = true;
          try {
              const res = await postJSON("/api/run-start");
              showToast(res.message);
          } catch (err) {
              showModal(getText("modal.title"), err.message);
          } finally {
              dom.startBtn.disabled = false;
          }
      });
  }

  if (dom.downloadForm) {
    dom.downloadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      dom.downloadBtn.disabled = true;
      const formData = new FormData(dom.downloadForm);
      const payload = {
        model: formData.get("model"),
        source: formData.get("source"),
      };
      try {
        const res = await postJSON("/api/download", payload);
        showModal(getText("modal.title"), res.message);
      } catch (err) {
        showModal(getText("modal.title"), err.message);
      } finally {
        dom.downloadBtn.disabled = false;
      }
    });
  }

  dom.modalClose?.addEventListener("click", hideModal);
  dom.modal?.addEventListener("click", (e) => {
    if (dom.modal.classList.contains('modal-force')) return;
    if (e.target === dom.modal) hideModal();
  });

  dom.updateBtn?.addEventListener("click", () => checkUpdate(false));

  bindCopy(dom.copySetupLog, dom.setupLog);
  bindCopy(dom.copyDownloadLog, dom.downloadLog);
  bindCopy(dom.copyGenerationLog, dom.generationLog);

  dom.themeToggle?.addEventListener("click", toggleTheme);
  dom.langToggle?.addEventListener("click", toggleLanguage);
  dom.uploadForm?.addEventListener("submit", handleUploadSubmit);
  dom.imageInput?.addEventListener("change", () => {
    if (dom.imageInput?.files?.length) {
      handleUploadSubmit();
    }
  });
  dom.refreshGalleryBtn?.addEventListener("click", () => loadGallery(galleryState.filterKeyword));
  dom.clearAllBtn?.addEventListener("click", handleClearAllClick);
  dom.deleteSelectedBtn?.addEventListener("click", handleDeleteSelectedClick);
  dom.renameForm?.addEventListener("submit", handleOrganizeSubmit);
  dom.applyFilterBtn?.addEventListener("click", () => {
    loadGallery(dom.galleryFilter?.value.trim() || "");
  });
  dom.generationForm?.addEventListener("submit", handleGenerateSubmit);
  dom.clearSelectionBtn?.addEventListener("click", clearSelection);
  dom.clearAiSelectionBtn?.addEventListener("click", clearAiSelection);
  dom.applyAiFilterBtn?.addEventListener("click", () => {
    loadAiGallery(dom.aiGalleryFilter?.value.trim() || "");
  });
  dom.tagForm?.addEventListener("submit", handleTagSubmit);

  // Switches
  if (dom.autodlSwitch) {
      dom.autodlSwitch.addEventListener("click", () => {
          const newState = featureStates.autodlAccelerator === "on" ? "disable" : "enable";
          handleAcceleratorAction(newState);
      });
  }
  if (dom.githubSwitch) {
      dom.githubSwitch.addEventListener("click", () => {
          const newState = featureStates.githubAccelerator === "on" ? "off" : "on";
          featureStates.githubAccelerator = newState;
          updateSwitchState(dom.githubSwitch, newState);
      });
  }
}

function startPolling() {
  fetchStatus();
  if (pollingHandle) clearInterval(pollingHandle);
  pollingHandle = setInterval(fetchStatus, pollingIntervalMs);
}

function bootstrapPreferences() {
  try {
    const savedTheme = localStorage.getItem(storageKeys.theme);
    const savedLang = localStorage.getItem(storageKeys.lang);
    applyTheme(savedTheme || "dark");
    applyLanguage(savedLang || "zh");
  } catch {
    applyTheme("dark");
    applyLanguage("zh");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrapPreferences();
  initNavigation();
  initActions();
  startPolling();
  updateSelectionHint();
  updateAiSelectionHint();
  loadGallery();
  goToStep(0);
  // Trigger update check in background (will show modal if update available)
  checkUpdate(true);
});
