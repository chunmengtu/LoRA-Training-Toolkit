from flask import Blueprint, request

from app.core.responses import error_response, success_response
from .schemas import normalize_clean_payload
from .service import queue_cleaning, test_ai_platform


bp = Blueprint("ai_clean", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/ai/config/test", methods=["POST"])
def ai_config_test():
    payload = normalize_clean_payload(request.get_json(force=True) or {})
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


@bp.route("/ai/clean", methods=["POST"])
def ai_clean():
    ok, message, items = queue_cleaning(normalize_clean_payload(request.get_json(force=True) or {}))
    if ok:
        return success_response(message, items=items or [])
    return error_response(message, status_code=409 if "正在执行" in message else 400)
