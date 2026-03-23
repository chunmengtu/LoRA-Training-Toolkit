import datetime
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse

from flask import Blueprint, jsonify, request, send_file

from ..config import (
    BASE_MODEL_DIR,
    CURRENT_VERSION,
    GITEE_REPO,
    IS_LINUX,
    RUNNINGHUB_ALLOWED_ASPECT_RATIOS,
    RUNNINGHUB_DEFAULT_ASPECT_RATIO,
    RUNNINGHUB_DEFAULT_IMAGE_PROMPT,
    RUNNINGHUB_IMAGE_EDIT_URL,
    RUNNINGHUB_QUERY_URL,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
    RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
    RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
    SYSTEM_NAME,
    TEMP_DIR,
)
from ..services import (
    asset_counts,
    clear_all_images,
    create_ai_export_zip,
    create_export_zip,
    delete_images_and_associations,
    extract_zip_file,
    gather_media_items,
    generate_images_worker,
    get_ai_pairs,
    organize_images,
    parse_runninghub_python_example,
    run_download_pipeline,
    run_image_cleaning,
    run_network_accelerator,
    run_setup_pipeline,
    run_start_command,
    save_file_storage,
    tag_images,
    test_ai_platform_connection,
)
from ..state import state_lock, task_state, update_state
from ..utils import (
    allowed_image,
    check_update,
    normalize_relative_path,
    safe_bucket_path,
    sanitize_relative_path,
)

bp = Blueprint("api", __name__, url_prefix="/api")


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


@bp.route("/status")
def api_status():
    with state_lock:
        payload = {
            "os": SYSTEM_NAME,
            "is_linux": IS_LINUX,
            "base_dir": BASE_MODEL_DIR,
            "setup": dict(task_state["setup"]),
            "download": dict(task_state["download"]),
            "image_generation": dict(task_state["image_generation"]),
            "ai_clean": dict(task_state["ai_clean"]),
            "version": CURRENT_VERSION,
        }
    return jsonify(payload)


@bp.route("/check_update")
def api_check_update():
    result = check_update(GITEE_REPO, CURRENT_VERSION)
    status_code = 200 if result["ok"] else 500
    return jsonify(result), status_code


@bp.route("/run-setup", methods=["POST"])
def api_run_setup():
    data = request.get_json(force=True) or {}
    github_accelerator = bool(data.get("github_accelerator", False))

    with state_lock:
        if task_state["setup"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有安装任务正在执行"}), 409
        update_state("setup", status="queued", progress=0, message="即将开始", log=[])

    threading.Thread(target=run_setup_pipeline, args=(github_accelerator,), daemon=True).start()
    return jsonify({"ok": True, "message": "安装流程已启动"})


@bp.route("/run-start", methods=["POST"])
def api_run_start():
    result = run_start_command()
    status_code = 200 if result["ok"] else 500
    return jsonify(result), status_code


@bp.route("/download", methods=["POST"])
def api_download():
    data = request.get_json(force=True) or {}
    model_name = data.get("model")
    source = data.get("source")
    if not model_name or not source:
        return jsonify({"ok": False, "message": "请选择模型和下载来源"}), 400

    with state_lock:
        if task_state["download"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有下载任务正在执行"}), 409
        update_state(
            "download",
            status="queued",
            progress=0,
            message="准备中",
            log=[],
            model=model_name,
            source=source,
        )

    threading.Thread(target=run_download_pipeline, args=(model_name, source), daemon=True).start()
    return jsonify({"ok": True, "message": "模型下载流程已启动"})


@bp.route("/images/list")
def api_images_list():
    keyword = request.args.get("keyword", "").strip() or None
    images = gather_media_items("source", keyword)
    return jsonify({"ok": True, "images": images, "counts": asset_counts()})


@bp.route("/ai/list")
def api_ai_list():
    keyword = request.args.get("keyword", "").strip() or None
    pairs = get_ai_pairs(keyword)
    return jsonify({"ok": True, "pairs": pairs, "counts": asset_counts()})


@bp.route("/ai/config/test", methods=["POST"])
def api_ai_config_test():
    data = request.get_json(force=True) or {}
    provider = (data.get("provider") or "").strip()
    model = (data.get("model") or "").strip()
    api_key = (data.get("api_key") or "").strip()
    base_url = (data.get("base_url") or "").strip() or None

    if not model or not api_key:
        return jsonify({"ok": False, "message": "请填写模型名称与 API Key"}), 400

    ok, message = test_ai_platform_connection(provider, model, api_key, base_url)
    status_code = 200 if ok else 400
    return jsonify({"ok": ok, "message": message}), status_code


@bp.route("/images/upload", methods=["POST"])
def api_images_upload():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"ok": False, "message": "未检测到上传文件"}), 400

    saved = []
    skipped = 0
    temp_dir_path = Path(TEMP_DIR)
    temp_dir_path.mkdir(parents=True, exist_ok=True)

    for storage in files:
        filename = storage.filename or ""
        if filename.lower().endswith(".zip"):
            temp_path = temp_dir_path / f"{uuid.uuid4().hex}.zip"
            storage.save(temp_path)
            try:
                _, entries = extract_zip_file(temp_path)
                saved.extend(entries)
            finally:
                temp_path.unlink(missing_ok=True)
            continue

        relative = sanitize_relative_path(filename or f"image_{uuid.uuid4().hex}.png")
        stored_rel = save_file_storage(storage, relative)
        if stored_rel:
            saved.append(stored_rel)
        else:
            skipped += 1

    message = f"成功导入 {len(saved)} 张图片"
    if skipped:
        message += f"，忽略 {skipped} 个不支持的文件"
    return jsonify(
        {
            "ok": True,
            "message": message,
            "added": len(saved),
            "skipped": skipped,
            "items": saved,
        }
    )


@bp.route("/ai/upload_generated", methods=["POST"])
def api_ai_upload_generated():
    file = request.files.get("file")
    target_stem = request.form.get("target_stem")

    if not file or not target_stem:
        return jsonify({"ok": False, "message": "缺少文件或目标标识"}), 400

    if not allowed_image(file.filename or ""):
        return jsonify({"ok": False, "message": "不支持的文件格式"}), 400

    ext = Path(file.filename or "").suffix.lower() or ".png"
    filename = f"{target_stem}_gen1{ext}"

    try:
        saved_path = save_file_storage(file, Path(filename), bucket="generated")
        return jsonify({"ok": True, "message": "上传成功", "path": saved_path})
    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 500


@bp.route("/images/organize", methods=["POST"])
def api_images_organize():
    data = request.get_json(force=True) or {}
    result = organize_images(
        targets=data.get("targets") or [],
        prefix=(data.get("prefix") or "").strip(),
        start_number=int(data.get("start_number") or 1),
        apply_prefix=bool(data.get("apply_prefix", True)),
        apply_sequence=bool(data.get("apply_sequence", True)),
        keyword=(data.get("keyword") or "").strip(),
        keyword_action=(data.get("keyword_action") or "none").lower(),
    )
    status_code = 200 if result["ok"] else 400
    return jsonify(result), status_code


@bp.route("/images/delete", methods=["POST"])
def api_images_delete():
    data = request.get_json(force=True) or {}
    targets = data.get("targets") or []
    if not targets:
        return jsonify({"ok": False, "message": "请至少选择一张需要删除的图片"}), 400

    total_requested, removed = delete_images_and_associations(targets)
    if total_requested == 0:
        return jsonify({"ok": False, "message": "未找到可删除的图片"}), 400

    return jsonify({"ok": True, "message": f"已删除 {removed} 张图片及其关联文件", "deleted": removed})


@bp.route("/images/clear", methods=["POST"])
def api_images_clear():
    removed = clear_all_images()
    if removed == 0:
        return jsonify({"ok": True, "message": "当前没有可清理的图片", "deleted": 0})

    return jsonify({"ok": True, "message": f"已清空 {removed} 张图片及关联数据", "deleted": removed})


@bp.route("/images/tag", methods=["POST"])
def api_images_tag():
    data = request.get_json(force=True) or {}
    targets = data.get("targets") or []
    tags = (data.get("tags") or "").strip()

    if not targets:
        targets = [item["relative_path"] for item in gather_media_items("source")]

    if not targets:
        return jsonify({"ok": False, "message": "请至少选择一张图片"}), 400

    count = tag_images(targets, tags)
    return jsonify({"ok": True, "message": f"已为 {count} 张图片更新标签"})


@bp.route("/images/export", methods=["GET"])
def api_images_export():
    memory_file = create_export_zip("source")
    return send_file(
        memory_file,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f'images_export_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.zip',
    )


@bp.route("/ai/export", methods=["GET"])
def api_ai_export():
    memory_file = create_ai_export_zip()
    return send_file(
        memory_file,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f'ai_export_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.zip',
    )


@bp.route("/network/accelerator", methods=["POST"])
def api_network_accelerator():
    data = request.get_json(force=True) or {}
    action = (data.get("action") or "").lower()
    if action not in {"enable", "disable"}:
        return jsonify({"ok": False, "message": "无效的操作指令"}), 400

    result = run_network_accelerator(action)
    status_code = 200 if result["ok"] else 500
    return jsonify(result), status_code


@bp.route("/runninghub/parse_example", methods=["POST"])
def api_runninghub_parse_example():
    data = request.get_json(force=True) or {}
    example_text = str(data.get("example_text") or "").strip()
    if not example_text:
        return jsonify({"ok": False, "message": "请先上传或粘贴 RunningHub 官方 Python 请求示例"}), 400

    try:
        parsed = parse_runninghub_python_example(example_text)
    except ValueError as exc:
        return jsonify({"ok": False, "message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"ok": False, "message": f"解析示例失败：{exc}"}), 500

    return jsonify({"ok": True, "message": "示例解析成功，已提取工作流地址与节点配置", "data": parsed})


@bp.route("/images/generate", methods=["POST"])
def api_images_generate():
    data = request.get_json(force=True) or {}
    prompt = (data.get("prompt") or "").strip()
    overwrite = bool(data.get("overwrite", True))
    targets = data.get("targets") or []
    api_key = (data.get("api_key") or "").strip()
    aspect_ratio = (data.get("aspect_ratio") or RUNNINGHUB_DEFAULT_ASPECT_RATIO).strip() or RUNNINGHUB_DEFAULT_ASPECT_RATIO
    image_api_url = (data.get("image_api_url") or RUNNINGHUB_IMAGE_EDIT_URL).strip()
    query_url = (data.get("query_url") or RUNNINGHUB_QUERY_URL).strip()
    workflow_config = data.get("workflow_config") or {}
    extra_reference_images = data.get("extra_reference_images") or []
    if not isinstance(workflow_config, dict):
        workflow_config = {}
    if not isinstance(extra_reference_images, list):
        extra_reference_images = []

    def workflow_value(key: str, default: str) -> str:
        if key in workflow_config and workflow_config.get(key) is not None:
            return str(workflow_config.get(key)).strip()
        return default

    raw_image_nodes = workflow_config.get("image_nodes")
    normalized_image_nodes = []
    if isinstance(raw_image_nodes, list):
        for item in raw_image_nodes:
            if not isinstance(item, dict):
                continue
            node_id = str(item.get("node_id") or item.get("nodeId") or "").strip()
            field_name = str(item.get("field_name") or item.get("fieldName") or "").strip()
            if node_id and field_name:
                normalized_image_nodes.append({"node_id": node_id, "field_name": field_name})
    if not normalized_image_nodes:
        normalized_image_nodes.append(
            {
                "node_id": workflow_value("image_node_id", RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID),
                "field_name": workflow_value("image_field_name", RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME),
            }
        )

    normalized_workflow_config = {
        "image_nodes": normalized_image_nodes,
        "image_node_id": workflow_value("image_node_id", RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID),
        "image_field_name": workflow_value("image_field_name", RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME),
        "prompt_node_id": workflow_value("prompt_node_id", RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID),
        "prompt_field_name": workflow_value("prompt_field_name", RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME),
        "aspect_ratio_node_id": workflow_value("aspect_ratio_node_id", RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID),
        "aspect_ratio_field_name": workflow_value("aspect_ratio_field_name", RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME),
        "aspect_ratio_field_data": workflow_value("aspect_ratio_field_data", RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA),
    }
    bucket = "source"

    filenames = []
    if targets:
        for relative in targets:
            normalized = normalize_relative_path(relative)
            try:
                path = safe_bucket_path(bucket, normalized)
            except ValueError:
                continue
            if path.exists() and allowed_image(path.name):
                filenames.append(normalized)
    else:
        filenames = [item["relative_path"] for item in gather_media_items(bucket)]

    if not filenames:
        return jsonify({"ok": False, "message": "未找到可生成的图片，请先上传"}), 400
    if not api_key:
        return jsonify({"ok": False, "message": "请填写 RunningHub API Key"}), 400
    if not image_api_url:
        return jsonify({"ok": False, "message": "请填写 RunningHub 工作流接口地址"}), 400
    if not query_url:
        return jsonify({"ok": False, "message": "请填写查询接口地址"}), 400
    if not _is_http_url(image_api_url):
        return jsonify({"ok": False, "message": f"RunningHub 工作流接口地址无效：{image_api_url}"}), 400
    if not _is_http_url(query_url):
        return jsonify({"ok": False, "message": f"查询接口地址无效：{query_url}"}), 400
    if aspect_ratio in RUNNINGHUB_ALLOWED_ASPECT_RATIOS:
        normalized_aspect_ratio = aspect_ratio
    else:
        normalized_aspect_ratio = aspect_ratio
    if not normalized_aspect_ratio:
        return jsonify({"ok": False, "message": "请填写 aspectRatio"}), 400
    if not normalized_workflow_config["image_nodes"]:
        return jsonify({"ok": False, "message": "请填写图片节点的 nodeId 和 fieldName"}), 400
    if any(not item["node_id"] or not item["field_name"] for item in normalized_workflow_config["image_nodes"]):
        return jsonify({"ok": False, "message": "图片节点配置存在空值，请检查高级设置"}), 400
    if bool(normalized_workflow_config["prompt_node_id"]) != bool(normalized_workflow_config["prompt_field_name"]):
        return jsonify({"ok": False, "message": "提示词节点的 nodeId 和 fieldName 需要同时填写，或同时留空"}), 400
    if bool(normalized_workflow_config["aspect_ratio_node_id"]) != bool(normalized_workflow_config["aspect_ratio_field_name"]):
        return jsonify({"ok": False, "message": "比例节点的 nodeId 和 fieldName 需要同时填写，或同时留空"}), 400
    if len(extra_reference_images) > max(len(normalized_workflow_config["image_nodes"]) - 1, 0):
        return jsonify({"ok": False, "message": "当前工作流可用的额外图像节点数量不足，请在高级设置中补充图像节点映射"}), 400

    with state_lock:
        if task_state["image_generation"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有生成任务正在执行"}), 409
        update_state(
            "image_generation",
            status="queued",
            progress=0,
            message="任务已排队",
            log=[],
            prompt=prompt or RUNNINGHUB_DEFAULT_IMAGE_PROMPT,
            total=len(filenames),
            processed=0,
            bucket=bucket,
        )

    threading.Thread(
        target=generate_images_worker,
        args=(
            prompt or RUNNINGHUB_DEFAULT_IMAGE_PROMPT,
            filenames,
            bucket,
            overwrite,
            api_key,
            normalized_aspect_ratio,
            image_api_url,
            query_url,
            normalized_workflow_config,
            extra_reference_images,
        ),
        daemon=True,
    ).start()
    return jsonify({"ok": True, "message": "AI批量生成任务已启动，请在右侧控制台查看进度"})


@bp.route("/ai/clean", methods=["POST"])
def api_ai_clean():
    data = request.get_json(force=True) or {}
    prompt = (data.get("prompt") or "").strip()
    provider = (data.get("provider") or "").strip()
    model = (data.get("model") or "").strip()
    api_key = (data.get("api_key") or "").strip()
    base_url = (data.get("base_url") or "").strip() or None
    targets = data.get("targets") or []
    bucket = "source"

    if not model or not api_key:
        return jsonify({"ok": False, "message": "请先在 AI 平台配置中填写模型名称与 API Key"}), 400

    filenames = []
    if targets:
        for relative in targets:
            normalized = normalize_relative_path(relative)
            try:
                path = safe_bucket_path(bucket, normalized)
            except ValueError:
                continue
            if path.exists() and allowed_image(path.name):
                filenames.append(normalized)
    else:
        filenames = [item["relative_path"] for item in gather_media_items(bucket)]

    if not filenames:
        return jsonify({"ok": False, "message": "未找到可清洗的图片，请先上传"}), 400

    with state_lock:
        if task_state["ai_clean"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有 AI 图片清洗任务正在执行"}), 409
        update_state(
            "ai_clean",
            status="queued",
            progress=0,
            message="任务已排队",
            log=[],
            prompt=prompt,
            total=len(filenames),
            processed=0,
            bucket=bucket,
        )

    try:
        items = run_image_cleaning(filenames, provider, model, api_key, base_url, prompt, bucket=bucket)
    except Exception as exc:
        update_state("ai_clean", status="error", message=str(exc))
        return jsonify({"ok": False, "message": str(exc)}), 500

    return jsonify({"ok": True, "message": f"已为 {len(items)} 张图片生成标签", "items": items})
