import {dom} from "./dom.js";
import {state, STEPS} from "./state.js";

const translationHooks = new Set();

const dictionary = {
    zh: {
        "brand.eyebrow": "AI Toolkit", "brand.title": "LoRA 训练工具箱", "nav.overview": "概览", "nav.environment": "环境初始化",
        "nav.download": "模型下载", "nav.images": "图像处理", "nav.ai": "AI 处理", "nav.aiClean": "AI 图片清洗", "nav.aiTag": "AI 图片标签", "nav.console": "控制台",
        "nav.system": "系统", "nav.linux": "状态", "overview.title": "一站式部署与训练流程面板", "overview.lead": "先阅读每个阶段的说明，再按顺序执行命令。系统会自动记录日志、状态和处理进度。",
        "overview.step1": "步骤 1 · 概览", "overview.step1Desc": "了解整体流程与注意事项。", "overview.step2": "步骤 2 · 环境初始化", "overview.step2Desc": "安装依赖，准备 Python、Node.js 与工具链。",
        "overview.step3": "步骤 3 · 模型下载", "overview.step3Desc": "选择模型并切换下载来源。", "overview.step4": "步骤 4 · 图像处理", "overview.step4Desc": "上传、筛选、重命名和导出素材图片。",
        "overview.step5": "步骤 5 · AI 处理", "overview.step5Desc": "AI 批量生成、批量打标与结果导出。", "overview.step6": "步骤 6 · AI 图片清洗", "overview.step6Desc": "上传参考图后筛选最相似的素材图片，并按概率排序。",
        "overview.step7": "步骤 7 · AI 图片标签", "overview.step7Desc": "调用大模型自动生成结构化标签，便于筛选和整理。", "overview.step8": "步骤 8 · 控制台", "overview.step8Desc": "查看实时状态与日志。",
        "environment.title": "环境初始化向导", "environment.desc": "自动执行依赖安装与工具准备。Linux 会顺序安装相关组件，Windows 会调用 Easy Install 脚本。",
        "environment.button": "开始执行", "environment.startBtn": "启动训练界面", "environment.executionTitle": "执行内容", "environment.item1": "安装 huggingface_hub 与 modelscope",
        "environment.item2": "配置 Node.js 20 源并安装 nodejs", "environment.item3": "克隆或更新 ai-toolkit，安装 requirements",
        "environment.item4": "启动 ai-toolkit，Linux 默认端口 6006，Windows 默认端口 7867", "environment.alertTitle": "温馨提醒：", "environment.alertDesc": "当前界面会持续记录完整的命令日志，执行期间请勿重复点击同一操作。",
        "environment.acceleratorTitle": "Autodl 学术镜像加速", "environment.acceleratorBody": "仅适用于 AutoDL 环境，可加速 GitHub 与 HuggingFace 访问；不需要时建议关闭。",
        "environment.githubTitle": "GitHub 加速", "environment.githubBody": "第三方 GitHub 代理加速，适合访问 GitHub 较慢时使用。", "environment.acceleratorEnable": "开启加速",
        "environment.acceleratorDisable": "关闭加速", "environment.acceleratorSuccess": "加速设置已更新", "environment.acceleratorFail": "加速设置失败",
        "environment.acceleratorUnsupported": "该功能仅适用于 Linux/AutoDL 环境", "environment.acceleratorOn": "开启", "environment.acceleratorOff": "关闭",
        "environment.acceleratorConflict": "Autodl 学术镜像加速与 GitHub 加速不能同时开启，请先关闭 GitHub 加速。", "environment.githubAutoDisabledAutodl": "检测到同时启用两个加速功能，已自动关闭 Autodl 学术镜像加速。",
        "download.title": "模型选择与下载渠道", "download.desc": "按需求选择模型，并在下载来源之间切换。系统会自动创建模型目录。", "download.modelLegend": "选择模型",
        "download.sourceLegend": "下载来源", "download.button": "开始下载", "download.note": "默认目录：{{dir}}/模型名", "download.showMore": "显示更多模型 ({{n}})",
        "download.showLess": "收起", "download.sourceRecommended": "推荐", "download.sourceAltDesc": "官方社区源", "images.title": "图像处理 · 管理",
        "images.desc": "支持上传单图、文件夹或压缩包，并提供批量整理、筛选和导出能力。", "images.uploadTitle": "图片上传", "images.uploadDrop": "拖拽文件到此处，或点击选择文件",
        "images.refreshBtn": "刷新", "images.uploadAutoNote": "选择文件后会自动开始上传", "images.uploadSelectedCount": "已选择 {{count}} 张图片", "images.deleteSelected": "删除所选", "images.clearAll": "清空全部",
        "images.deleteEmpty": "请先选择需要删除的图片", "images.deleteConfirm": "确定删除所选图片？该操作无法撤销。", "images.clearConfirm": "确定清空全部图片？该操作无法撤销。",
        "images.clearSuccess": "已清空全部图片", "images.deleteSuccess": "已删除所选图片", "images.renameTitle": "批量重命名", "images.prefixPlaceholder": "前缀",
        "images.startNumberPlaceholder": "起始数字", "images.keywordPlaceholder": "关键字", "images.keywordActionNone": "仅重命名", "images.keywordActionFilter": "只作用于命中项",
        "images.keywordActionDelete": "删除命中项", "images.keywordActionKeep": "仅保留命中项", "images.renameBtn": "执行整理", "images.exportTitle": "批量导出",
        "images.exportBtn": "导出图片包", "images.generateTitle": "AI 批量生成", "images.promptPlaceholder": "描述你想生成的目标风格或修改效果...", "images.overwriteLabel": "生成后覆盖同名文件",
        "images.apiKeyPlaceholder": "输入 RunningHub API Key", "images.configRequired": "请填写 RunningHub API Key", "images.requestUrlPlaceholder": "输入 RunningHub 模型接口地址",
        "images.queryUrlPlaceholder": "输入查询接口地址", "images.aspectRatioCustom": "自定义", "images.customAspectRatioPlaceholder": "输入自定义 aspectRatio，例如 7:10",
        "images.requestUrlRequired": "请填写 RunningHub 模型接口地址", "images.queryUrlRequired": "请填写查询接口地址", "images.customAspectRatioRequired": "请选择自定义后再填写 aspectRatio",
        "images.extraReferenceLabel": "附加参考图（图2~图N）", "images.extraReferenceSelectBtn": "选择附加参考图", "images.extraReferenceSummaryIdle": "未选择文件",
        "images.extraReferenceSummarySelected": "已选择 {{count}} 个文件", "images.extraReferenceHint": "默认图像处理区的原图会作为图1；这里上传的图片会按顺序作为图2、图3、图4……",
        "images.extraReferenceItem": "图{{index}} · {{name}}", "images.extraReferenceRemove": "移除", "images.workflowExtraImageNodesPlaceholder": "额外图像节点，每行一个，格式：nodeId:fieldName",
        "images.workflowExtraImageNodesInvalid": "额外图像节点格式无效，请使用每行一个 nodeId:fieldName", "images.extraReferenceNodeMissing": "已上传额外参考图，但当前工作流没有足够的图像节点映射",
        "images.workflowImageNodeIdPlaceholder": "图片节点 ID", "images.workflowImageFieldNamePlaceholder": "图片字段名", "images.workflowPromptNodeIdPlaceholder": "提示词节点 ID",
        "images.workflowPromptFieldNamePlaceholder": "提示词字段名", "images.workflowAspectNodeIdPlaceholder": "比例节点 ID", "images.workflowAspectFieldNamePlaceholder": "比例字段名",
        "images.workflowAspectFieldDataPlaceholder": "比例 fieldData（可留空）", "images.workflowHint": "不同 RunningHub 工作流的 nodeId / fieldName 可能不同；如果日志提示 NODE_INFO_MISMATCH，请先修改这里。",
        "images.workflowImageConfigRequired": "请填写图片节点的 nodeId 和 fieldName", "images.workflowPromptConfigInvalid": "提示词节点的 nodeId 和 fieldName 需要同时填写，或同时留空",
        "images.workflowAspectConfigInvalid": "比例节点的 nodeId 和 fieldName 需要同时填写，或同时留空", "images.advancedToggle": "高级设置（自动解析 / 手动节点）", "images.autoParseToggle": "自动解析", "images.manualNodeToggle": "高级设置（模型参数）", "images.runninghubModelLabel": "RunningHub 模型", "images.runninghubModelPlaceholder": "上传示例后自动回填，或手动输入模型名", "images.runninghubModelRequired": "请填写 RunningHub 模型", "images.runninghubManualParamsHint": "这里可填写不同模型的额外请求参数，格式为 JSON 对象；自动解析也会回填到这里。", "images.runninghubExtraParamsPlaceholder": "{\"resolution\":\"2k\"}", "images.runninghubExtraParamsInvalid": "高级设置中的模型参数必须是合法的 JSON 对象",
        "images.exampleFileLabel": "上传官方 Python 示例", "images.exampleTextareaPlaceholder": "粘贴官方 Python 请求示例，点击解析后自动回填配置", "images.parseExampleBtn": "解析示例",
        "images.exampleParseRequired": "请先上传或粘贴 RunningHub 官方 Python 请求示例", "images.exampleParseSuccess": "示例解析成功，已自动回填工作流配置",
        "images.selectionHint": "未选择图片时默认处理全部", "images.selectionSelected": "已选择 {{count}} 张图片", "images.generateBtn": "开始生成", "images.clearSelection": "清空",
        "images.galleryTitle": "图像瀑布流", "images.galleryFilter": "搜索...", "images.filterBtn": "搜索", "images.galleryEmpty": "暂无图片", "images.uploadProgressTitle": "上传进度",
        "images.uploadProgressIdle": "暂无上传任务", "images.uploadProgressPreparing": "共有 {{count}} 个文件待上传", "images.uploadProgressRunning": "正在上传 {{done}} / {{total}}",
        "images.uploadProgressDone": "全部上传完成", "images.uploadProgressError": "上传结束，但部分文件失败", "images.uploadProgressWaiting": "等待上传", "images.uploadProgressSuccess": "上传完成",
        "images.uploadProgressFailed": "上传失败", "images.uploadProgressNetwork": "网络异常，请稍后重试", "images.uploadSummarySuccess": "成功 {{count}} 个", "images.uploadSummarySkip": "跳过 {{count}} 个",
        "images.uploadSummaryFail": "失败 {{count}} 个", "images.uploadBusy": "已有上传任务正在进行，请稍候", "images.consoleTitle": "AI 生成日志", "images.uploadEmpty": "请至少选择一个文件",
        "images.manualUploadTitle": "上传生成图", "images.manualUploadSuccess": "上传成功", "images.manualUploadFailed": "上传失败", "ai.title": "AI 处理", "ai.desc": "使用 AI 批量生成图像、批量打标并导出结果。",
        "ai.tagTitle": "批量打标", "ai.tagPlaceholder": "输入标签...", "ai.tagBtn": "应用标签", "ai.exportBtn": "导出 AI 数据包", "ai.galleryTitle": "AI 生成预览",
        "ai.tagSuccess": "标签已更新", "ai.tagHint": "请用简洁语言描述你希望生成图的目标风格或效果，建议优先使用英文。<br>例如：<br>- Transform into Ghibli anime style<br>- Transform into inkwash painting style<br>- Add glasses to the character",
        "ai.platformTitle": "AI 平台配置", "ai.platformProvider": "平台", "ai.platformModelPreset": "模型预设", "ai.platformCustomModel": "自定义模型",
        "ai.platformCustomModelPlaceholder": "输入自定义模型名...", "ai.platformApiKey": "API Key", "ai.platformBaseUrl": "Base URL（选填，自定义或代理时使用）", "ai.platformTestBtn": "测试连接",
        "ai.platformTestOk": "连接测试成功", "ai.platformTestFail": "连接测试失败", "ai.platformErrorModelMissing": "请先选择或输入要使用的模型名称。", "ai.platformErrorApiKeyMissing": "请填写对应平台的 API Key。",
        "ai.platformErrorBaseUrlMissing": "使用自定义平台时，请填写 Base URL。", "ai.cleanTitle": "AI 图片标签", "ai.cleanPageDesc": "调整提示词后即可调用大模型分析图片内容，生成结构化标签并支持进一步筛选。",
        "ai.cleanPromptPlaceholder": "输入提示词...", "ai.cleanPromptHint": "提示词支持自定义，适合按业务调整标签维度。", "ai.cleanSelectionHint": "未选择图片时默认处理全部", "ai.cleanRunBtn": "开始打标",
        "ai.cleanResetBtn": "重置筛选", "ai.cleanResultTitle": "AI 图片标签结果", "ai.cleanNoTags": "尚未生成标签，请先运行 AI 图片标签。", "ai.cleanDimension.main_subject": "主体",
        "ai.cleanDimension.appearance": "外观", "ai.cleanDimension.action_state": "动作状态", "ai.cleanDimension.environment": "环境物件", "ai.cleanDimension.visual_style": "视觉风格",
        "ai.imageCleanTitle": "AI 图片清洗", "ai.imageCleanDesc": "上传参考图后自动筛选最相似的素材图片，并按概率从高到低排序。", "ai.imageCleanToolTitle": "筛选相似图片",
        "ai.imageCleanReferenceLabel": "参考图", "ai.imageCleanSelectRefBtn": "选择参考图", "ai.imageCleanRefSummaryIdle": "未选择文件", "ai.imageCleanReferencePreview": "参考图预览",
        "ai.imageCleanLimitLabel": "展示数量", "ai.imageCleanHint": "概率越接近 100% 表示越相似。", "ai.imageCleanRunBtn": "筛选相似图片", "ai.imageCleanResetBtn": "清空结果",
        "ai.imageCleanResultTitle": "相似图片结果", "ai.imageCleanEmpty": "暂无图片", "ai.imageCleanMissingRef": "请先上传参考图", "ai.imageCleanDone": "筛选完成",
        "ai.imageCleanFail": "筛选失败", "ai.imageCleanUploadDrop": "拖拽图片到此处，或点击选择参考图", "ai.imageCleanUploadNote": "仅支持上传 1 张参考图",
        "ai.imageCleanUploadSelected": "已选择：{{name}}", "ai.imageCleanRefTooMany": "一次只支持上传 1 张参考图，请重新选择。", "ai.imageCleanRefNotImage": "请选择图片文件。",
        "ai.imageCleanRemoveRefBtn": "删除参考图片", "ai.imageCleanLogTitle": "AI 图片清洗日志", "ai.imageCleanSelectionHint": "清空结果会恢复默认排序。", "ai.imageCleanDeleteConfirm": "确定删除 {{count}} 张筛选图片？该操作无法撤销。",
        "ai.imageCleanExportTitle": "导出筛选结果", "ai.imageCleanMinScoreLabel": "最低相似度", "ai.imageCleanTopCountLabel": "导出数量",
        "ai.imageCleanExportHint": "可选择图片后导出，或按相似度/数量导出当前排序结果。", "ai.imageCleanExportSelectedBtn": "导出所选",
        "ai.imageCleanExportFilteredBtn": "按条件导出", "ai.imageCleanExportNeedSimilarity": "请先筛选相似图片再按条件导出。",
        "ai.imageCleanExportEmpty": "未找到可导出的图片", "ai.imageCleanExportFail": "导出失败",
        "step.next": "下一步", "step.prev": "上一步", "step.finish": "完成", "step.progress": "第 {{current}} / {{total}} 步", "step.pageBadge": "步骤 {{current}} / {{total}}",
        "console.desc": "在这里查看环境安装、模型下载、AI 生成和 AI 图片标签的实时状态与日志。", "console.setupTitle": "环境执行日志", "console.downloadTitle": "模型下载日志", "console.copy": "复制",
        "status.label": "状态：", "status.idle": "待命", "status.queued": "排队中", "status.running": "运行中", "status.success": "已完成", "status.error": "异常",
        "log.waiting": "等待任务...", "modal.title": "提示", "modal.close": "知道了", "toast.copyOk": "已复制", "toast.copyFail": "复制失败", "toast.preview": "当前处于预览模式",
        "update.title": "发现新版本", "update.current": "当前版本：", "update.latest": "最新版本：", "update.notes": "更新说明：", "update.btn": "立即更新",
        "update.checking": "正在检查更新...", "update.latestMsg": "当前已是最新版本", "update.fail": "检查更新失败", "toolbar.theme": "主题切换", "toolbar.language": "语言切换", "toolbar.update": "检查更新"
    },
    en: {
        "brand.eyebrow": "AI Toolkit", "brand.title": "LoRA Training Toolkit", "nav.overview": "Overview", "nav.environment": "Setup", "nav.download": "Models",
        "nav.images": "Images", "nav.ai": "AI Processing", "nav.aiClean": "AI Image Cleaning", "nav.aiTag": "AI Image Tagging", "nav.console": "Console", "nav.system": "System", "nav.linux": "Status",
        "overview.title": "One Panel for Setup and Training Flow", "overview.lead": "Read each section first, then run actions in order. The app keeps status, progress, and logs in sync.",
        "overview.step1": "Step 1 · Overview", "overview.step1Desc": "Get familiar with the workflow and key notes.", "overview.step2": "Step 2 · Environment Setup", "overview.step2Desc": "Install dependencies and prepare Python, Node.js, and the toolchain.",
        "overview.step3": "Step 3 · Model Download", "overview.step3Desc": "Pick a model and switch download sources.", "overview.step4": "Step 4 · Images", "overview.step4Desc": "Upload, filter, rename, and export source images.",
        "overview.step5": "Step 5 · AI Processing", "overview.step5Desc": "Run AI generation, batch tagging, and exports.", "overview.step6": "Step 6 · AI Image Cleaning", "overview.step6Desc": "Upload a reference image and find the most similar dataset images by score.",
        "overview.step7": "Step 7 · AI Image Tagging", "overview.step7Desc": "Generate structured tags with a vision model for filtering and management.", "overview.step8": "Step 8 · Console", "overview.step8Desc": "View real-time status and logs.",
        "environment.title": "Environment Setup", "environment.desc": "Run dependency and toolchain setup automatically. Linux installs components in sequence, while Windows uses the Easy Install script.", "environment.button": "Run Setup",
        "environment.startBtn": "Launch UI", "environment.executionTitle": "What Will Run", "environment.item1": "Install huggingface_hub and modelscope", "environment.item2": "Configure the Node.js 20 source and install nodejs",
        "environment.item3": "Clone or update ai-toolkit and install requirements", "environment.item4": "Launch ai-toolkit on port 6006 for Linux or 7867 for Windows", "environment.alertTitle": "Reminder:",
        "environment.alertDesc": "This page keeps a full command log. Avoid clicking the same action repeatedly while it is running.", "environment.acceleratorTitle": "Autodl Mirror Boost", "environment.acceleratorBody": "Only for AutoDL environments. Speeds up GitHub and HuggingFace access when needed.",
        "environment.githubTitle": "GitHub Proxy Boost", "environment.githubBody": "Uses a third-party GitHub proxy when direct access is slow.", "environment.acceleratorEnable": "Enable", "environment.acceleratorDisable": "Disable",
        "environment.acceleratorSuccess": "Acceleration settings updated", "environment.acceleratorFail": "Failed to update acceleration settings", "environment.acceleratorUnsupported": "Available only on Linux/AutoDL", "environment.acceleratorOn": "On",
        "environment.acceleratorOff": "Off", "environment.acceleratorConflict": "Autodl mirror boost and GitHub boost cannot be enabled at the same time. Turn off GitHub boost first.", "environment.githubAutoDisabledAutodl": "Both boosts were enabled, so Autodl mirror boost was turned off automatically.",
        "download.title": "Model Selection", "download.desc": "Pick the model you need and switch between download sources. The app creates the model directory automatically.", "download.modelLegend": "Model", "download.sourceLegend": "Source",
        "download.button": "Download", "download.note": "Default directory: {{dir}}/model-name", "download.showMore": "Show more models ({{n}})", "download.showLess": "Collapse", "download.sourceRecommended": "Recommended", "download.sourceAltDesc": "Official community source",
        "images.title": "Image Management", "images.desc": "Upload single files, folders, or archives, then organize, filter, and export them in batches.", "images.uploadTitle": "Upload Images", "images.uploadDrop": "Drop files here or click to choose",
        "images.refreshBtn": "Refresh", "images.uploadAutoNote": "Uploading starts automatically after files are selected", "images.uploadSelectedCount": "{{count}} image(s) selected", "images.deleteSelected": "Delete Selected", "images.clearAll": "Clear All", "images.deleteEmpty": "Select images to delete first",
        "images.deleteConfirm": "Delete the selected images? This cannot be undone.", "images.clearConfirm": "Clear all images? This cannot be undone.", "images.clearSuccess": "All images were cleared", "images.deleteSuccess": "Selected images were deleted",
        "images.renameTitle": "Batch Rename", "images.prefixPlaceholder": "Prefix", "images.startNumberPlaceholder": "Start number", "images.keywordPlaceholder": "Keyword", "images.keywordActionNone": "Rename only", "images.keywordActionFilter": "Apply to matches",
        "images.keywordActionDelete": "Delete matches", "images.keywordActionKeep": "Keep matches only", "images.renameBtn": "Apply", "images.exportTitle": "Batch Export", "images.exportBtn": "Export Image Pack", "images.generateTitle": "AI Batch Generate",
        "images.promptPlaceholder": "Describe the target style or edit you want...", "images.overwriteLabel": "Overwrite files with the same name", "images.apiKeyPlaceholder": "Enter the RunningHub API key", "images.configRequired": "Enter the RunningHub API key",
        "images.requestUrlPlaceholder": "Enter the RunningHub model endpoint URL", "images.queryUrlPlaceholder": "Enter the query endpoint URL", "images.aspectRatioCustom": "Custom", "images.customAspectRatioPlaceholder": "Enter a custom aspectRatio, such as 7:10",
        "images.requestUrlRequired": "Enter the RunningHub model endpoint URL", "images.queryUrlRequired": "Enter the query endpoint URL", "images.customAspectRatioRequired": "Enter a custom aspectRatio", "images.extraReferenceLabel": "Extra reference images (Image 2~N)",
        "images.extraReferenceSelectBtn": "Choose extra references", "images.extraReferenceSummaryIdle": "No files selected", "images.extraReferenceSummarySelected": "{{count}} file(s) selected", "images.extraReferenceHint": "The original image from the Images page is always submitted as Image 1. Files uploaded here are sent in order as Image 2, Image 3, Image 4, and so on.",
        "images.extraReferenceItem": "Image {{index}} · {{name}}", "images.extraReferenceRemove": "Remove", "images.workflowExtraImageNodesPlaceholder": "Extra image nodes, one per line, format: nodeId:fieldName", "images.workflowExtraImageNodesInvalid": "Invalid extra image node format. Use one nodeId:fieldName per line.",
        "images.extraReferenceNodeMissing": "Extra reference images were uploaded, but the current workflow does not have enough image node mappings", "images.workflowImageNodeIdPlaceholder": "Image node ID", "images.workflowImageFieldNamePlaceholder": "Image field name", "images.workflowPromptNodeIdPlaceholder": "Prompt node ID",
        "images.workflowPromptFieldNamePlaceholder": "Prompt field name", "images.workflowAspectNodeIdPlaceholder": "Aspect node ID", "images.workflowAspectFieldNamePlaceholder": "Aspect field name", "images.workflowAspectFieldDataPlaceholder": "Aspect fieldData (optional)",
        "images.workflowHint": "Different RunningHub workflows may use different nodeId / fieldName values. If you see NODE_INFO_MISMATCH in logs, update them here first.", "images.workflowImageConfigRequired": "Enter the image nodeId and fieldName", "images.workflowPromptConfigInvalid": "Prompt nodeId and fieldName must be filled together or left blank together",
        "images.workflowAspectConfigInvalid": "Aspect nodeId and fieldName must be filled together or left blank together", "images.advancedToggle": "Advanced Settings (Auto Parse / Manual Nodes)", "images.autoParseToggle": "Auto Parse", "images.manualNodeToggle": "Advanced Settings (Model Params)", "images.runninghubModelLabel": "RunningHub Model", "images.runninghubModelPlaceholder": "Auto-filled from the uploaded example, or enter the model name manually", "images.runninghubModelRequired": "Enter the RunningHub model", "images.runninghubManualParamsHint": "Fill extra model parameters here as a JSON object. Auto parse will also write back into this box.", "images.runninghubExtraParamsPlaceholder": "{\"resolution\":\"2k\"}", "images.runninghubExtraParamsInvalid": "Advanced model parameters must be a valid JSON object", "images.exampleFileLabel": "Upload official Python example", "images.exampleTextareaPlaceholder": "Paste the official RunningHub Python request example and click Parse to fill the config automatically",
        "images.parseExampleBtn": "Parse Example", "images.exampleParseRequired": "Upload or paste the official RunningHub Python request example first", "images.exampleParseSuccess": "Example parsed and workflow config filled automatically", "images.selectionHint": "All images will be used when none are selected", "images.selectionSelected": "{{count}} image(s) selected",
        "images.generateBtn": "Generate", "images.clearSelection": "Clear", "images.galleryTitle": "Image Gallery", "images.galleryFilter": "Search...", "images.filterBtn": "Search", "images.galleryEmpty": "No images yet", "images.uploadProgressTitle": "Upload Progress",
        "images.uploadProgressIdle": "No upload tasks", "images.uploadProgressPreparing": "{{count}} file(s) waiting to upload", "images.uploadProgressRunning": "Uploading {{done}} / {{total}}", "images.uploadProgressDone": "All uploads finished", "images.uploadProgressError": "Uploads finished with some failures",
        "images.uploadProgressWaiting": "Waiting", "images.uploadProgressSuccess": "Uploaded", "images.uploadProgressFailed": "Failed", "images.uploadProgressNetwork": "Network error, please try again later", "images.uploadSummarySuccess": "{{count}} succeeded", "images.uploadSummarySkip": "{{count}} skipped", "images.uploadSummaryFail": "{{count}} failed", "images.uploadBusy": "Another upload is already running",
        "images.consoleTitle": "AI Generation Logs", "images.uploadEmpty": "Choose at least one file", "images.manualUploadTitle": "Upload generated image", "images.manualUploadSuccess": "Upload succeeded", "images.manualUploadFailed": "Upload failed", "ai.title": "AI Processing",
        "ai.desc": "Generate images with AI, apply tags, and export the results.", "ai.tagTitle": "Batch Tagging", "ai.tagPlaceholder": "Enter tags...", "ai.tagBtn": "Apply Tags", "ai.exportBtn": "Export AI Package", "ai.galleryTitle": "AI Preview",
        "ai.tagSuccess": "Tags updated", "ai.tagHint": "Describe the target style or effect you want, preferably in English.<br>Examples:<br>- Transform into Ghibli anime style<br>- Transform into inkwash painting style<br>- Add glasses to the character", "ai.platformTitle": "AI Platform",
        "ai.platformProvider": "Provider", "ai.platformModelPreset": "Model Preset", "ai.platformCustomModel": "Custom Model", "ai.platformCustomModelPlaceholder": "Enter a custom model name...", "ai.platformApiKey": "API Key", "ai.platformBaseUrl": "Base URL (optional, for custom or proxy access)",
        "ai.platformTestBtn": "Test Connection", "ai.platformTestOk": "Connection test passed", "ai.platformTestFail": "Connection test failed", "ai.platformErrorModelMissing": "Choose a model or enter a custom one first.", "ai.platformErrorApiKeyMissing": "Enter the API key for the selected provider.",
        "ai.platformErrorBaseUrlMissing": "Enter a Base URL when using a custom provider.", "ai.cleanTitle": "AI Image Tagging", "ai.cleanPageDesc": "Edit the prompt and let the model extract structured tags from each image for later filtering.", "ai.cleanPromptPlaceholder": "Enter a prompt...",
        "ai.cleanPromptHint": "The prompt is editable so you can adapt the tagging dimensions to your workflow.", "ai.cleanSelectionHint": "All images will be used when none are selected", "ai.cleanRunBtn": "Run Tagging", "ai.cleanResetBtn": "Reset Filters", "ai.cleanResultTitle": "AI Image Tagging Results",
        "ai.cleanNoTags": "No tags yet. Run AI image tagging first.", "ai.cleanDimension.main_subject": "Subject", "ai.cleanDimension.appearance": "Appearance", "ai.cleanDimension.action_state": "Action / State", "ai.cleanDimension.environment": "Environment", "ai.cleanDimension.visual_style": "Visual Style",
        "ai.imageCleanTitle": "AI Image Cleaning", "ai.imageCleanDesc": "Upload a reference image, find the most similar dataset images, and sort by score.", "ai.imageCleanToolTitle": "Find Similar Images",
        "ai.imageCleanReferenceLabel": "Reference", "ai.imageCleanSelectRefBtn": "Select Reference", "ai.imageCleanRefSummaryIdle": "No file selected", "ai.imageCleanReferencePreview": "Reference Preview",
        "ai.imageCleanLimitLabel": "Show Top", "ai.imageCleanHint": "Scores closer to 100% indicate higher similarity.", "ai.imageCleanRunBtn": "Find Similar Images", "ai.imageCleanResetBtn": "Clear Results",
        "ai.imageCleanResultTitle": "Similarity Results", "ai.imageCleanEmpty": "No images", "ai.imageCleanMissingRef": "Please upload a reference image first.", "ai.imageCleanDone": "Filtering complete",
        "ai.imageCleanFail": "Filtering failed", "ai.imageCleanUploadDrop": "Drop an image here, or click to choose a reference", "ai.imageCleanUploadNote": "Only 1 reference image is supported",
        "ai.imageCleanUploadSelected": "Selected: {{name}}", "ai.imageCleanRefTooMany": "Only 1 reference image is supported. Please reselect.", "ai.imageCleanRefNotImage": "Please choose an image file.",
        "ai.imageCleanRemoveRefBtn": "Remove Reference", "ai.imageCleanLogTitle": "AI Image Cleaning Logs", "ai.imageCleanSelectionHint": "Clear results restores the default order.", "ai.imageCleanDeleteConfirm": "Delete {{count}} filtered images? This cannot be undone.",
        "ai.imageCleanExportTitle": "Export Results", "ai.imageCleanMinScoreLabel": "Min Similarity", "ai.imageCleanTopCountLabel": "Export Count",
        "ai.imageCleanExportHint": "Export selected images, or export by similarity score/count based on current order.", "ai.imageCleanExportSelectedBtn": "Export Selected",
        "ai.imageCleanExportFilteredBtn": "Export by Criteria", "ai.imageCleanExportNeedSimilarity": "Run similarity filtering before exporting by criteria.",
        "ai.imageCleanExportEmpty": "No images to export", "ai.imageCleanExportFail": "Export failed",
        "step.next": "Next", "step.prev": "Back", "step.finish": "Finish", "step.progress": "Step {{current}} / {{total}}", "step.pageBadge": "Step {{current}} / {{total}}", "console.desc": "View live status and logs here for setup, model downloads, AI generation, and AI image tagging.",
        "console.setupTitle": "Setup Logs", "console.downloadTitle": "Download Logs", "console.copy": "Copy", "status.label": "Status: ", "status.idle": "Idle", "status.queued": "Queued", "status.running": "Running", "status.success": "Done", "status.error": "Error",
        "log.waiting": "Waiting for task...", "modal.title": "Notice", "modal.close": "Close", "toast.copyOk": "Copied", "toast.copyFail": "Copy failed", "toast.preview": "Preview mode is active", "update.title": "New Version Available", "update.current": "Current:", "update.latest": "Latest:", "update.notes": "Release notes:",
        "update.btn": "Open Update", "update.checking": "Checking for updates...", "update.latestMsg": "You are already on the latest version", "update.fail": "Failed to check for updates", "toolbar.theme": "Toggle theme", "toolbar.language": "Switch language", "toolbar.update": "Check for updates"
    },
};

export function getText(key, lang = state.currentLang) {
    return dictionary[lang]?.[key] ?? dictionary.zh?.[key] ?? key;
}

export function formatText(key, replacements = {}, lang = state.currentLang) {
    return Object.entries(replacements).reduce((text, [name, value]) => {
        return text.replaceAll(`{{${name}}}`, String(value));
    }, getText(key, lang));
}

export function getLocalizedLabelFromConfig(item) {
    if (!item) return "";
    if (state.currentLang === "en") return item.label_en || item.label || item.id || item.model || "";
    return item.label_zh || item.label || item.id || item.model || "";
}

export function registerTranslationHook(callback) {
    translationHooks.add(callback);
}

export function updateStepText() {
    if (dom.progressText) {
        dom.progressText.textContent = formatText("step.progress", {
            current: state.currentStepIndex + 1,
            total: STEPS.length,
        });
    }
    document.querySelectorAll(".page-badge").forEach((badge, index) => {
        badge.textContent = formatText("step.pageBadge", {current: index + 1, total: STEPS.length});
    });
}

export function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        if ([dom.imageGrid, dom.aiGrid, dom.aiTagGrid, dom.aiCleanGrid].includes(element)) return;
        element.textContent = getText(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        element.setAttribute("placeholder", getText(element.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
        element.innerHTML = getText(element.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
        element.setAttribute("title", getText(element.dataset.i18nTitle));
    });

    const linuxStateValue = document.getElementById("linuxStateValue");
    if (linuxStateValue) {
        const mode = linuxStateValue.dataset.mode === "preview" ? "preview" : "exec";
        linuxStateValue.textContent = state.currentLang === "en"
            ? linuxStateValue.dataset[mode === "preview" ? "previewEn" : "execEn"]
            : linuxStateValue.dataset[mode === "preview" ? "previewZh" : "execZh"];
    }

    updateStepText();
    translationHooks.forEach((callback) => callback());
}

export function setLanguage(lang) {
    state.currentLang = lang === "en" ? "en" : "zh";
    document.body.dataset.lang = state.currentLang;
    localStorage.setItem("aitoolkit-lang", state.currentLang);
    applyTranslations();
}

export function toggleLanguage() {
    setLanguage(state.currentLang === "zh" ? "en" : "zh");
}
