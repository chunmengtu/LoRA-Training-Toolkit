import datetime

from flask import Blueprint, request, send_file

from app.core.responses import error_response, success_response
from app.modules.images.service import validate_generated_upload
from .schemas import normalize_generation_payload
from .service import (
    build_ai_export,
    list_ai_pairs,
    queue_generation,
    save_manual_generated,
    validate_generation_request,
)
from .workflow_parser import parse_runninghub_python_example


bp = Blueprint("ai_generate", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/ai/list")
def ai_list():
    return success_response(pairs=list_ai_pairs(request.args.get("keyword", "").strip() or None))


@bp.route("/ai/upload_generated", methods=["POST"])
def upload_generated():
    file = request.files.get("file")
    target_stem = request.form.get("target_stem")
    ok, message = validate_generated_upload(file, target_stem)
    if not ok:
        return error_response(message)
    try:
        saved_path = save_manual_generated(file, target_stem)
        return success_response("上传成功", path=saved_path)
    except Exception as exc:
        return error_response(str(exc), status_code=500)


@bp.route("/runninghub/parse_example", methods=["POST"])
def parse_runninghub_example():
    example_text = str((request.get_json(force=True) or {}).get("example_text") or "").strip()
    if not example_text:
        return error_response("请先上传或粘贴 RunningHub 官方 Python 请求示例")
    try:
        parsed = parse_runninghub_python_example(example_text)
        return success_response("示例解析成功，已提取模型接口与参数配置", data=parsed)
    except ValueError as exc:
        return error_response(str(exc))
    except Exception as exc:
        return error_response(f"解析示例失败：{exc}", status_code=500)


@bp.route("/images/generate", methods=["POST"])
def generate_images():
    payload = normalize_generation_payload(request.get_json(force=True) or {})
    error_message = validate_generation_request(payload)
    if error_message:
        return error_response(error_message)
    ok, message = queue_generation(payload)
    if ok:
        return success_response(message)
    return error_response(message, status_code=409 if "正在执行" in message else 400)


@bp.route("/ai/export", methods=["GET"])
def ai_export():
    memory_file = build_ai_export()
    return send_file(
        memory_file,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"ai_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
    )
