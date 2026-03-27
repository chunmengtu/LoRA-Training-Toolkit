import ast
import copy
import re
from typing import Any, Dict

from app.core.config import RUNNINGHUB_QUERY_URL
from app.shared.integrations.runninghub import get_model_spec, guess_model_from_endpoint


KNOWN_PAYLOAD_KEYS = {
    "prompt",
    "imageUrls",
    "nodeInfoList",
    "instanceType",
    "usePersonalQueue",
    "resolution",
    "aspectRatio",
    "width",
    "height",
    "sequentialImageGeneration",
    "maxImages",
    "size",
    "quality",
    "inputFidelity",
    "webhookUrl",
}


def strip_code_fences(content: str) -> str:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def parse_runninghub_python_example(example_text: str) -> Dict[str, Any]:
    text = strip_code_fences(example_text)
    if not text:
        raise ValueError("请先上传或粘贴 RunningHub 官方文档或 Python 请求示例")

    # 尝试使用新的Python解析器
    from app.shared.integrations.python_parser import parse_python_example
    
    try:
        parsed_info = parse_python_example(text)
        endpoint = parsed_info.get("endpoint", "")
        model = guess_model_from_endpoint(endpoint)
        
        if model and endpoint:
            # 成功解析，返回python_code模式的配置
            return {
                "model": model,
                "image_api_url": endpoint,
                "query_url": extract_query_url(text) or RUNNINGHUB_QUERY_URL,
                "prompt": "",
                "aspect_ratio": "",
                "extra_params": {
                    "python_code": text,  # 保存原始Python代码
                    **parsed_info.get("required_params", {}),
                    **parsed_info.get("optional_params", {}),
                },
                "recognized_fields": list(parsed_info.get("param_types", {}).keys()),
                "use_python_parser": True,
            }
    except Exception:
        pass  # 回退到旧的解析方式

    # 旧的解析方式（向后兼容）
    endpoint = extract_endpoint(text)
    model = guess_model_from_endpoint(endpoint)
    if not model:
        raise ValueError("未能从示例中识别 RunningHub 接口，请确认示例里包含 openapi/v2 提交地址")
    
    try:
        spec = get_model_spec(model)
    except Exception:
        # 如果模型不在预定义列表中，使用python_code适配器
        return {
            "model": model,
            "image_api_url": endpoint,
            "query_url": extract_query_url(text) or RUNNINGHUB_QUERY_URL,
            "prompt": "",
            "aspect_ratio": "",
            "extra_params": {
                "python_code": text,
            },
            "recognized_fields": [],
            "use_python_parser": True,
        }
    
    payload = extract_payload_dict(text)
    prompt = _extract_prompt(payload) if payload else ""
    aspect_ratio = _extract_aspect_ratio(payload) if payload else ""
    extra_params = _extract_supported_payload_fields(payload) if payload else {}

    query_url = extract_query_url(text) or RUNNINGHUB_QUERY_URL

    return {
        "model": model,
        "image_api_url": endpoint or spec.endpoint,
        "query_url": query_url,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio if spec.supports_aspect_ratio else "",
        "extra_params": extra_params,
        "recognized_fields": list(extra_params.keys()),
        "use_python_parser": False,
    }


def extract_endpoint(text: str) -> str:
    matches = re.findall(
        r"https://www\.runninghub\.cn/openapi/v2/[A-Za-z0-9._/\-]+",
        text,
        flags=re.IGNORECASE,
    )
    for match in matches:
        normalized = match.strip().lower()
        if normalized.endswith("/query") or normalized.endswith("/media/upload/binary"):
            continue
        return match.strip()
    return ""


def extract_query_url(text: str) -> str:
    query_match = re.search(
        r"https://www\.runninghub\.cn/openapi/v2/query",
        text,
        flags=re.IGNORECASE,
    )
    return query_match.group(0).strip() if query_match else ""


def extract_payload_dict(text: str) -> Dict[str, Any]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return extract_payload_dict_fallback(text)

    assignments: dict[str, Any] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        try:
            value = ast.literal_eval(node.value)
        except Exception:
            continue
        for target in node.targets:
            if isinstance(target, ast.Name):
                assignments[target.id] = value

    for value in assignments.values():
        if isinstance(value, dict) and KNOWN_PAYLOAD_KEYS.intersection(value.keys()):
            return value
    return {}


def extract_payload_dict_fallback(text: str) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    for key in KNOWN_PAYLOAD_KEYS:
        value = extract_inline_value(text, key)
        if value != "":
            payload[key] = value
    return payload


def extract_inline_value(text: str, key: str) -> Any:
    patterns = [
        rf'["\']{re.escape(key)}["\']\s*:\s*["\']([^"\']+)["\']',
        rf"{re.escape(key)}\s*=\s*['\"]([^'\"]+)['\"]",
        rf'["\']{re.escape(key)}["\']\s*:\s*(\d+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            if raw.isdigit():
                return int(raw)
            return raw
    return ""


def _extract_supported_payload_fields(payload: Dict[str, Any]) -> Dict[str, Any]:
    parsed: Dict[str, Any] = {}
    node_info_list = payload.get("nodeInfoList")
    if isinstance(node_info_list, list) and node_info_list:
        parsed["nodeInfoList"] = copy.deepcopy(node_info_list)
    for key in (
        "instanceType",
        "usePersonalQueue",
        "resolution",
        "width",
        "height",
        "sequentialImageGeneration",
        "maxImages",
        "size",
        "quality",
        "inputFidelity",
        "webhookUrl",
    ):
        value = payload.get(key)
        if value not in (None, "", []):
            parsed[key] = value
    return parsed


def _extract_prompt(payload: Dict[str, Any]) -> str:
    prompt = str(payload.get("prompt") or "").strip()
    if prompt:
        return prompt
    return str(_extract_node_field_value(payload.get("nodeInfoList"), "prompt") or "").strip()


def _extract_aspect_ratio(payload: Dict[str, Any]) -> str:
    aspect_ratio = str(payload.get("aspectRatio") or payload.get("aspect_ratio") or "").strip()
    if aspect_ratio:
        return aspect_ratio
    return str(_extract_node_field_value(payload.get("nodeInfoList"), "aspectRatio") or "").strip()


def _extract_node_field_value(node_info_list: Any, field_name: str) -> Any:
    if not isinstance(node_info_list, list):
        return ""
    normalized = (field_name or "").strip().lower()
    for item in node_info_list:
        if not isinstance(item, dict):
            continue
        if str(item.get("fieldName") or "").strip().lower() == normalized:
            value = item.get("fieldValue")
            if value not in (None, ""):
                return value
    return ""
