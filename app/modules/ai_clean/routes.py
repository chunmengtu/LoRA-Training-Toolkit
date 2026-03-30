import datetime

from flask import Blueprint, request, send_file

from app.core.responses import error_response, success_response
from .schemas import normalize_similarity_payload
from .service import build_export_zip, find_similar_images


bp = Blueprint("ai_clean", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/ai/clean/similar", methods=["POST"])
def ai_clean_similar():
    reference = request.files.get("reference")
    if not reference:
        return error_response("请上传一张参考图")

    data: dict = {}
    data.update(request.args.to_dict(flat=True))
    data.update(request.form.to_dict(flat=True))
    payload = normalize_similarity_payload(data)

    try:
        matches = find_similar_images(
            reference,
            bucket=payload["bucket"],
            targets=payload["targets"],
        )
    except ValueError as exc:
        return error_response(str(exc))
    except Exception as exc:
        message = str(exc)
        if "正在执行" in message:
            return error_response(message, status_code=409)
        return error_response(f"筛选失败：{message}", status_code=500)
    if not matches:
        return error_response("未找到可筛选的图片，请先在图像处理页面上传素材")

    top = matches[0]
    message = f"已找到 {len(matches)} 张相似图片，最佳匹配：{top.get('name', '')}（{top.get('probability', 0)}%）"
    return success_response(message, items=matches)


@bp.route("/ai/clean/export", methods=["POST"])
def ai_clean_export():
    payload = request.get_json(force=True) or {}
    targets = payload.get("targets") or []
    if not isinstance(targets, list):
        return error_response("无效的导出参数")
    try:
        memory_file, count = build_export_zip(targets, bucket="source")
        return send_file(
            memory_file,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"ai_clean_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
        )
    except ValueError as exc:
        return error_response(str(exc))
    except Exception as exc:
        return error_response(f"导出失败：{exc}", status_code=500)
