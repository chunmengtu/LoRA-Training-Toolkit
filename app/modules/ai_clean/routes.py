import datetime

from flask import Blueprint, request, send_file

from app.core.responses import error_response, success_response
from .schemas import normalize_ai_clean_payload
from .service import build_export_zip, find_similar_images
from .pose_service import build_reference_pose_preview, find_pose_similar_images


bp = Blueprint("ai_clean", __name__, url_prefix="/api")
blueprints = [bp]

@bp.route("/ai/clean/pose/reference", methods=["POST"])
def ai_clean_pose_reference():
    reference = request.files.get("reference")
    if not reference:
        return error_response("请上传一张参考图")
    try:
        payload = build_reference_pose_preview(reference)
        persons = payload.get("persons") or []
        message = "参考图骨骼点解析完成" if persons else "参考图未检测到人体/关键点"
        return success_response(message, **payload)
    except ValueError as exc:
        return error_response(str(exc))
    except Exception as exc:
        return error_response(f"解析失败：{exc}", status_code=500)


@bp.route("/ai/clean/similar", methods=["POST"])
def ai_clean_similar():
    reference = request.files.get("reference")
    data: dict = {}
    data.update(request.args.to_dict(flat=True))
    data.update(request.form.to_dict(flat=True))
    payload = normalize_ai_clean_payload(data)

    try:
        if payload["mode"] == "pose":
            if not reference:
                return error_response("请上传一张参考图")
            reference_person_id = payload.get("reference_person_id")
            if reference_person_id is None:
                return error_response("请先选择参考图中的基准人体")
            matches = find_pose_similar_images(
                reference,
                reference_person_id=reference_person_id,
                bucket=payload["bucket"],
                targets=payload["targets"],
            )
        else:
            if not reference:
                return error_response("请上传一张参考图")
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
