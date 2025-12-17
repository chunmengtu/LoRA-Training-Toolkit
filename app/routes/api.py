import threading
import uuid
import datetime
import os
from pathlib import Path
from flask import Blueprint, jsonify, request, send_file

from ..config import (
    CURRENT_VERSION, GITEE_REPO, SYSTEM_NAME, IS_LINUX, BASE_MODEL_DIR, TEMP_DIR
)
from ..state import task_state, state_lock, update_state
from ..utils import (
    check_update, can_access_google, normalize_relative_path, 
    safe_bucket_path, allowed_image, sanitize_relative_path
)
from ..services import (
    run_setup_pipeline, run_download_pipeline, run_start_command,
    run_network_accelerator, gather_media_items, asset_counts,
    extract_zip_file, save_file_storage, generate_images_worker,
    organize_images, delete_images_and_associations, clear_all_images,
    tag_images, create_export_zip, create_ai_export_zip, get_ai_pairs,
    run_image_cleaning, test_ai_platform_connection,
)

bp = Blueprint("api", __name__, url_prefix="/api")

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
        update_state(
            "setup",
            status="queued",
            progress=0,
            message="即将开始",
            log=[],
        )
    threading.Thread(target=run_setup_pipeline, args=(github_accelerator,), daemon=True).start()
    return jsonify({"ok": True, "message": "安装流程已启动"})

@bp.route("/run-start", methods=["POST"])
def api_run_start():
    result = run_start_command()
    status_code = 200 if result["ok"] else 500
    return jsonify(result), status_code

@bp.route("/download", methods=["POST"])
def api_download():
    data = request.get_json(force=True)
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
    threading.Thread(
        target=run_download_pipeline, args=(model_name, source), daemon=True
    ).start()
    return jsonify({"ok": True, "message": "模型下载流程已启动"})

@bp.route("/images/list")
def api_images_list():
    keyword = request.args.get("keyword", "").strip() or None
    images = gather_media_items("source", keyword)
    return jsonify(
        {
            "ok": True,
            "images": images,
            "counts": asset_counts(),
        }
    )

@bp.route("/ai/list")
def api_ai_list():
    keyword = request.args.get("keyword", "").strip() or None
    pairs = get_ai_pairs(keyword)
    return jsonify({
        "ok": True,
        "pairs": pairs,
        "counts": asset_counts()
    })


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
                count, entries = extract_zip_file(temp_path)
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
        
    ext = Path(file.filename).suffix.lower()
    if not allowed_image(file.filename):
        return jsonify({"ok": False, "message": "不支持的文件格式"}), 400
        
    filename = f"{target_stem}_gen1{ext}"
    
    try:
        saved_path = save_file_storage(file, Path(filename), bucket="generated")
        return jsonify({"ok": True, "message": "上传成功", "path": saved_path})
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500

@bp.route("/images/organize", methods=["POST"])
def api_images_organize():
    data = request.get_json(force=True)
    result = organize_images(
        targets=data.get("targets") or [],
        prefix=(data.get("prefix") or "").strip(),
        start_number=int(data.get("start_number") or 1),
        apply_prefix=bool(data.get("apply_prefix", True)),
        apply_sequence=bool(data.get("apply_sequence", True)),
        keyword=(data.get("keyword") or "").strip(),
        keyword_action=(data.get("keyword_action") or "none").lower()
    )
    status_code = 200 if result["ok"] else 400
    return jsonify(result), status_code

@bp.route("/images/delete", methods=["POST"])
def api_images_delete():
    data = request.get_json(force=True)
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
    data = request.get_json(force=True)
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
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'images_export_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
    )

@bp.route("/ai/export", methods=["GET"])
def api_ai_export():
    memory_file = create_ai_export_zip()
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'ai_export_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
    )

@bp.route("/network/accelerator", methods=["POST"])
def api_network_accelerator():
    data = request.get_json(force=True)
    action = (data.get("action") or "").lower()
    if action not in {"enable", "disable"}:
        return jsonify({"ok": False, "message": "无效的操作指令"}), 400
    
    result = run_network_accelerator(action)
    status_code = 200 if result["ok"] else 500
    return jsonify(result), status_code

@bp.route("/images/generate", methods=["POST"])
def api_images_generate():
    data = request.get_json(force=True)
    prompt = (data.get("prompt") or "").strip()
    overwrite = bool(data.get("overwrite", True))
    targets = data.get("targets") or []
    key_path = (data.get("key_path") or "").strip()
    project_id = (data.get("project_id") or "").strip()
    location = (data.get("location") or "").strip()
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

    if not key_path or not project_id or not location:
        return (
            jsonify({"ok": False, "message": "请填写 KEY_PATH、PROJECT_ID 与 LOCATION"}),
            400,
        )

    resolved_key_path = os.path.abspath(os.path.expanduser(key_path))
    if not os.path.exists(resolved_key_path):
        return (
            jsonify({"ok": False, "message": f"找不到凭证文件：{resolved_key_path}"}),
            400,
        )

    if not can_access_google():
        return jsonify({"ok": False, "message": "当前无法连接 Gemini，请先开启 VPN / 开启系统代理 后再试"}), 502

    with state_lock:
        if task_state["image_generation"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有生成任务正在执行"}), 409
        update_state(
            "image_generation",
            status="queued",
            progress=0,
            message="任务已排队",
            log=[],
            prompt=prompt,
            total=len(filenames),
            processed=0,
        )

    threading.Thread(
        target=generate_images_worker,
        args=(
            prompt or "请根据参考图生成风格一致的图像",
            filenames,
            bucket,
            overwrite,
            resolved_key_path,
            project_id,
            location,
        ),
        daemon=True,
    ).start()
    return jsonify({"ok": True, "message": "生成任务已启动，请在右侧控制台查看进度"})


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

    try:
        items = run_image_cleaning(filenames, provider, model, api_key, base_url, prompt)
    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 500

    return jsonify({
        "ok": True,
        "message": f"已为 {len(items)} 张图片生成标签",
        "items": items,
    })

