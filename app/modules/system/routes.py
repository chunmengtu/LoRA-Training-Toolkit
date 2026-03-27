from flask import Blueprint, render_template, request

from app.core.responses import error_response, success_response
from .service import build_index_context, check_latest_release, toggle_network_accelerator


bp = Blueprint("system", __name__)
api_bp = Blueprint("system_api", __name__, url_prefix="/api")
blueprints = [bp, api_bp]


@bp.route("/")
def index():
    return render_template("pages/index.html", **build_index_context())


@api_bp.route("/check_update")
def check_update():
    result = check_latest_release()
    if result["ok"]:
        return success_response(
            current_version=result["current_version"],
            latest_version=result["latest_version"],
            release_name=result["release_name"],
            release_notes=result["release_notes"],
            release_url=result["release_url"],
        )
    return error_response(result["message"], status_code=500)


@api_bp.route("/network/accelerator", methods=["POST"])
def network_accelerator():
    action = ((request.get_json(force=True) or {}).get("action") or "").lower()
    if action not in {"enable", "disable"}:
        return error_response("无效的操作指令")
    result = toggle_network_accelerator(action)
    if result["ok"]:
        return success_response(result["message"], action=result.get("action"), output=result.get("output"))
    return error_response(result["message"], status_code=500)
