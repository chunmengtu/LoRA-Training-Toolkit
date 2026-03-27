import datetime

from flask import Blueprint, request, send_file, send_from_directory

from app.core.responses import error_response, success_response
from app.core.utils import safe_bucket_path
from app.shared.storage.thumbnails import serve_thumbnail as thumbnail_response
from .schemas import upload_response
from .service import (
    apply_tags,
    build_export_zip,
    clear_images,
    delete_selected_images,
    handle_uploads,
    list_images,
    organize_selected_images,
)


bp = Blueprint("images_api", __name__, url_prefix="/api")
media_bp = Blueprint("images_media", __name__)
blueprints = [media_bp, bp]


@bp.route("/images/list")
def image_list():
    data = list_images(request.args.get("keyword", "").strip() or None)
    return success_response(images=data["images"], counts=data["counts"])


@bp.route("/images/upload", methods=["POST"])
def image_upload():
    files = request.files.getlist("files")
    if not files:
        return error_response("未检测到上传文件")
    message, saved, skipped = handle_uploads(files)
    return success_response(**upload_response(message, saved, skipped))


@bp.route("/images/organize", methods=["POST"])
def image_organize():
    result = organize_selected_images(request.get_json(force=True) or {})
    if result["ok"]:
        return success_response(
            result["message"],
            renamed=result.get("renamed"),
            deleted=result.get("deleted"),
        )
    return error_response(result["message"])


@bp.route("/images/delete", methods=["POST"])
def image_delete():
    targets = (request.get_json(force=True) or {}).get("targets") or []
    if not targets:
        return error_response("请至少选择一张需要删除的图片")
    total_requested, removed = delete_selected_images(targets)
    if total_requested == 0:
        return error_response("未找到可删除的图片")
    return success_response(f"已删除 {removed} 张图片及其关联文件", deleted=removed)


@bp.route("/images/clear", methods=["POST"])
def image_clear():
    removed = clear_images()
    if removed == 0:
        return success_response("当前没有可清理的图片", deleted=0)
    return success_response(f"已清空 {removed} 张图片及关联数据", deleted=removed)


@bp.route("/images/tag", methods=["POST"])
def image_tag():
    data = request.get_json(force=True) or {}
    count = apply_tags(data.get("targets") or [], (data.get("tags") or "").strip())
    if count == 0:
        return error_response("请至少选择一张图片")
    return success_response(f"已为 {count} 张图片更新标签")


@bp.route("/images/export", methods=["GET"])
def image_export():
    memory_file = build_export_zip()
    return send_file(
        memory_file,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"images_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
    )


@media_bp.route("/uploads/<path:filename>")
def uploads(filename: str):
    try:
        source_root = safe_bucket_path("source")
        safe_path = safe_bucket_path("source", filename)
        if not safe_path.exists():
            return "Not Found", 404
        relative_path = str(safe_path.relative_to(source_root)).replace("\\", "/")
        return send_from_directory(str(source_root), relative_path)
    except ValueError:
        return "Forbidden", 403


@media_bp.route("/media/<bucket>/<path:filename>")
def media(bucket: str, filename: str):
    try:
        bucket_root = safe_bucket_path(bucket)
        safe_path = safe_bucket_path(bucket, filename)
        if not safe_path.exists():
            return "Not Found", 404
        relative_path = str(safe_path.relative_to(bucket_root)).replace("\\", "/")
        return send_from_directory(str(bucket_root), relative_path)
    except ValueError:
        return "Forbidden", 403


@media_bp.route("/api/thumbnail/<bucket>/<path:filename>")
def thumbnail(bucket: str, filename: str):
    try:
        return thumbnail_response(bucket, filename)
    except ValueError:
        return "Forbidden", 403
