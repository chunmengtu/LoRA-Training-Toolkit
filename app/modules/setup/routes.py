from flask import Blueprint, request

from app.core.responses import error_response, success_response
from .service import start_training_ui
from .tasks import queue_setup


bp = Blueprint("setup", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/run-setup", methods=["POST"])
def run_setup():
    data = request.get_json(force=True) or {}
    if not queue_setup(bool(data.get("github_accelerator", False))):
        return error_response("已有安装任务正在执行", status_code=409)
    return success_response("安装流程已启动")


@bp.route("/run-start", methods=["POST"])
def run_start():
    result = start_training_ui()
    if result["ok"]:
        return success_response(result["message"])
    return error_response(result["message"], status_code=500)
