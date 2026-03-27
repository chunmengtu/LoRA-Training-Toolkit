from flask import Blueprint, jsonify

from app.core.config import BASE_MODEL_DIR, CURRENT_VERSION, IS_LINUX, SYSTEM_NAME
from app.core.state import state_lock, task_state


bp = Blueprint("console", __name__, url_prefix="/api")
blueprints = [bp]


@bp.route("/status")
def status():
    with state_lock:
        payload = {
            "os": SYSTEM_NAME,
            "is_linux": IS_LINUX,
            "base_dir": str(BASE_MODEL_DIR),
            "setup": dict(task_state["setup"]),
            "download": dict(task_state["download"]),
            "image_generation": dict(task_state["image_generation"]),
            "ai_clean": dict(task_state["ai_clean"]),
            "version": CURRENT_VERSION,
        }
    return jsonify(payload)
