from flask import Blueprint, request

from app.core.responses import error_response, success_response
from .schemas import normalize_tag_payload
from .service import queue_tagging, test_ai_platform


bp = Blueprint("ai_tag", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/ai/config/test", methods=["POST"])
def ai_config_test():
    payload = normalize_tag_payload(request.get_json(force=True) or {})
    if not payload["model"] or not payload["api_key"]:
        return error_response("请填写模型名称与 API Key")
    ok, message = test_ai_platform(
        payload["provider"],
        payload["model"],
        payload["api_key"],
        payload["base_url"],
    )
    if ok:
        return success_response(message)
    return error_response(message)


@bp.route("/ai/tag", methods=["POST"])
def ai_tag():
    ok, message, items = queue_tagging(normalize_tag_payload(request.get_json(force=True) or {}))
    if ok:
        return success_response(message, items=items or [])
    return error_response(message, status_code=409 if "正在执行" in message else 400)
