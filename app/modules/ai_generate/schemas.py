import json
from typing import Any, Dict

from app.core.config import (
    RUNNINGHUB_QUERY_URL,
)
from app.shared.integrations.runninghub import guess_model_from_endpoint, normalize_model_name


def _parse_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except ValueError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _resolve_value(primary: Any, fallback: Any = "") -> Any:
    if primary not in (None, ""):
        return primary
    return fallback


def _resolve_node_field(extra_params: dict[str, Any], field_name: str, default: Any = "") -> Any:
    node_info_list = extra_params.get("nodeInfoList")
    if not isinstance(node_info_list, list):
        return default
    normalized = (field_name or "").strip().lower()
    for item in node_info_list:
        if not isinstance(item, dict):
            continue
        if str(item.get("fieldName") or "").strip().lower() == normalized:
            value = item.get("fieldValue")
            if value not in (None, ""):
                return value
    return default


def normalize_generation_payload(data: Dict) -> Dict:
    extra_params = _parse_object(data.get("extra_params"))
    image_api_url = (data.get("image_api_url") or "").strip()
    model = normalize_model_name(data.get("model") or guess_model_from_endpoint(image_api_url) or "")

    return {
        "model": model,
        "prompt": (data.get("prompt") or "").strip(),
        "overwrite": bool(data.get("overwrite", True)),
        "targets": data.get("targets") or [],
        "api_key": (data.get("api_key") or "").strip(),
        "aspect_ratio": str(
            _resolve_value(
                data.get("aspect_ratio"),
                _resolve_value(extra_params.get("aspectRatio", ""), _resolve_node_field(extra_params, "aspectRatio", "")),
            )
        ).strip(),
        "image_api_url": image_api_url,
        "query_url": (data.get("query_url") or RUNNINGHUB_QUERY_URL).strip() or RUNNINGHUB_QUERY_URL,
        "resolution": str(_resolve_value(data.get("resolution"), _resolve_value(extra_params.get("resolution", ""), _resolve_node_field(extra_params, "resolution", "")))).strip(),
        "width": _resolve_value(data.get("width"), _resolve_value(extra_params.get("width"), _resolve_node_field(extra_params, "width"))),
        "height": _resolve_value(data.get("height"), _resolve_value(extra_params.get("height"), _resolve_node_field(extra_params, "height"))),
        "size": str(_resolve_value(data.get("size"), _resolve_value(extra_params.get("size", ""), _resolve_node_field(extra_params, "size", "")))).strip(),
        "quality": str(_resolve_value(data.get("quality"), _resolve_value(extra_params.get("quality", ""), _resolve_node_field(extra_params, "quality", "")))).strip(),
        "input_fidelity": str(
            _resolve_value(data.get("input_fidelity"), _resolve_value(extra_params.get("inputFidelity", ""), _resolve_node_field(extra_params, "inputFidelity", "")))
        ).strip(),
        "sequential_image_generation": str(
            _resolve_value(
                data.get("sequential_image_generation"),
                _resolve_value(extra_params.get("sequentialImageGeneration", ""), _resolve_node_field(extra_params, "sequentialImageGeneration", "")),
            )
        ).strip(),
        "max_images": _resolve_value(data.get("max_images"), _resolve_value(extra_params.get("maxImages"), _resolve_node_field(extra_params, "maxImages"))),
        "webhook_url": str(
            _resolve_value(data.get("webhook_url"), extra_params.get("webhookUrl", ""))
        ).strip(),
        "extra_params": extra_params,
        "extra_reference_images": data.get("extra_reference_images") or [],
    }
