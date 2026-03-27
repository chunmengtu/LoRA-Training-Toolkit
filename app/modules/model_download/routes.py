from flask import Blueprint, request

from app.core.responses import error_response, success_response
from .service import queue_download


bp = Blueprint("model_download", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/download", methods=["POST"])
def download_model():
    data = request.get_json(force=True) or {}
    model_name = data.get("model")
    source = data.get("source")
    if not model_name or not source:
        return error_response("请选择模型和下载来源")

    ok, message = queue_download(model_name, source)
    if ok:
        return success_response(message)
    return error_response(message, status_code=409 if "正在执行" in message else 400)
