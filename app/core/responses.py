from typing import Any

from flask import jsonify


def success_response(message: str | None = None, *, status_code: int = 200, **payload: Any):
    body = {"ok": True}
    if message is not None:
        body["message"] = message
    body.update(payload)
    return jsonify(body), status_code


def error_response(message: str, *, status_code: int = 400, **payload: Any):
    body = {"ok": False, "message": message}
    body.update(payload)
    return jsonify(body), status_code
