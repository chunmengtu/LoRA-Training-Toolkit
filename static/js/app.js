const pollingIntervalMs = 2500;
const storageKeys = {
  theme: "aitoolkit-theme",
  lang: "aitoolkit-lang",
};

const STEPS = ["overview", "environment", "download", "images", "ai", "ai-clean", "console"];
let currentStepIndex = 0;

const dictionary = {
  zh: {
    "brand.eyebrow": "AI Toolkit",
    "brand.title": "LoRA 训练工具箱",
    "nav.overview": "概览",
    "nav.environment": "环境初始化",
    "nav.download": "模型下载",
    "nav.images": "图像处理",
    "nav.ai": "AI 处理",
    "nav.aiClean": "AI 图片清洗",
    "nav.console": "控制台",
    "nav.system": "系统",
    "nav.linux": "状态",
    "overview.title": "一站式部署与训练流程面板",
    "overview.lead": "先阅读每个阶段的说明，再按顺序执行命令。系统会自动记录日志、状态和处理进度。",
    "overview.step1": "步骤 1 · 初始化",
    "overview.step1Desc": "安装依赖，准备 Python、Node.js 与工具链。",
    "overview.step2": "步骤 2 · 选择模型",
    "overview.step2Desc": "选择训练或编辑模型，并切换下载来源。",
    "overview.step3": "步骤 3 · 图像处理",
    "overview.step3Desc": "上传、筛选、重命名和导出素材图片。",
    "overview.step5": "步骤 5 · AI 处理",
    "overview.step5Desc": "AI 批量生成、打标与结果导出。",
    "overview.step4": "步骤 6 · 监控",
    "overview.step4Desc": "在控制台查看进度、复制日志并处理异常提示。",
    "environment.title": "环境初始化向导",
    "environment.desc": "自动执行依赖安装与工具准备。Linux 会顺序安装相关组件，Windows 会调用 Easy Install 脚本。",
    "environment.button": "开始执行",
    "environment.startBtn": "启动训练界面",
    "environment.executionTitle": "执行内容",
    "environment.item1": "安装 huggingface_hub 与 modelscope",
    "environment.item2": "配置 Node.js 20 源并安装 nodejs",
    "environment.item3": "克隆或更新 ai-toolkit，安装 requirements",
    "environment.item4": "启动 ai-toolkit，Linux 默认端口 6006，Windows 默认端口 7867",
    "environment.alertTitle": "温馨提醒：",
    "environment.alertDesc": "当前界面会持续记录完整的命令日志，执行期间请勿重复点击同一操作。",
    "environment.acceleratorTitle": "Autodl 学术镜像加速",
    "environment.acceleratorBody": "仅适用于 AutoDL 环境，可加速 GitHub 与 HuggingFace 访问；不需要时建议关闭。",
    "environment.githubTitle": "GitHub 加速",
    "environment.githubBody": "第三方 GitHub 代理加速，适合访问 GitHub 较慢时使用。",
    "environment.acceleratorEnable": "开启加速",
    "environment.acceleratorDisable": "关闭加速",
    "environment.acceleratorSuccess": "加速设置已更新",
    "environment.acceleratorFail": "加速设置失败",
    "environment.acceleratorUnsupported": "该功能仅适用于 Linux/AutoDL 环境",
    "environment.acceleratorOn": "开启",
    "environment.acceleratorOff": "关闭",
    "environment.acceleratorConflict": "Autodl 学术镜像加速与 GitHub 加速不能同时开启，请先关闭 GitHub 加速。",
    "environment.githubAutoDisabledAutodl": "检测到同时启用两个加速功能，已自动关闭 Autodl 学术镜像加速。",
    "download.title": "模型选择与下载渠道",
    "download.desc": "按需求选择模型，并在下载来源之间切换。系统会自动创建模型目录。",
    "download.modelLegend": "选择模型",
    "download.sourceLegend": "下载来源",
    "download.button": "开始下载",
    "download.note": "默认目录：{{dir}}/模型名",
    "download.showMore": "显示更多模型 ({{n}})",
    "download.showLess": "收起",
    "download.sourceRecommended": "推荐",
    "download.sourceAltDesc": "官方社区源",
    "images.title": "图像处理 · 管理",
    "images.desc": "支持上传单图、文件夹或压缩包，并提供批量整理、筛选和导出能力。",
    "images.uploadTitle": "图片上传",
    "images.uploadDrop": "拖拽文件到此处，或点击选择文件",
    "images.refreshBtn": "刷新",
    "images.uploadAutoNote": "选择文件后会自动开始上传",
    "images.deleteSelected": "删除所选",
    "images.clearAll": "清空全部",
    "images.deleteEmpty": "请先选择需要删除的图片",
    "images.deleteConfirm": "确定删除所选图片？该操作无法撤销。",
    "images.clearConfirm": "确定清空全部图片？该操作无法撤销。",
    "images.clearSuccess": "已清空全部图片",
    "images.deleteSuccess": "已删除所选图片",
    "images.renameTitle": "批量重命名",
    "images.prefixPlaceholder": "前缀",
    "images.startNumberPlaceholder": "起始数字",
    "images.keywordPlaceholder": "关键字",
    "images.keywordActionNone": "仅重命名",
    "images.keywordActionFilter": "只作用于命中项",
    "images.keywordActionDelete": "删除命中项",
    "images.keywordActionKeep": "仅保留命中项",
    "images.renameBtn": "执行整理",
    "images.exportTitle": "批量导出",
    "images.exportBtn": "导出图片包",
    "images.generateTitle": "AI 批量生成",
    "images.promptPlaceholder": "描述你想生成的目标风格或修改效果...",
    "images.overwriteLabel": "生成后覆盖同名文件",
    "images.apiKeyPlaceholder": "输入 RunningHub API Key",
    "images.configRequired": "请填写 RunningHub API Key",
    "images.requestUrlPlaceholder": "输入 RunningHub 工作流接口地址",
    "images.queryUrlPlaceholder": "输入查询接口地址",
    "images.aspectRatioCustom": "自定义",
    "images.customAspectRatioPlaceholder": "输入自定义 aspectRatio，例如 7:10",
    "images.requestUrlRequired": "请填写 RunningHub 工作流接口地址",
    "images.queryUrlRequired": "请填写查询接口地址",
    "images.customAspectRatioRequired": "请选择自定义后再填写 aspectRatio",
    "images.extraReferenceLabel": "附加参考图（图2~图N）",
    "images.extraReferenceSelectBtn": "选择附加参考图",
    "images.extraReferenceSummaryIdle": "未选择文件",
    "images.extraReferenceSummarySelected": "已选择 {{count}} 个文件",
    "images.extraReferenceHint": "默认图像处理区的原图会作为图1；这里上传的图片会按顺序作为图2、图3、图4……",
    "images.extraReferenceItem": "图{{index}} · {{name}}",
    "images.extraReferenceRemove": "移除",
    "images.workflowExtraImageNodesPlaceholder": "额外图像节点，每行一个，格式：nodeId:fieldName",
    "images.workflowExtraImageNodesInvalid": "额外图像节点格式无效，请使用每行一个 nodeId:fieldName",
    "images.extraReferenceNodeMissing": "已上传额外参考图，但当前工作流没有足够的图像节点映射",
    "images.workflowImageNodeIdPlaceholder": "图片节点 ID",
    "images.workflowImageFieldNamePlaceholder": "图片字段名",
    "images.workflowPromptNodeIdPlaceholder": "提示词节点 ID",
    "images.workflowPromptFieldNamePlaceholder": "提示词字段名",
    "images.workflowAspectNodeIdPlaceholder": "比例节点 ID",
    "images.workflowAspectFieldNamePlaceholder": "比例字段名",
    "images.workflowAspectFieldDataPlaceholder": "比例 fieldData（可留空）",
    "images.workflowHint": "不同 RunningHub 工作流的 nodeId / fieldName 可能不同；如果日志提示 NODE_INFO_MISMATCH，请先修改这里。",
    "images.workflowImageConfigRequired": "请填写图片节点的 nodeId 和 fieldName",
    "images.workflowPromptConfigInvalid": "提示词节点的 nodeId 和 fieldName 需要同时填写，或同时留空",
    "images.workflowAspectConfigInvalid": "比例节点的 nodeId 和 fieldName 需要同时填写，或同时留空",
    "images.advancedToggle": "高级设置（自动解析 / 手动节点）",
    "images.exampleFileLabel": "上传官方 Python 示例",
    "images.exampleTextareaPlaceholder": "粘贴官方 Python 请求示例，点击解析后自动回填配置",
    "images.parseExampleBtn": "解析示例",
    "images.exampleParseRequired": "请先上传或粘贴 RunningHub 官方 Python 请求示例",
    "images.exampleParseSuccess": "示例解析成功，已自动回填工作流配置",
    "images.selectionHint": "未选择图片时默认处理全部",
    "images.selectionSelected": "已选择 {{count}} 张图片",
    "images.generateBtn": "开始生成",
    "images.clearSelection": "清空",
    "images.galleryTitle": "图像瀑布流",
    "images.galleryFilter": "搜索...",
    "images.filterBtn": "搜索",
    "images.galleryEmpty": "暂无图片",
    "images.uploadProgressTitle": "上传进度",
    "images.uploadProgressIdle": "暂无上传任务",
    "images.uploadProgressPreparing": "共有 {{count}} 个文件待上传",
    "images.uploadProgressRunning": "正在上传 {{done}} / {{total}}",
    "images.uploadProgressDone": "全部上传完成",
    "images.uploadProgressError": "上传结束，但部分文件失败",
    "images.uploadProgressWaiting": "等待上传",
    "images.uploadProgressSuccess": "上传完成",
    "images.uploadProgressFailed": "上传失败",
    "images.uploadProgressNetwork": "网络异常，请稍后重试",
    "images.uploadSummarySuccess": "成功 {{count}} 个",
    "images.uploadSummarySkip": "跳过 {{count}} 个",
    "images.uploadSummaryFail": "失败 {{count}} 个",
    "images.uploadBusy": "已有上传任务正在进行，请稍候",
    "images.consoleTitle": "AI 生成日志",
    "images.uploadEmpty": "请至少选择一个文件",
    "images.manualUploadTitle": "上传生成图",
    "images.manualUploadSuccess": "上传成功",
    "images.manualUploadFailed": "上传失败",
    "ai.title": "AI 处理",
    "ai.desc": "使用 AI 批量生成图像、批量打标并导出结果。",
    "ai.tagTitle": "批量打标",
    "ai.tagPlaceholder": "输入标签...",
    "ai.tagBtn": "应用标签",
    "ai.exportBtn": "导出 AI 数据包",
    "ai.galleryTitle": "AI 生成预览",
    "ai.tagSuccess": "标签已更新",
    "ai.tagHint": "请用简洁语言描述你希望生成图的目标风格或效果，建议优先使用英文。<br>例如：<br>- Transform into Ghibli anime style<br>- Transform into inkwash painting style<br>- Add glasses to the character",
    "ai.platformTitle": "AI 平台配置",
    "ai.platformProvider": "平台",
    "ai.platformModelPreset": "模型预设",
    "ai.platformCustomModel": "自定义模型",
    "ai.platformCustomModelPlaceholder": "输入自定义模型名...",
    "ai.platformApiKey": "API Key",
    "ai.platformBaseUrl": "Base URL（选填，自定义或代理时使用）",
    "ai.platformTestBtn": "测试连接",
    "ai.platformTestOk": "连接测试成功",
    "ai.platformTestFail": "连接测试失败",
    "ai.platformErrorModelMissing": "请先选择或输入要使用的模型名称。",
    "ai.platformErrorApiKeyMissing": "请填写对应平台的 API Key。",
    "ai.platformErrorBaseUrlMissing": "使用自定义平台时，请填写 Base URL。",
    "ai.cleanTitle": "AI 图片清洗",
    "ai.cleanPageDesc": "调整提示词后即可调用大模型分析图片内容，生成结构化标签并支持进一步筛选。",
    "ai.cleanPromptPlaceholder": "输入提示词...",
    "ai.cleanPromptHint": "提示词支持自定义，适合按业务调整清洗维度。",
    "ai.cleanSelectionHint": "未选择图片时默认处理全部",
    "ai.cleanRunBtn": "开始清洗",
    "ai.cleanResetBtn": "重置筛选",
    "ai.cleanResultTitle": "AI 图片清洗结果",
    "ai.cleanNoTags": "尚未生成标签，请先运行 AI 图片清洗。",
    "ai.cleanDimension.main_subject": "主体",
    "ai.cleanDimension.appearance": "外观",
    "ai.cleanDimension.action_state": "动作状态",
    "ai.cleanDimension.environment": "环境物件",
    "ai.cleanDimension.visual_style": "视觉风格",
    "step.next": "下一步",
    "step.prev": "上一步",
    "step.finish": "完成",
    "step.progress": "第 {{current}} / {{total}} 步",
    "step.pageBadge": "步骤 {{current}} / {{total}}",
    "console.desc": "在这里查看环境安装、模型下载、AI 生成和 AI 图片清洗的实时状态与日志。",
    "console.setupTitle": "环境执行日志",
    "console.downloadTitle": "模型下载日志",
    "console.copy": "复制",
    "status.label": "状态：",
    "status.idle": "待命",
    "status.queued": "排队中",
    "status.running": "运行中",
    "status.success": "已完成",
    "status.error": "异常",
    "log.waiting": "等待任务...",
    "modal.title": "提示",
    "modal.close": "知道了",
    "toast.copyOk": "已复制",
    "toast.copyFail": "复制失败",
    "toast.preview": "当前处于预览模式",
    "update.title": "发现新版本",
    "update.current": "当前版本：",
    "update.latest": "最新版本：",
    "update.notes": "更新说明：",
    "update.btn": "立即更新",
    "update.checking": "正在检查更新...",
    "update.latestMsg": "当前已是最新版本",
    "update.fail": "检查更新失败",
    "toolbar.theme": "主题切换",
    "toolbar.language": "语言切换",
    "toolbar.update": "检查更新"
  },
  en: {
    "brand.eyebrow": "AI Toolkit",
    "brand.title": "LoRA Training Toolkit",
    "nav.overview": "Overview",
    "nav.environment": "Setup",
    "nav.download": "Models",
    "nav.images": "Images",
    "nav.ai": "AI Processing",
    "nav.aiClean": "AI Clean",
    "nav.console": "Console",
    "nav.system": "System",
    "nav.linux": "Status",
    "overview.title": "One Panel for Setup and Training Flow",
    "overview.lead": "Read each section first, then run actions in order. The app keeps status, progress, and logs in sync.",
    "overview.step1": "Step 1 · Setup",
    "overview.step1Desc": "Install dependencies and prepare Python, Node.js, and the toolchain.",
    "overview.step2": "Step 2 · Models",
    "overview.step2Desc": "Choose the model you need and switch download sources.",
    "overview.step3": "Step 3 · Images",
    "overview.step3Desc": "Upload, filter, rename, and export source images.",
    "overview.step5": "Step 5 · AI Processing",
    "overview.step5Desc": "Run AI generation, tagging, and exports.",
    "overview.step4": "Step 6 · Monitoring",
    "overview.step4Desc": "Track progress, copy logs, and catch errors in one place.",
    "environment.title": "Environment Setup",
    "environment.desc": "Run dependency and toolchain setup automatically. Linux installs components in sequence, while Windows uses the Easy Install script.",
    "environment.button": "Run Setup",
    "environment.startBtn": "Launch UI",
    "environment.executionTitle": "What Will Run",
    "environment.item1": "Install huggingface_hub and modelscope",
    "environment.item2": "Configure the Node.js 20 source and install nodejs",
    "environment.item3": "Clone or update ai-toolkit and install requirements",
    "environment.item4": "Launch ai-toolkit on port 6006 for Linux or 7867 for Windows",
    "environment.alertTitle": "Reminder:",
    "environment.alertDesc": "This page keeps a full command log. Avoid clicking the same action repeatedly while it is running.",
    "environment.acceleratorTitle": "Autodl Mirror Boost",
    "environment.acceleratorBody": "Only for AutoDL environments. Speeds up GitHub and HuggingFace access when needed.",
    "environment.githubTitle": "GitHub Proxy Boost",
    "environment.githubBody": "Uses a third-party GitHub proxy when direct access is slow.",
    "environment.acceleratorEnable": "Enable",
    "environment.acceleratorDisable": "Disable",
    "environment.acceleratorSuccess": "Acceleration settings updated",
    "environment.acceleratorFail": "Failed to update acceleration settings",
    "environment.acceleratorUnsupported": "Available only on Linux/AutoDL",
    "environment.acceleratorOn": "On",
    "environment.acceleratorOff": "Off",
    "environment.acceleratorConflict": "Autodl mirror boost and GitHub boost cannot be enabled at the same time. Turn off GitHub boost first.",
    "environment.githubAutoDisabledAutodl": "Both boosts were enabled, so Autodl mirror boost was turned off automatically.",
    "download.title": "Model Selection",
    "download.desc": "Pick the model you need and switch between download sources. The app creates the model directory automatically.",
    "download.modelLegend": "Model",
    "download.sourceLegend": "Source",
    "download.button": "Download",
    "download.note": "Default directory: {{dir}}/model-name",
    "download.showMore": "Show more models ({{n}})",
    "download.showLess": "Collapse",
    "download.sourceRecommended": "Recommended",
    "download.sourceAltDesc": "Official community source",
    "images.title": "Image Management",
    "images.desc": "Upload single files, folders, or archives, then organize, filter, and export them in batches.",
    "images.uploadTitle": "Upload Images",
    "images.uploadDrop": "Drop files here or click to choose",
    "images.refreshBtn": "Refresh",
    "images.uploadAutoNote": "Uploading starts automatically after files are selected",
    "images.deleteSelected": "Delete Selected",
    "images.clearAll": "Clear All",
    "images.deleteEmpty": "Select images to delete first",
    "images.deleteConfirm": "Delete the selected images? This cannot be undone.",
    "images.clearConfirm": "Clear all images? This cannot be undone.",
    "images.clearSuccess": "All images were cleared",
    "images.deleteSuccess": "Selected images were deleted",
    "images.renameTitle": "Batch Rename",
    "images.prefixPlaceholder": "Prefix",
    "images.startNumberPlaceholder": "Start number",
    "images.keywordPlaceholder": "Keyword",
    "images.keywordActionNone": "Rename only",
    "images.keywordActionFilter": "Apply to matches",
    "images.keywordActionDelete": "Delete matches",
    "images.keywordActionKeep": "Keep matches only",
    "images.renameBtn": "Apply",
    "images.exportTitle": "Batch Export",
    "images.exportBtn": "Export Image Pack",
    "images.generateTitle": "AI Batch Generate",
    "images.promptPlaceholder": "Describe the target style or edit you want...",
    "images.overwriteLabel": "Overwrite files with the same name",
    "images.apiKeyPlaceholder": "Enter the RunningHub API key",
    "images.configRequired": "Enter the RunningHub API key",
    "images.requestUrlPlaceholder": "Enter the RunningHub workflow URL",
    "images.queryUrlPlaceholder": "Enter the query endpoint URL",
    "images.aspectRatioCustom": "Custom",
    "images.customAspectRatioPlaceholder": "Enter a custom aspectRatio, such as 7:10",
    "images.requestUrlRequired": "Enter the RunningHub workflow URL",
    "images.queryUrlRequired": "Enter the query endpoint URL",
    "images.customAspectRatioRequired": "Enter a custom aspectRatio",
    "images.extraReferenceLabel": "Extra reference images (Image 2~N)",
    "images.extraReferenceSelectBtn": "Choose extra references",
    "images.extraReferenceSummaryIdle": "No files selected",
    "images.extraReferenceSummarySelected": "{{count}} file(s) selected",
    "images.extraReferenceHint": "The original image from the Images page is always submitted as Image 1. Files uploaded here are sent in order as Image 2, Image 3, Image 4, and so on.",
    "images.extraReferenceItem": "Image {{index}} · {{name}}",
    "images.extraReferenceRemove": "Remove",
    "images.workflowExtraImageNodesPlaceholder": "Extra image nodes, one per line, format: nodeId:fieldName",
    "images.workflowExtraImageNodesInvalid": "Invalid extra image node format. Use one nodeId:fieldName per line.",
    "images.extraReferenceNodeMissing": "Extra reference images were uploaded, but the current workflow does not have enough image node mappings",
    "images.workflowImageNodeIdPlaceholder": "Image node ID",
    "images.workflowImageFieldNamePlaceholder": "Image field name",
    "images.workflowPromptNodeIdPlaceholder": "Prompt node ID",
    "images.workflowPromptFieldNamePlaceholder": "Prompt field name",
    "images.workflowAspectNodeIdPlaceholder": "Aspect node ID",
    "images.workflowAspectFieldNamePlaceholder": "Aspect field name",
    "images.workflowAspectFieldDataPlaceholder": "Aspect fieldData (optional)",
    "images.workflowHint": "Different RunningHub workflows may use different nodeId / fieldName values. If you see NODE_INFO_MISMATCH in logs, update them here first.",
    "images.workflowImageConfigRequired": "Enter the image nodeId and fieldName",
    "images.workflowPromptConfigInvalid": "Prompt nodeId and fieldName must be filled together or left blank together",
    "images.workflowAspectConfigInvalid": "Aspect nodeId and fieldName must be filled together or left blank together",
    "images.advancedToggle": "Advanced Settings (Auto Parse / Manual Nodes)",
    "images.exampleFileLabel": "Upload official Python example",
    "images.exampleTextareaPlaceholder": "Paste the official RunningHub Python request example and click Parse to fill the config automatically",
    "images.parseExampleBtn": "Parse Example",
    "images.exampleParseRequired": "Upload or paste the official RunningHub Python request example first",
    "images.exampleParseSuccess": "Example parsed and workflow config filled automatically",
    "images.selectionHint": "All images will be used when none are selected",
    "images.selectionSelected": "{{count}} image(s) selected",
    "images.generateBtn": "Generate",
    "images.clearSelection": "Clear",
    "images.galleryTitle": "Image Gallery",
    "images.galleryFilter": "Search...",
    "images.filterBtn": "Search",
    "images.galleryEmpty": "No images yet",
    "images.uploadProgressTitle": "Upload Progress",
    "images.uploadProgressIdle": "No upload tasks",
    "images.uploadProgressPreparing": "{{count}} file(s) waiting to upload",
    "images.uploadProgressRunning": "Uploading {{done}} / {{total}}",
    "images.uploadProgressDone": "All uploads finished",
    "images.uploadProgressError": "Uploads finished with some failures",
    "images.uploadProgressWaiting": "Waiting",
    "images.uploadProgressSuccess": "Uploaded",
    "images.uploadProgressFailed": "Failed",
    "images.uploadProgressNetwork": "Network error, please try again later",
    "images.uploadSummarySuccess": "{{count}} succeeded",
    "images.uploadSummarySkip": "{{count}} skipped",
    "images.uploadSummaryFail": "{{count}} failed",
    "images.uploadBusy": "Another upload is already running",
    "images.consoleTitle": "AI Generation Logs",
    "images.uploadEmpty": "Choose at least one file",
    "images.manualUploadTitle": "Upload generated image",
    "images.manualUploadSuccess": "Upload succeeded",
    "images.manualUploadFailed": "Upload failed",
    "ai.title": "AI Processing",
    "ai.desc": "Generate images with AI, apply tags, and export the results.",
    "ai.tagTitle": "Batch Tagging",
    "ai.tagPlaceholder": "Enter tags...",
    "ai.tagBtn": "Apply Tags",
    "ai.exportBtn": "Export AI Package",
    "ai.galleryTitle": "AI Preview",
    "ai.tagSuccess": "Tags updated",
    "ai.tagHint": "Describe the target style or effect you want, preferably in English.<br>Examples:<br>- Transform into Ghibli anime style<br>- Transform into inkwash painting style<br>- Add glasses to the character",
    "ai.platformTitle": "AI Platform",
    "ai.platformProvider": "Provider",
    "ai.platformModelPreset": "Model Preset",
    "ai.platformCustomModel": "Custom Model",
    "ai.platformCustomModelPlaceholder": "Enter a custom model name...",
    "ai.platformApiKey": "API Key",
    "ai.platformBaseUrl": "Base URL (optional, for custom or proxy access)",
    "ai.platformTestBtn": "Test Connection",
    "ai.platformTestOk": "Connection test passed",
    "ai.platformTestFail": "Connection test failed",
    "ai.platformErrorModelMissing": "Choose a model or enter a custom one first.",
    "ai.platformErrorApiKeyMissing": "Enter the API key for the selected provider.",
    "ai.platformErrorBaseUrlMissing": "Enter a Base URL when using a custom provider.",
    "ai.cleanTitle": "AI Image Clean",
    "ai.cleanPageDesc": "Edit the prompt and let the model extract structured tags from each image for later filtering.",
    "ai.cleanPromptPlaceholder": "Enter a prompt...",
    "ai.cleanPromptHint": "The prompt is editable so you can adapt the cleaning dimensions to your workflow.",
    "ai.cleanSelectionHint": "All images will be used when none are selected",
    "ai.cleanRunBtn": "Run Clean",
    "ai.cleanResetBtn": "Reset Filters",
    "ai.cleanResultTitle": "AI Clean Results",
    "ai.cleanNoTags": "No tags yet. Run AI image cleaning first.",
    "ai.cleanDimension.main_subject": "Subject",
    "ai.cleanDimension.appearance": "Appearance",
    "ai.cleanDimension.action_state": "Action / State",
    "ai.cleanDimension.environment": "Environment",
    "ai.cleanDimension.visual_style": "Visual Style",
    "step.next": "Next",
    "step.prev": "Back",
    "step.finish": "Finish",
    "step.progress": "Step {{current}} / {{total}}",
    "step.pageBadge": "Step {{current}} / {{total}}",
    "console.desc": "View live status and logs here for setup, model downloads, AI generation, and AI image cleaning.",
    "console.setupTitle": "Setup Logs",
    "console.downloadTitle": "Download Logs",
    "console.copy": "Copy",
    "status.label": "Status: ",
    "status.idle": "Idle",
    "status.queued": "Queued",
    "status.running": "Running",
    "status.success": "Done",
    "status.error": "Error",
    "log.waiting": "Waiting for task...",
    "modal.title": "Notice",
    "modal.close": "Close",
    "toast.copyOk": "Copied",
    "toast.copyFail": "Copy failed",
    "toast.preview": "Preview mode is active",
    "update.title": "New Version Available",
    "update.current": "Current:",
    "update.latest": "Latest:",
    "update.notes": "Release notes:",
    "update.btn": "Open Update",
    "update.checking": "Checking for updates...",
    "update.latestMsg": "You are already on the latest version",
    "update.fail": "Failed to check for updates",
    "toolbar.theme": "Toggle theme",
    "toolbar.language": "Switch language",
    "toolbar.update": "Check for updates"
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
  runninghubApiKeyInput: document.getElementById("runninghubApiKeyInput"),
  aspectRatioSelect: document.getElementById("aspectRatioSelect"),
  customAspectRatioInput: document.getElementById("customAspectRatioInput"),
  aspectRatioCustomRow: document.getElementById("aspectRatioCustomRow"),
  aspectRatioBackBtn: document.getElementById("aspectRatioBackBtn"),
  runninghubImageUrlInput: document.getElementById("runninghubImageUrlInput"),
  runninghubQueryUrlInput: document.getElementById("runninghubQueryUrlInput"),
  extraReferenceInput: document.getElementById("extraReferenceInput"),
  extraReferenceList: document.getElementById("extraReferenceList"),
  extraReferenceSummary: document.getElementById("extraReferenceSummary"),
  runninghubExampleFileInput: document.getElementById("runninghubExampleFileInput"),
  runninghubExampleTextInput: document.getElementById("runninghubExampleTextInput"),
  runninghubParseBtn: document.getElementById("runninghubParseBtn"),
  workflowImageNodeIdInput: document.getElementById("workflowImageNodeIdInput"),
  workflowImageFieldNameInput: document.getElementById("workflowImageFieldNameInput"),
  workflowExtraImageNodesInput: document.getElementById("workflowExtraImageNodesInput"),
  workflowPromptNodeIdInput: document.getElementById("workflowPromptNodeIdInput"),
  workflowPromptFieldNameInput: document.getElementById("workflowPromptFieldNameInput"),
  workflowAspectNodeIdInput: document.getElementById("workflowAspectNodeIdInput"),
  workflowAspectFieldNameInput: document.getElementById("workflowAspectFieldNameInput"),
  workflowAspectFieldDataInput: document.getElementById("workflowAspectFieldDataInput"),
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

let pollingHandle = null;
let currentTheme = "dark";
let currentLang = "zh";
let aiProviderConfig = null;

const DEFAULT_AI_CLEAN_PROMPT = `# Role
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
4. 某个维度不适用时，返回空数组 []。

# Example
Input: [一张带露珠的红玫瑰特写]
Output:
{
  "main_subject": ["红玫瑰", "花朵"],
  "appearance": ["鲜红色", "丝绒质感", "水珠", "花瓣层叠"],
  "action_state": ["静止", "盛开"],
  "environment": ["模糊绿叶", "自然光", "花园"],
  "visual_style": ["微距摄影", "高饱和", "清新", "唯美"]
}`;

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
const extraReferenceState = {
  files: [],
};

const aiCleaningState = {
  baseItems: [],
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
};

const AI_CLEAN_DIMENSIONS = [
  { key: "main_subject", labelKey: "ai.cleanDimension.main_subject" },
  { key: "appearance", labelKey: "ai.cleanDimension.appearance" },
  { key: "action_state", labelKey: "ai.cleanDimension.action_state" },
  { key: "environment", labelKey: "ai.cleanDimension.environment" },
  { key: "visual_style", labelKey: "ai.cleanDimension.visual_style" },
];

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

function formatText(key, replacements = {}, lang = currentLang) {
  return Object.entries(replacements).reduce((text, [name, value]) => {
    return text.replaceAll(`{{${name}}}`, String(value));
  }, getText(key, lang));
}

function getLocalizedLabelFromConfig(item) {
  if (!item) return "";
  if (currentLang === "en") {
    return item.label_en || item.label || item.id || item.model || "";
  }
  return item.label_zh || item.label || item.id || item.model || "";
}

function updateStepText() {
  if (dom.progressText) {
    dom.progressText.textContent = formatText("step.progress", {
      current: currentStepIndex + 1,
      total: STEPS.length,
    });
  }
  document.querySelectorAll(".page-badge").forEach((badge, index) => {
    badge.textContent = formatText("step.pageBadge", {
      current: index + 1,
      total: STEPS.length,
    });
  });
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el === dom.imageGrid || el === dom.aiGrid || el === dom.aiCleanGrid) {
      return;
    }
    el.textContent = getText(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", getText(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = getText(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", getText(el.dataset.i18nTitle));
  });

  if (aiProviderConfig && dom.aiProviderSelect && dom.aiModelPresetSelect) {
    const prevProvider = dom.aiProviderSelect.value;
    const prevModel = dom.aiModelPresetSelect.value;
    populateAiProviderOptions(prevProvider);
    syncModelPresetWithProvider();
    if (prevProvider && dom.aiProviderSelect.value !== prevProvider) {
      dom.aiProviderSelect.value = prevProvider;
    }
    if (prevModel && dom.aiModelPresetSelect.value !== prevModel) {
      dom.aiModelPresetSelect.value = prevModel;
      handleAiModelPresetVisibility();
    }
  }

  const linuxStateValue = document.getElementById("linuxStateValue");
  if (linuxStateValue) {
    const mode = linuxStateValue.dataset.mode === "preview" ? "preview" : "exec";
    linuxStateValue.textContent =
      currentLang === "en"
        ? linuxStateValue.dataset[mode === "preview" ? "previewEn" : "execEn"]
        : linuxStateValue.dataset[mode === "preview" ? "previewZh" : "execZh"];
  }

  updateStepText();
  updateSelectionHint();
  updateAiSelectionHint();
  updateAiCleanSelectionHint();
  renderExtraReferenceList();
  updateUploadProgressHint();
  updateSwitchState(dom.autodlSwitch, featureStates.autodlAccelerator);
  updateSwitchState(dom.githubSwitch, featureStates.githubAccelerator);
  if (Array.isArray(aiGalleryState.items) && aiGalleryState.items.length) {
    renderAiGallery(aiGalleryState.items);
  }
  if (Array.isArray(aiCleaningState.baseItems) && aiCleaningState.baseItems.length) {
    renderAiCleanFilters();
    renderAiCleanGallery();
  }
  renderModelCards();
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
  document.body.dataset.lang = currentLang;
  try {
    localStorage.setItem(storageKeys.lang, currentLang);
  } catch {}
  applyTranslations();
  fetchStatus();
}

function toggleLanguage() {
  applyLanguage(currentLang === "zh" ? "en" : "zh");
}

async function loadAiProviderConfig() {
  if (!dom.aiProviderSelect || !dom.aiModelPresetSelect) return;
  try {
    const res = await fetch("/static/ai_providers.json?_=" + Date.now());
    aiProviderConfig = await res.json();
    populateAiProviderOptions();
    syncModelPresetWithProvider();
    bindAiModelPresetChange();
  } catch (err) {
    console.error("load ai provider config failed", err);
  }
}

function populateAiProviderOptions(selectedId) {
  if (!aiProviderConfig || !dom.aiProviderSelect) return;
  const select = dom.aiProviderSelect;
  const providers = aiProviderConfig.providers || [];
  const current = selectedId || select.value;
  select.innerHTML = "";
  providers.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = getLocalizedLabelFromConfig(p);
    select.appendChild(opt);
  });
  if (current) {
    select.value = current;
  }
}

function updateAspectRatioInputState() {
  if (!dom.aspectRatioSelect) return;
  const isCustom = dom.aspectRatioSelect.value === "custom";
  dom.aspectRatioSelect.classList.toggle("hidden", isCustom);
  if (dom.aspectRatioCustomRow) {
    dom.aspectRatioCustomRow.classList.toggle("hidden", !isCustom);
  }
  if (isCustom && dom.customAspectRatioInput) {
    dom.customAspectRatioInput.focus();
  }
}

function resolveAspectRatioValue() {
  if (!dom.aspectRatioSelect) return "auto";
  if (dom.aspectRatioSelect.value !== "custom") {
    return dom.aspectRatioSelect.value || "auto";
  }
  return dom.customAspectRatioInput?.value.trim() || "";
}

function setAspectRatioValue(value) {
  const resolved = (value || "").trim();
  if (!dom.aspectRatioSelect) return;
  if (!resolved) {
    dom.aspectRatioSelect.value = "auto";
    if (dom.customAspectRatioInput) {
      dom.customAspectRatioInput.value = "";
    }
    updateAspectRatioInputState();
    return;
  }

  const hasOption = Array.from(dom.aspectRatioSelect.options).some((opt) => opt.value === resolved);
  if (hasOption) {
    dom.aspectRatioSelect.value = resolved;
    if (dom.customAspectRatioInput) {
      dom.customAspectRatioInput.value = "";
    }
  } else {
    dom.aspectRatioSelect.value = "custom";
    if (dom.customAspectRatioInput) {
      dom.customAspectRatioInput.value = resolved;
    }
  }
  updateAspectRatioInputState();
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function readDataUrlFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function renderExtraReferenceList() {
  if (!dom.extraReferenceList) return;
  if (dom.extraReferenceSummary) {
    dom.extraReferenceSummary.textContent = extraReferenceState.files.length
      ? formatText("images.extraReferenceSummarySelected", { count: extraReferenceState.files.length })
      : getText("images.extraReferenceSummaryIdle");
  }
  if (!extraReferenceState.files.length) {
    dom.extraReferenceList.classList.add("hidden");
    dom.extraReferenceList.classList.remove("empty");
    dom.extraReferenceList.innerHTML = "";
    return;
  }

  dom.extraReferenceList.classList.remove("hidden");
  dom.extraReferenceList.classList.remove("empty");
  dom.extraReferenceList.innerHTML = "";
  extraReferenceState.files.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "reference-item";

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "reference-item-thumb";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.addEventListener("load", () => URL.revokeObjectURL(img.src));
    const badge = document.createElement("span");
    badge.className = "reference-item-badge";
    badge.textContent = `${index + 2}`;
    thumbWrap.appendChild(img);
    thumbWrap.appendChild(badge);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-reference-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      extraReferenceState.files.splice(index, 1);
      renderExtraReferenceList();
    });
    thumbWrap.appendChild(removeBtn);

    const label = document.createElement("span");
    label.className = "reference-item-label";
    label.textContent = file.name;

    item.appendChild(thumbWrap);
    item.appendChild(label);
    dom.extraReferenceList.appendChild(item);
  });
}

function parseExtraImageNodesText() {
  const raw = dom.workflowExtraImageNodesInput?.value || "";
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const nodes = [];
  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === line.length - 1) {
      throw new Error(getText("images.workflowExtraImageNodesInvalid"));
    }
    const nodeId = line.slice(0, separatorIndex).trim();
    const fieldName = line.slice(separatorIndex + 1).trim();
    if (!nodeId || !fieldName) {
      throw new Error(getText("images.workflowExtraImageNodesInvalid"));
    }
    nodes.push({ node_id: nodeId, field_name: fieldName });
  }
  return nodes;
}

function buildImageNodeConfig() {
  const imageNodes = [];
  const primaryNodeId = dom.workflowImageNodeIdInput?.value.trim() || "";
  const primaryFieldName = dom.workflowImageFieldNameInput?.value.trim() || "";
  if (primaryNodeId || primaryFieldName) {
    imageNodes.push({ node_id: primaryNodeId, field_name: primaryFieldName });
  }
  imageNodes.push(...parseExtraImageNodesText());
  return imageNodes;
}

function fillImageNodeConfig(imageNodes = []) {
  const normalized = Array.isArray(imageNodes) ? imageNodes.filter(Boolean) : [];
  const [primaryNode, ...extraNodes] = normalized;

  if (dom.workflowImageNodeIdInput) {
    dom.workflowImageNodeIdInput.value = primaryNode?.node_id || "";
  }
  if (dom.workflowImageFieldNameInput) {
    dom.workflowImageFieldNameInput.value = primaryNode?.field_name || "";
  }
  if (dom.workflowExtraImageNodesInput) {
    dom.workflowExtraImageNodesInput.value = extraNodes
      .map((node) => `${node.node_id}:${node.field_name}`)
      .join("\n");
  }
}

function applyParsedRunningHubExample(data = {}) {
  if (dom.runninghubImageUrlInput && data.image_api_url) {
    dom.runninghubImageUrlInput.value = data.image_api_url;
  }
  if (dom.runninghubQueryUrlInput && data.query_url) {
    dom.runninghubQueryUrlInput.value = data.query_url;
  }
  if (dom.promptInput && data.prompt) {
    dom.promptInput.value = data.prompt;
  }
  if (data.aspect_ratio) {
    setAspectRatioValue(data.aspect_ratio);
  }

  const workflowConfig = data.workflow_config || {};
  fillImageNodeConfig(workflowConfig.image_nodes || []);
  if (dom.workflowPromptNodeIdInput) {
    dom.workflowPromptNodeIdInput.value = workflowConfig.prompt_node_id || "";
  }
  if (dom.workflowPromptFieldNameInput) {
    dom.workflowPromptFieldNameInput.value = workflowConfig.prompt_field_name || "";
  }
  if (dom.workflowAspectNodeIdInput) {
    dom.workflowAspectNodeIdInput.value = workflowConfig.aspect_ratio_node_id || "";
  }
  if (dom.workflowAspectFieldNameInput) {
    dom.workflowAspectFieldNameInput.value = workflowConfig.aspect_ratio_field_name || "";
  }
  if (dom.workflowAspectFieldDataInput) {
    dom.workflowAspectFieldDataInput.value = workflowConfig.aspect_ratio_field_data || "";
  }
}

async function handleRunningHubExampleParse() {
  if (!dom.runninghubParseBtn) return;
  dom.runninghubParseBtn.disabled = true;

  try {
    let exampleText = dom.runninghubExampleTextInput?.value.trim() || "";
    if (!exampleText && dom.runninghubExampleFileInput?.files?.length) {
      exampleText = (await readTextFile(dom.runninghubExampleFileInput.files[0])).trim();
      if (dom.runninghubExampleTextInput) {
        dom.runninghubExampleTextInput.value = exampleText;
      }
    }

    if (!exampleText) {
      throw new Error(getText("images.exampleParseRequired"));
    }

    const res = await postJSON("/api/runninghub/parse_example", { example_text: exampleText });
    applyParsedRunningHubExample(res.data || {});
    showToast(res.message || getText("images.exampleParseSuccess"));
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("images.exampleParseRequired"));
  } finally {
    dom.runninghubParseBtn.disabled = false;
  }
}

function initializeGenerationDefaults() {
  const config = window.__APP_CONFIG__ || {};
  if (dom.runninghubImageUrlInput && !dom.runninghubImageUrlInput.value) {
    dom.runninghubImageUrlInput.value = config.runninghubImageEditUrl || "";
  }
  if (dom.runninghubQueryUrlInput && !dom.runninghubQueryUrlInput.value) {
    dom.runninghubQueryUrlInput.value = config.runninghubQueryUrl || "";
  }
  if (dom.workflowImageNodeIdInput && !dom.workflowImageNodeIdInput.value && !dom.workflowExtraImageNodesInput?.value) {
    fillImageNodeConfig([
      {
        node_id: config.runninghubWorkflowImageNodeId || "",
        field_name: config.runninghubWorkflowImageFieldName || "",
      },
    ]);
  }
  if (dom.workflowPromptNodeIdInput && !dom.workflowPromptNodeIdInput.value) {
    dom.workflowPromptNodeIdInput.value = config.runninghubWorkflowPromptNodeId || "";
  }
  if (dom.workflowPromptFieldNameInput && !dom.workflowPromptFieldNameInput.value) {
    dom.workflowPromptFieldNameInput.value = config.runninghubWorkflowPromptFieldName || "";
  }
  if (dom.workflowAspectNodeIdInput && !dom.workflowAspectNodeIdInput.value) {
    dom.workflowAspectNodeIdInput.value = config.runninghubWorkflowAspectNodeId || "";
  }
  if (dom.workflowAspectFieldNameInput && !dom.workflowAspectFieldNameInput.value) {
    dom.workflowAspectFieldNameInput.value = config.runninghubWorkflowAspectFieldName || "";
  }
  if (dom.workflowAspectFieldDataInput && !dom.workflowAspectFieldDataInput.value) {
    dom.workflowAspectFieldDataInput.value = config.runninghubWorkflowAspectFieldData || "";
  }
  if (config.runninghubDefaultAspectRatio) {
    setAspectRatioValue(config.runninghubDefaultAspectRatio);
  } else {
    updateAspectRatioInputState();
  }
}

function bindAiModelPresetChange() {
  if (!dom.aiModelPresetSelect) return;
  dom.aiModelPresetSelect.onchange = () => {
    handleAiModelPresetVisibility();
  };
}

function goToStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= STEPS.length) return;

  currentStepIndex = stepIndex;
  const stepName = STEPS[stepIndex];

  document.querySelectorAll(".wizard-page").forEach((page, idx) => {
    page.classList.toggle("active", idx === stepIndex);
  });

  document.querySelectorAll(".step-nav-item").forEach((item, idx) => {
    item.classList.toggle("active", idx === stepIndex);
    if (idx < stepIndex) {
      item.classList.add("completed");
    }
  });

  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  if (dom.progressFill) {
    dom.progressFill.style.width = `${progress}%`;
  }
  updateStepText();

  if (stepName === "ai") {
    loadAiGallery(aiGalleryState.filterKeyword);
  }
  if (stepName === "ai-clean") {
    if (!aiCleaningState.baseItems || !aiCleaningState.baseItems.length) {
      loadGallery(galleryState.filterKeyword || "");
    } else {
      renderAiCleanFilters();
      renderAiCleanGallery();
      updateAiCleanSelectionHint();
    }
  }
}

function initNavigation() {
  document.querySelectorAll(".step-nav-item").forEach((btn, idx) => {
    btn.addEventListener("click", () => goToStep(idx));
  });

  document.querySelectorAll(".btn-prev").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(currentStepIndex - 1));
  });

  document.querySelectorAll(".btn-next").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextStep = currentStepIndex + 1;
      if (nextStep >= STEPS.length) {
        goToStep(0);
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
    applySectionState("ai_clean", data.ai_clean);
    
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

function updateGamifiedProgress(pageId, percent, isActive) {
  const container = document.getElementById(`gamifiedProgress_${pageId}`);
  const track = document.getElementById(`gamifiedTrack_${pageId}`);
  const thumb = document.getElementById(`gamifiedThumb_${pageId}`);

  if (!container || !track || !thumb) return;

  if (!isActive) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");
  const clamped = Math.min(100, Math.max(0, percent));
  track.style.width = `${clamped}%`;
  thumb.style.left = `${clamped}%`;
}

function applySectionState(section, data) {
  if (!data) return;
  const prefixMap = {
    setup: "setup",
    download: "download",
    generation: "generation",
    ai_clean: "aiClean",
  };
  const prefix = prefixMap[section];
  if (!prefix) return;

  // Gamified Progress Logic
  let pageId = null;
  if (section === "setup") pageId = "setup";
  if (section === "download") pageId = "download";
  if (section === "generation") pageId = "ai";
  if (section === "ai_clean") pageId = "ai-clean";

  if (pageId) {
      const isActive = data.status === "running";
      const percent = typeof data.progress === "number" ? data.progress : 0;
      updateGamifiedProgress(pageId, percent, isActive);
  }
  
  const progressEl = dom[`${prefix}Progress`];
  const statusEl = dom[`${prefix}Status`];
  const percentEl = dom[`${prefix}Percent`];
  const messageEl = dom[`${prefix}Message`];
  const logEl = dom[`${prefix}Log`];

  if (progressEl) {
    const progress = typeof data.progress === "number" ? data.progress : 0;
    progressEl.style.width = `${progress}%`;
    progressEl.style.transition = "width 0.4s ease";
  }
  
  if (percentEl) {
    const percent = typeof data.progress === "number" ? data.progress : 0;
    percentEl.textContent = `${percent}%`;
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
      if (dom.modalClose) dom.modalClose.classList.add('hidden');
    } else {
      dom.modalActions.classList.add("hidden");
      if (dom.modalClose && !options.force) dom.modalClose.classList.remove('hidden');
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
    if (label) label.textContent = getText("environment.acceleratorOn");
  } else {
    btn.classList.remove("active");
    btn.dataset.state = "off";
    if (label) label.textContent = getText("environment.acceleratorOff");
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
    refreshAiCleanBaseFromGallery();
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
    // Use thumbnail for preview, add modified timestamp to bust cache
    const thumbUrl = `/api/thumbnail/source/${image.relative_path}?t=${image.modified}`;
    
    card.innerHTML = `
      <img src="${thumbUrl}" alt="${image.name}" loading="lazy">
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
      updateAiCleanSelectionHint();
    });
    dom.imageGrid.appendChild(card);
  });
  updateSelectionHint();
  updateAiCleanSelectionHint();
}

function refreshAiCleanBaseFromGallery() {
  aiCleaningState.baseItems = Array.isArray(galleryState.items) ? galleryState.items.slice() : [];
  renderAiCleanGallery();
}

function computeAiCleanDimensionTags() {
  const dimensionTags = {
    main_subject: new Set(),
    appearance: new Set(),
    action_state: new Set(),
    environment: new Set(),
    visual_style: new Set(),
  };

  aiCleaningState.itemsByPath.forEach((payload) => {
    const tags = payload?.tags || {};
    AI_CLEAN_DIMENSIONS.forEach(({ key }) => {
      const values = Array.isArray(tags[key]) ? tags[key] : [];
      values.forEach((value) => {
        if (value) dimensionTags[key].add(String(value));
      });
    });
  });

  aiCleaningState.dimensionTags = dimensionTags;
}

function renderAiCleanFilters() {
  if (!dom.aiCleanFilters) return;
  dom.aiCleanFilters.innerHTML = "";

  if (!aiCleaningState.itemsByPath || aiCleaningState.itemsByPath.size === 0) {
    const p = document.createElement("p");
    p.className = "tool-hint";
    p.textContent = getText("ai.cleanNoTags");
    dom.aiCleanFilters.appendChild(p);
    return;
  }

  AI_CLEAN_DIMENSIONS.forEach(({ key, labelKey }) => {
    const values = Array.from(aiCleaningState.dimensionTags[key] || []);
    if (!values.length) return;

    const section = document.createElement("div");
    section.className = "clean-filter-section";

    const title = document.createElement("div");
    title.className = "clean-filter-title";
    title.textContent = getText(labelKey);

    const wrapper = document.createElement("div");
    wrapper.className = "clean-filter-tags";

    values.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "clean-tag-chip";
      const selectedSet = aiCleaningState.selectedTags[key] || new Set();
      const isActive = selectedSet.has(tag);
      if (isActive) chip.classList.add("active");
      chip.textContent = tag;
      chip.addEventListener("click", () => {
        const set = aiCleaningState.selectedTags[key] || new Set();
        if (set.has(tag)) {
          set.delete(tag);
        } else {
          set.add(tag);
        }
        aiCleaningState.selectedTags[key] = set;
        renderAiCleanFilters();
        renderAiCleanGallery();
      });
      wrapper.appendChild(chip);
    });

    section.append(title, wrapper);
    dom.aiCleanFilters.appendChild(section);
  });
}

function renderAiCleanGallery() {
  if (!dom.aiCleanGrid) return;

  const sourceItems = Array.isArray(aiCleaningState.baseItems)
    ? aiCleaningState.baseItems
    : [];

  if (!sourceItems.length) {
    dom.aiCleanGrid.textContent = getText("images.galleryEmpty");
    return;
  }

  const hasAnyFilter = Object.values(aiCleaningState.selectedTags).some(
    (set) => set && set.size > 0,
  );

  const filtered = sourceItems.filter((image) => {
    if (!aiCleaningState.itemsByPath || aiCleaningState.itemsByPath.size === 0) {
      return true;
    }

    const payload = aiCleaningState.itemsByPath.get(image.relative_path);
    if (!payload || !payload.tags) return !hasAnyFilter;

    const tags = payload.tags;

    return AI_CLEAN_DIMENSIONS.every(({ key }) => {
      const selected = aiCleaningState.selectedTags[key];
      if (!selected || selected.size === 0) return true;
      const values = Array.isArray(tags[key]) ? tags[key] : [];
      return values.some((v) => selected.has(String(v)));
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

    const thumbUrl = `/api/thumbnail/source/${image.relative_path}?t=${image.modified}`;

    card.innerHTML = `
      <img src="${thumbUrl}" alt="${image.name}" loading="lazy">
      <div class="image-meta">
        <strong>${image.name}</strong>
        <span>${formatBytes(image.size)}</span>
      </div>
    `;

    if (aiCleaningState.processing.has(image.relative_path)) {
      const overlay = document.createElement("div");
      overlay.className = "ai-loading-overlay";
      overlay.innerHTML = '<div class="spinner-md"></div>';
      card.appendChild(overlay);
    }

    dom.aiCleanGrid.appendChild(card);
  });
}

function applyCleaningResults(items) {
  if (!Array.isArray(items)) return;
  if (!aiCleaningState.itemsByPath) {
    aiCleaningState.itemsByPath = new Map();
  }

  items.forEach((item) => {
    if (!item || !item.relative_path) return;
    aiCleaningState.itemsByPath.set(item.relative_path, {
      tags: item.tags || {},
    });
  });

  computeAiCleanDimensionTags();
  renderAiCleanFilters();
  renderAiCleanGallery();
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

    const sourceUrl = `/api/thumbnail/source/${srcPath}?t=${pair.source.modified}`;
    const fullSourceUrl = `${pair.source.url}?t=${pair.source.modified}`;
    
    let generatedUrl = null;
    let fullGeneratedUrl = null;
    
    if (pair.generated.length > 0) {
        const genItem = pair.generated[0];
        generatedUrl = `/api/thumbnail/generated/${genItem.relative_path}?t=${genItem.modified}`;
        fullGeneratedUrl = `${genItem.url}?t=${genItem.modified}`;
    }
    
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
      generatedHtml = `<img src="${generatedUrl}" data-full="${fullGeneratedUrl}" class="ai-img-gen" alt="Generated" loading="lazy">`;
    } else {
      generatedHtml = `
        <div class="ai-img-placeholder">
            <button type="button" class="btn-upload-gen" title="${getText("images.manualUploadTitle")}">
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
          <img src="${sourceUrl}" data-full="${fullSourceUrl}" class="ai-img-src" alt="Source" loading="lazy">
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
                    
                    showToast(getText("images.manualUploadSuccess"));
                    loadAiGallery(aiGalleryState.filterKeyword);
                } catch (err) {
                    showToast(err.message || getText("images.manualUploadFailed"));
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
            const full = img.dataset.full || img.src;
            window.open(full, "_blank");
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

function updateAiCleanSelectionHint() {
  if (!dom.aiCleanSelectionHint) return;
  if (galleryState.selected.size > 0) {
    dom.aiCleanSelectionHint.textContent = getText("images.selectionSelected").replace(
      "{{count}}",
      galleryState.selected.size
    );
  } else {
    dom.aiCleanSelectionHint.textContent = getText("ai.cleanSelectionHint");
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

async function handleUploadSubmit(event, droppedFiles = null) {
  event?.preventDefault?.();
  const files = droppedFiles ? Array.from(droppedFiles) : Array.from(dom.imageInput?.files || []);
  if (!files.length) {
    showToast(getText("images.uploadEmpty"));
    return;
  }
  if (isUploading) {
    showToast(getText("images.uploadBusy"));
    return;
  }
  isUploading = true;
  updateGamifiedProgress("images", 0, true);
  const trackers = initUploadProgress(files);
  const stats = { added: 0, skipped: 0, failed: 0 };
  try {
    for (let idx = 0; idx < files.length; idx += 1) {
      // Update gamified progress based on count
      const percent = Math.round((idx / files.length) * 100);
      updateGamifiedProgress("images", percent, true);

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
    updateGamifiedProgress("images", 100, true);
  } catch (err) {
    console.error("upload pipeline error", err);
    showModal(getText("modal.title"), err.message || getText("images.uploadProgressFailed"));
  } finally {
    finalizeUploadProgress();
    isUploading = false;
    setTimeout(() => {
        updateGamifiedProgress("images", 0, false);
    }, 2000);
  }
}

async function handleClearAllClick() {
  const confirmActions = [
    {
      label: getText("images.clearAll"),
      variant: "primary",
      handler: async () => {
        if (dom.clearAllBtn) dom.clearAllBtn.disabled = true;
        hideModal();
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
      },
    },
    {
      label: getText("step.prev"),
      variant: "secondary",
      handler: () => hideModal(),
    },
  ];

  showModal(getText("modal.title"), getText("images.clearConfirm"), confirmActions);
}

async function handleDeleteSelectedClick() {
  if (galleryState.selected.size === 0) {
    showToast(getText("images.deleteEmpty"));
    return;
  }

  const confirmActions = [
    {
      label: getText("images.deleteSelected"),
      variant: "primary",
      handler: async () => {
        if (dom.deleteSelectedBtn) dom.deleteSelectedBtn.disabled = true;
        hideModal();
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
      },
    },
    {
      label: getText("step.prev"),
      variant: "secondary",
      handler: () => hideModal(),
    },
  ];

  showModal(getText("modal.title"), getText("images.deleteConfirm"), confirmActions);
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

function getAiPlatformConfig() {
  const provider = dom.aiProviderSelect?.value || aiProviderConfig?.providers?.[0]?.id || "openai";
  let model = "";

  if (dom.aiModelPresetSelect) {
    if (dom.aiModelPresetSelect.tagName === "INPUT") {
      model = dom.aiModelPresetSelect.value.trim();
    } else {
      const selectedValue = dom.aiModelPresetSelect.value;
      if (selectedValue && selectedValue !== "custom") {
        model = selectedValue;
      }
    }
  }

  const apiKey = dom.aiApiKeyInput?.value.trim() || "";
  const baseUrl = dom.aiBaseUrlInput?.value.trim() || "";
  return { provider, model, apiKey, baseUrl };
}

function validateAiPlatformConfig(config) {
  if (!config.model) {
    return getText("ai.platformErrorModelMissing");
  }
  if (!config.apiKey) {
    return getText("ai.platformErrorApiKeyMissing");
  }
  if (config.provider === "custom" && !config.baseUrl) {
    return getText("ai.platformErrorBaseUrlMissing");
  }
  return null;
}

function syncModelPresetWithProvider() {
  if (!dom.aiProviderSelect || !dom.aiModelPresetSelect || !aiProviderConfig) return;
  const providerId = dom.aiProviderSelect.value;
  const providers = aiProviderConfig.providers || [];
  const providerCfg = providers.find((p) => p.id === providerId) || providers[0];
  const select = dom.aiModelPresetSelect;
  const prevModel = select.value;
  select.innerHTML = "";

  if (providerCfg && Array.isArray(providerCfg.models)) {
    providerCfg.models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.model;
      opt.textContent = getLocalizedLabelFromConfig(m);
      select.appendChild(opt);
    });
  }

  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  customOpt.textContent = getText("ai.platformCustomModel");
  select.appendChild(customOpt);

  if (prevModel && Array.from(select.options).some(opt => opt.value === prevModel)) {
    select.value = prevModel;
  } else if (providerCfg && providerCfg.default_model) {
    select.value = providerCfg.default_model;
  }

  handleAiModelPresetVisibility();
  bindAiModelPresetChange();
}

function handleAiModelPresetVisibility() {
  if (!dom.aiModelPresetSelect) return;
  const isCustom = dom.aiModelPresetSelect.value === "custom";

  if (isCustom) {
    const input = document.createElement("input");
    input.id = "aiModelPresetSelect";
    input.type = "text";
    input.placeholder = getText("ai.platformCustomModelPlaceholder");
    input.className = dom.aiModelPresetSelect.className;

    const prevValue = dom.aiModelPresetSelect.dataset.customValue || "";
    input.value = prevValue;

    input.addEventListener("input", (e) => {
      input.dataset.customValue = e.target.value;
    });

    dom.aiModelPresetSelect.parentNode.replaceChild(input, dom.aiModelPresetSelect);
    dom.aiModelPresetSelect = input;
    bindAiModelPresetChange();
  } else {
    if (dom.aiModelPresetSelect.tagName === "INPUT") {
      const select = document.createElement("select");
      select.id = "aiModelPresetSelect";
      select.className = dom.aiModelPresetSelect.className;

      const customValue = dom.aiModelPresetSelect.value;
      select.dataset.customValue = customValue;

      dom.aiModelPresetSelect.parentNode.replaceChild(select, dom.aiModelPresetSelect);
      dom.aiModelPresetSelect = select;

      syncModelPresetWithProvider();
      bindAiModelPresetChange();
    }
  }
}

async function handleAiConfigTestClick() {
  if (!dom.aiTestConfigBtn) return;
  const config = getAiPlatformConfig();
  const errorMsg = validateAiPlatformConfig(config);
  if (errorMsg) {
    showModal(getText("modal.title"), errorMsg);
    return;
  }
  dom.aiTestConfigBtn.disabled = true;
  try {
    const res = await postJSON("/api/ai/config/test", {
      provider: config.provider,
      model: config.model,
      api_key: config.apiKey,
      base_url: config.baseUrl,
    });
    showModal(getText("modal.title"), res.message || getText("ai.platformTestOk"));
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("ai.platformTestFail"));
  } finally {
    dom.aiTestConfigBtn.disabled = false;
  }
}

async function handleAiCleanSubmit(event) {
  event.preventDefault();
  if (!dom.aiCleanRunBtn) return;
  const config = getAiPlatformConfig();
  const errorMsg = validateAiPlatformConfig(config);
  if (errorMsg) {
    showModal(getText("modal.title"), errorMsg);
    return;
  }

  const targets = Array.from(galleryState.selected);
  const promptValue = dom.aiCleanPromptInput?.value.trim() || DEFAULT_AI_CLEAN_PROMPT;
  const payload = {
    prompt: promptValue,
    provider: config.provider,
    model: config.model,
    api_key: config.apiKey,
    base_url: config.baseUrl,
    targets,
  };

  dom.aiCleanRunBtn.disabled = true;

  const baseItems = Array.isArray(aiCleaningState.baseItems) && aiCleaningState.baseItems.length
    ? aiCleaningState.baseItems
    : Array.isArray(galleryState.items)
    ? galleryState.items
    : [];
  aiCleaningState.processing = new Set(
    payload.targets.length ? payload.targets : baseItems.map((i) => i.relative_path),
  );
  renderAiCleanGallery();

  try {
    const res = await postJSON("/api/ai/clean", payload);
    applyCleaningResults(res.items || []);
    showModal(getText("modal.title"), res.message || getText("ai.cleanResultTitle"));
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("ai.platformTestFail"));
  } finally {
    dom.aiCleanRunBtn.disabled = false;
    aiCleaningState.processing = new Set();
    renderAiCleanGallery();
  }
}

async function handleGenerateSubmit(event) {
  event.preventDefault();
  if (dom.generateBtn) dom.generateBtn.disabled = true;
  const resolvedAspectRatio = resolveAspectRatioValue();
  let imageNodes = [];
  try {
    imageNodes = buildImageNodeConfig();
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("images.workflowExtraImageNodesInvalid"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  const workflowConfig = {
    image_nodes: imageNodes,
    image_node_id: imageNodes[0]?.node_id || "",
    image_field_name: imageNodes[0]?.field_name || "",
    prompt_node_id: dom.workflowPromptNodeIdInput?.value.trim() || "",
    prompt_field_name: dom.workflowPromptFieldNameInput?.value.trim() || "",
    aspect_ratio_node_id: dom.workflowAspectNodeIdInput?.value.trim() || "",
    aspect_ratio_field_name: dom.workflowAspectFieldNameInput?.value.trim() || "",
    aspect_ratio_field_data: dom.workflowAspectFieldDataInput?.value.trim() || "",
  };
  const payload = {
    prompt: dom.promptInput?.value.trim() || "",
    overwrite: dom.overwriteToggle?.checked ?? false,
    targets: Array.from(aiGalleryState.selected),
    api_key: dom.runninghubApiKeyInput?.value.trim() || "",
    aspect_ratio: resolvedAspectRatio,
    image_api_url: dom.runninghubImageUrlInput?.value.trim() || "",
    query_url: dom.runninghubQueryUrlInput?.value.trim() || "",
    workflow_config: workflowConfig,
  };
  if (!payload.api_key) {
    showModal(getText("modal.title"), getText("images.configRequired"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (!payload.image_api_url) {
    showModal(getText("modal.title"), getText("images.requestUrlRequired"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (!payload.query_url) {
    showModal(getText("modal.title"), getText("images.queryUrlRequired"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (!payload.aspect_ratio) {
    showModal(getText("modal.title"), getText("images.customAspectRatioRequired"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (!workflowConfig.image_node_id || !workflowConfig.image_field_name) {
    showModal(getText("modal.title"), getText("images.workflowImageConfigRequired"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (Boolean(workflowConfig.prompt_node_id) !== Boolean(workflowConfig.prompt_field_name)) {
    showModal(getText("modal.title"), getText("images.workflowPromptConfigInvalid"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (Boolean(workflowConfig.aspect_ratio_node_id) !== Boolean(workflowConfig.aspect_ratio_field_name)) {
    showModal(getText("modal.title"), getText("images.workflowAspectConfigInvalid"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }
  if (extraReferenceState.files.length > Math.max(imageNodes.length - 1, 0)) {
    showModal(getText("modal.title"), getText("images.extraReferenceNodeMissing"));
    if (dom.generateBtn) dom.generateBtn.disabled = false;
    return;
  }

  try {
    if (extraReferenceState.files.length) {
      payload.extra_reference_images = await Promise.all(
        extraReferenceState.files.map(async (file) => ({
          name: file.name,
          data_url: await readDataUrlFile(file),
        })),
      );
    }
  } catch (err) {
    showModal(getText("modal.title"), err.message || getText("images.extraReferenceNodeMissing"));
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
  
  // if (!payload.targets.length) {
  //   showToast(getText("images.deleteEmpty")); // Reuse "Please select images"
  //   if (submitBtn) submitBtn.disabled = false;
  //   return;
  // }
  
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

function modelCardHTML(model, checked) {
  const desc = model.desc[currentLang] || model.desc.zh;
  return `<label class="radio-card">
    <input type="radio" name="model" value="${model.name}" ${checked ? "checked" : ""}>
    <div class="radio-content">
      <span class="radio-title">${model.name}</span>
      <span class="radio-desc">${desc}</span>
    </div>
  </label>`;
}

function renderModelCards() {
  const raw = (window.__APP_CONFIG__ || {}).modelRegistry;
  const registry = typeof raw === "string" ? JSON.parse(raw) : raw || [];
  const featured = registry.filter((m) => m.featured);
  const more = registry.filter((m) => !m.featured);

  const selected = document.querySelector('input[name="model"]:checked')?.value;

  if (dom.modelFeaturedGroup) {
    dom.modelFeaturedGroup.innerHTML = featured
      .map((m, i) => modelCardHTML(m, selected ? m.name === selected : i === 0))
      .join("");
  }

  if (dom.modelMoreGroup && dom.toggleMoreModels) {
    if (more.length > 0) {
      dom.toggleMoreModels.classList.remove("hidden");
      dom.modelMoreGroup.innerHTML = more
        .map((m) => modelCardHTML(m, m.name === selected))
        .join("");
    } else {
      dom.toggleMoreModels.classList.add("hidden");
      dom.modelMoreGroup.innerHTML = "";
    }
  }
  updateToggleMoreText();
}

function updateToggleMoreText() {
  if (!dom.toggleMoreText) return;
  const raw = (window.__APP_CONFIG__ || {}).modelRegistry;
  const registry = typeof raw === "string" ? JSON.parse(raw) : raw || [];
  const count = registry.filter((m) => !m.featured).length;
  const expanded = dom.modelMoreGroup && !dom.modelMoreGroup.classList.contains("hidden");
  dom.toggleMoreText.textContent = expanded
    ? getText("download.showLess")
    : formatText("download.showMore", { n: count });
}

function toggleMoreModels() {
  if (!dom.modelMoreGroup) return;
  dom.modelMoreGroup.classList.toggle("hidden");
  const chevron = dom.toggleMoreModels?.querySelector(".toggle-chevron");
  if (chevron) {
    chevron.classList.toggle("expanded", !dom.modelMoreGroup.classList.contains("hidden"));
  }
  updateToggleMoreText();
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

  dom.toggleMoreModels?.addEventListener("click", toggleMoreModels);

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
  bindCopy(dom.copyAiCleanLog, dom.aiCleanLog);

  dom.themeToggle?.addEventListener("click", toggleTheme);
  dom.langToggle?.addEventListener("click", toggleLanguage);
  dom.uploadForm?.addEventListener("submit", handleUploadSubmit);
  dom.imageInput?.addEventListener("change", () => {
    if (dom.imageInput?.files?.length) {
      handleUploadSubmit();
    }
  });
  
  // Drag & Drop for Upload
  const uploadZone = document.querySelector(".upload-zone");
  if (uploadZone) {
      ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
          uploadZone.addEventListener(eventName, preventDefaults, false);
      });
      
      function preventDefaults(e) {
          e.preventDefault();
          e.stopPropagation();
      }
      
      ["dragenter", "dragover"].forEach(eventName => {
          uploadZone.addEventListener(eventName, highlight, false);
      });
      
      ["dragleave", "drop"].forEach(eventName => {
          uploadZone.addEventListener(eventName, unhighlight, false);
      });
      
      function highlight(e) {
          uploadZone.classList.add("highlight");
      }
      
      function unhighlight(e) {
          uploadZone.classList.remove("highlight");
      }
      
      uploadZone.addEventListener("drop", handleDrop, false);
      
      function handleDrop(e) {
          const dt = e.dataTransfer;
          const files = dt.files;
          if (files && files.length > 0) {
              // Manually trigger upload with these files
              // We need to modify handleUploadSubmit to accept files argument
              handleUploadSubmit(null, files);
          }
      }
  }
  
  dom.refreshGalleryBtn?.addEventListener("click", () => loadGallery(galleryState.filterKeyword));
  dom.clearAllBtn?.addEventListener("click", handleClearAllClick);
  dom.deleteSelectedBtn?.addEventListener("click", handleDeleteSelectedClick);
  dom.renameForm?.addEventListener("submit", handleOrganizeSubmit);

  if (dom.aiProviderSelect) {
    dom.aiProviderSelect.addEventListener("change", () => {
      syncModelPresetWithProvider();
    });
  }
  bindAiModelPresetChange();
  if (dom.aiTestConfigBtn) {
    dom.aiTestConfigBtn.addEventListener("click", handleAiConfigTestClick);
  }
  if (dom.aiCleanForm) {
    dom.aiCleanForm.addEventListener("submit", handleAiCleanSubmit);
  }
  if (dom.aiCleanResetBtn) {
    dom.aiCleanResetBtn.addEventListener("click", () => {
      aiCleaningState.selectedTags = {
        main_subject: new Set(),
        appearance: new Set(),
        action_state: new Set(),
        environment: new Set(),
        visual_style: new Set(),
      };
      computeAiCleanDimensionTags();
      renderAiCleanFilters();
      renderAiCleanGallery();
    });
  }
  if (dom.aiCleanPromptInput && !dom.aiCleanPromptInput.value) {
    dom.aiCleanPromptInput.value = DEFAULT_AI_CLEAN_PROMPT;
  }

  dom.applyFilterBtn?.addEventListener("click", () => {
    loadGallery(dom.galleryFilter?.value.trim() || "");
  });
  dom.extraReferenceInput?.addEventListener("change", () => {
    const files = Array.from(dom.extraReferenceInput?.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length) {
      extraReferenceState.files.push(...files);
      renderExtraReferenceList();
    }
    if (dom.extraReferenceInput) {
      dom.extraReferenceInput.value = "";
    }
  });
  dom.runninghubParseBtn?.addEventListener("click", handleRunningHubExampleParse);
  dom.runninghubExampleFileInput?.addEventListener("change", async () => {
    const file = dom.runninghubExampleFileInput?.files?.[0];
    if (!file || !dom.runninghubExampleTextInput) return;
    try {
      dom.runninghubExampleTextInput.value = await readTextFile(file);
    } catch (err) {
      showModal(getText("modal.title"), err.message || getText("images.exampleParseRequired"));
    }
  });
  dom.generationForm?.addEventListener("submit", handleGenerateSubmit);
  dom.aspectRatioSelect?.addEventListener("change", updateAspectRatioInputState);
  dom.aspectRatioBackBtn?.addEventListener("click", () => {
    if (dom.aspectRatioSelect) dom.aspectRatioSelect.value = "auto";
    if (dom.customAspectRatioInput) dom.customAspectRatioInput.value = "";
    updateAspectRatioInputState();
  });
  dom.clearSelectionBtn?.addEventListener("click", clearSelection);
  dom.clearAiSelectionBtn?.addEventListener("click", clearAiSelection);
  dom.applyAiFilterBtn?.addEventListener("click", () => {
    loadAiGallery(dom.aiGalleryFilter?.value.trim() || "");
  });
  dom.tagForm?.addEventListener("submit", handleTagSubmit);

  if (dom.autodlSwitch) {
      dom.autodlSwitch.addEventListener("click", () => {
          if (featureStates.autodlAccelerator === "off") {
              if (featureStates.githubAccelerator === "on") {
                  showModal(getText("modal.title"), getText("environment.acceleratorConflict"));
                  return; 
              }
          }
          const newState = featureStates.autodlAccelerator === "on" ? "disable" : "enable";
          handleAcceleratorAction(newState);
      });
  }
  if (dom.githubSwitch) {
      dom.githubSwitch.addEventListener("click", () => {
          const newState = featureStates.githubAccelerator === "on" ? "off" : "on";
          
          if (newState === "on" && featureStates.autodlAccelerator === "on") {
              handleAcceleratorAction("disable"); 
              featureStates.githubAccelerator = "on";
              updateSwitchState(dom.githubSwitch, "on");
              showModal(getText("modal.title"), getText("environment.githubAutoDisabledAutodl"));
          } else {
              featureStates.githubAccelerator = newState;
              updateSwitchState(dom.githubSwitch, newState);
          }
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
  initializeGenerationDefaults();
  renderExtraReferenceList();
  loadAiProviderConfig();
  initNavigation();
  initActions();
  startPolling();
  updateSelectionHint();
  updateAiSelectionHint();
  updateStepText();
  loadGallery();
  goToStep(0);
  checkUpdate(true);
});

