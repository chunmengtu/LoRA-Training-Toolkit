import ast
import base64
import json
import re
import time
from pathlib import Path
from typing import Callable, Dict, List, Tuple

import requests

from ..config import (
    RUNNINGHUB_DEFAULT_ASPECT_RATIO,
    RUNNINGHUB_IMAGE_EDIT_URL,
    RUNNINGHUB_QUERY_URL,
    RUNNINGHUB_UPLOAD_URL,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
    RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
    RUNNINGHUB_WORKFLOW_INSTANCE_TYPE,
    RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
    RUNNINGHUB_WORKFLOW_USE_PERSONAL_QUEUE,
)
from ..state import append_log, update_state
from ..utils import get_timestamp, safe_bucket_path
from .filesystem import save_generation_outputs


RUNNINGHUB_MAX_RETRIES = 3
RUNNINGHUB_POLL_INTERVAL_SECONDS = 5
RUNNINGHUB_MAX_POLL_ROUNDS = 120


class RunningHubWorkflowConfigError(RuntimeError):
    pass


def _ensure_litellm():
    try:
        from litellm import completion
    except Exception as exc:
        raise RuntimeError("无法导入 litellm，请先安装依赖：pip install litellm") from exc
    return completion


def _strip_code_fences(content: str) -> str:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _normalize_provider(provider: str | None) -> str:
    value = (provider or "").strip().lower()
    if not value or value == "custom":
        return ""
    return value


def _resolve_model_name(provider: str | None, model: str) -> str:
    base_model = (model or "").strip()
    provider_id = _normalize_provider(provider)
    if "/" in base_model or not provider_id:
        return base_model
    if provider_id in {"openai", "anthropic"}:
        return base_model
    return f"{provider_id}/{base_model}"


def _build_runninghub_json_headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _build_runninghub_auth_headers(api_key: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


def _guess_mime_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".bmp":
        return "image/bmp"
    return "image/png"


def _encode_image_as_data_uri(path: Path) -> str:
    mime = _guess_mime_type(path)
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def _parse_json_response(response: requests.Response) -> Dict | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    return payload if isinstance(payload, dict) else None


def _extract_error_message(response: requests.Response, payload: Dict | None = None) -> str:
    if isinstance(payload, dict):
        for key in ("errorMessage", "message", "msg", "detail"):
            value = payload.get(key)
            if value:
                return str(value)

    text = response.text.strip()
    if text:
        return text
    return f"HTTP {response.status_code}"


def _is_permanent_workflow_error(message: str) -> bool:
    normalized = (message or "").lower()
    return any(
        token in normalized
        for token in (
            "node_info_mismatch",
            "node_not_found_in_workflow",
            "field_not_found_in_workflow",
            "node info error",
            "节点信息异常",
        )
    )


def _extract_result_urls(result: Dict) -> List[str]:
    urls: List[str] = []
    for item in result.get("results") or []:
        if isinstance(item, str):
            urls.append(item)
            continue
        if not isinstance(item, dict):
            continue

        direct_url = item.get("url") or item.get("fileUrl") or item.get("downloadUrl")
        if direct_url:
            urls.append(str(direct_url))

        for nested_key in ("files", "images", "outputs"):
            for nested_item in item.get(nested_key) or []:
                if isinstance(nested_item, str):
                    urls.append(nested_item)
                elif isinstance(nested_item, dict):
                    nested_url = (
                        nested_item.get("url")
                        or nested_item.get("fileUrl")
                        or nested_item.get("downloadUrl")
                    )
                    if nested_url:
                        urls.append(str(nested_url))

    seen = set()
    ordered: List[str] = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def _normalize_workflow_image_nodes(config: Dict | None = None) -> List[Dict[str, str]]:
    image_nodes: List[Dict[str, str]] = []

    if isinstance(config, dict):
        raw_nodes = config.get("image_nodes")
        if isinstance(raw_nodes, list):
            for item in raw_nodes:
                if not isinstance(item, dict):
                    continue
                node_id = str(item.get("node_id") or item.get("nodeId") or "").strip()
                field_name = str(item.get("field_name") or item.get("fieldName") or "").strip()
                if node_id and field_name:
                    image_nodes.append({"node_id": node_id, "field_name": field_name})

        if not image_nodes:
            node_id = str(config.get("image_node_id") or "").strip()
            field_name = str(config.get("image_field_name") or "").strip()
            if node_id and field_name:
                image_nodes.append({"node_id": node_id, "field_name": field_name})

    if not image_nodes:
        image_nodes.append(
            {
                "node_id": RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
                "field_name": RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
            }
        )

    return image_nodes


def _normalize_workflow_config(config: Dict | None = None) -> Dict[str, object]:
    base = {
        "image_nodes": _normalize_workflow_image_nodes(config),
        "prompt_node_id": RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
        "prompt_field_name": RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
        "aspect_ratio_node_id": RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
        "aspect_ratio_field_name": RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
        "aspect_ratio_field_data": RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
    }
    if not isinstance(config, dict):
        return base

    for key in list(base.keys()):
        if key == "image_nodes":
            continue
        value = config.get(key)
        if value is None:
            continue
        base[key] = str(value).strip()
    return base


def _describe_workflow_config(config: Dict[str, str]) -> str:
    image_parts = [
        f"image{index + 1}={node['node_id']}:{node['field_name']}"
        for index, node in enumerate(config.get("image_nodes") or [])
    ]
    parts = image_parts or ["image=disabled"]
    if config.get("prompt_node_id") and config.get("prompt_field_name"):
        parts.append(f"prompt={config['prompt_node_id']}:{config['prompt_field_name']}")
    else:
        parts.append("prompt=disabled")
    if config.get("aspect_ratio_node_id") and config.get("aspect_ratio_field_name"):
        parts.append(
            f"aspectRatio={config['aspect_ratio_node_id']}:{config['aspect_ratio_field_name']}"
        )
    else:
        parts.append("aspectRatio=disabled")
    return " | ".join(parts)


def _collect_literal_assignments(example_text: str) -> Dict[str, object]:
    try:
        tree = ast.parse(_strip_code_fences(example_text))
    except SyntaxError as exc:
        raise ValueError("ast_parse_failed") from exc

    assignments: Dict[str, object] = {}
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
    return assignments


def _find_assignment_by_predicate(assignments: Dict[str, object], predicate: Callable[[object], bool]) -> object | None:
    for value in assignments.values():
        if predicate(value):
            return value
    return None


def _find_string_value(assignments: Dict[str, object], marker: str) -> str:
    for value in assignments.values():
        if isinstance(value, str) and marker in value:
            return value
    return ""


def _extract_regex_group(text: str, pattern: str) -> str:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else ""


def _cleanup_extracted_value(raw: str) -> str:
    value = (raw or "").strip().rstrip(",")
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    return value.strip()


def _node_field_name(node: Dict) -> str:
    return str(node.get("fieldName") or "").strip()


def _node_description(node: Dict) -> str:
    return str(node.get("description") or "").strip()


def _node_field_data(node: Dict) -> str:
    return str(node.get("fieldData") or "").strip()


def _find_workflow_node(
    node_info_list: List[Dict],
    *,
    field_keywords: Tuple[str, ...],
    description_keywords: Tuple[str, ...] = (),
    require_field_data_hint: bool = False,
) -> Dict | None:
    field_keywords = tuple(keyword.lower() for keyword in field_keywords)
    description_keywords = tuple(keyword.lower() for keyword in description_keywords)

    for node in node_info_list:
        field_name = _node_field_name(node).lower()
        description = _node_description(node).lower()
        field_data = _node_field_data(node).lower()

        field_match = any(keyword in field_name for keyword in field_keywords)
        description_match = any(keyword in description for keyword in description_keywords)
        field_data_match = require_field_data_hint and any(
            token in field_data for token in ("1:1", "16:9", "9:16", "aspect")
        )

        if field_match or description_match or field_data_match:
            return node
    return None


def _find_workflow_nodes(
    node_info_list: List[Dict],
    *,
    field_keywords: Tuple[str, ...],
    description_keywords: Tuple[str, ...] = (),
) -> List[Dict]:
    matched: List[Dict] = []
    field_keywords = tuple(keyword.lower() for keyword in field_keywords)
    description_keywords = tuple(keyword.lower() for keyword in description_keywords)

    for node in node_info_list:
        field_name = _node_field_name(node).lower()
        description = _node_description(node).lower()
        field_match = any(keyword in field_name for keyword in field_keywords)
        description_match = any(keyword in description for keyword in description_keywords)
        if field_match or description_match:
            matched.append(node)
    return matched


def _parse_runninghub_python_example_fallback(example_text: str) -> Dict[str, object]:
    text = _strip_code_fences(example_text)
    section_start = text.find("nodeInfoList")
    section = text[section_start:] if section_start >= 0 else text

    node_markers = list(re.finditer(r'"nodeId"\s*:\s*"([^"]+)"', section, flags=re.IGNORECASE))
    node_info_list: List[Dict[str, str]] = []

    for index, marker in enumerate(node_markers):
        start = marker.start()
        if index + 1 < len(node_markers):
            end = node_markers[index + 1].start()
        else:
            end = len(section)
        chunk = section[start:end]

        node_info_list.append(
            {
                "nodeId": marker.group(1).strip(),
                "fieldName": _extract_regex_group(chunk, r'"fieldName"\s*:\s*"([^"]*)"'),
                "fieldValue": _extract_regex_group(chunk, r'"fieldValue"\s*:\s*"([^"]*)"'),
                "description": _extract_regex_group(chunk, r'"description"\s*:\s*"([^"]*)"'),
                "fieldData": _cleanup_extracted_value(
                    _extract_regex_group(
                        chunk,
                        r'"fieldData"\s*:\s*(.+?)(?=,\s*"fieldValue"|,\s*"description"|,\s*"nodeId"|$)',
                    )
                ),
            }
        )

    if not node_info_list:
        raise ValueError("示例中未找到包含 nodeInfoList 的 payload，请确认使用的是 RunningHub 工作流示例")

    image_nodes = _find_workflow_nodes(
        node_info_list,
        field_keywords=("image", "imageurl", "imageurls", "images"),
        description_keywords=("图像", "图片", "上传"),
    )
    if not image_nodes:
        raise ValueError("未能从示例中识别图片节点，请在高级选项中手动填写")

    prompt_node = _find_workflow_node(
        node_info_list,
        field_keywords=("prompt", "text"),
        description_keywords=("文本", "提示词", "输入"),
    )
    aspect_node = _find_workflow_node(
        node_info_list,
        field_keywords=("aspectratio", "ratio", "aspect"),
        description_keywords=("比例",),
        require_field_data_hint=True,
    )

    return {
        "image_api_url": _extract_regex_group(text, r'url\s*=\s*["\']([^"\']+/run/ai-app/[^"\']+)["\']'),
        "query_url": _extract_regex_group(text, r'query_url\s*=\s*["\']([^"\']+/query[^"\']*)["\']'),
        "prompt": str(prompt_node.get("fieldValue") or "").strip() if prompt_node else "",
        "aspect_ratio": str(aspect_node.get("fieldValue") or "").strip() if aspect_node else "",
        "workflow_config": {
            "image_nodes": [
                {
                    "node_id": str(node.get("nodeId") or "").strip(),
                    "field_name": _node_field_name(node),
                }
                for node in image_nodes
            ],
            "image_node_id": str(image_nodes[0].get("nodeId") or "").strip(),
            "image_field_name": _node_field_name(image_nodes[0]),
            "prompt_node_id": str(prompt_node.get("nodeId") or "").strip() if prompt_node else "",
            "prompt_field_name": _node_field_name(prompt_node) if prompt_node else "",
            "aspect_ratio_node_id": str(aspect_node.get("nodeId") or "").strip() if aspect_node else "",
            "aspect_ratio_field_name": _node_field_name(aspect_node) if aspect_node else "",
            "aspect_ratio_field_data": _node_field_data(aspect_node) if aspect_node else "",
        },
    }


def parse_runninghub_python_example(example_text: str) -> Dict[str, object]:
    if not (example_text or "").strip():
        raise ValueError("请先上传或粘贴 RunningHub 官方 Python 请求示例")

    try:
        assignments = _collect_literal_assignments(example_text)
    except ValueError as exc:
        if str(exc) != "ast_parse_failed":
            raise
        return _parse_runninghub_python_example_fallback(example_text)

    payload = _find_assignment_by_predicate(
        assignments,
        lambda value: isinstance(value, dict) and isinstance(value.get("nodeInfoList"), list),
    )
    if not isinstance(payload, dict):
        raise ValueError("示例中未找到包含 nodeInfoList 的 payload，请确认使用的是 RunningHub 工作流示例")

    node_info_list = [item for item in payload.get("nodeInfoList") or [] if isinstance(item, dict)]
    if not node_info_list:
        raise ValueError("示例中的 nodeInfoList 为空，无法自动解析节点配置")

    image_nodes = _find_workflow_nodes(
        node_info_list,
        field_keywords=("image", "imageurl", "imageurls", "images"),
        description_keywords=("图像", "图片", "上传"),
    )
    if not image_nodes:
        raise ValueError("未能从示例中识别图片节点，请在高级选项中手动填写")

    prompt_node = _find_workflow_node(
        node_info_list,
        field_keywords=("prompt", "text"),
        description_keywords=("文本", "提示词", "输入"),
    )
    aspect_node = _find_workflow_node(
        node_info_list,
        field_keywords=("aspectratio", "ratio", "aspect"),
        description_keywords=("比例",),
        require_field_data_hint=True,
    )

    image_api_url = _find_string_value(assignments, "/run/ai-app/")
    query_url = _find_string_value(assignments, "/query")
    prompt = str(prompt_node.get("fieldValue") or "").strip() if prompt_node else ""
    aspect_ratio = str(aspect_node.get("fieldValue") or "").strip() if aspect_node else ""

    workflow_config = {
        "image_nodes": [
            {
                "node_id": str(node.get("nodeId") or "").strip(),
                "field_name": _node_field_name(node),
            }
            for node in image_nodes
        ],
        "image_node_id": str(image_nodes[0].get("nodeId") or "").strip(),
        "image_field_name": _node_field_name(image_nodes[0]),
        "prompt_node_id": str(prompt_node.get("nodeId") or "").strip() if prompt_node else "",
        "prompt_field_name": _node_field_name(prompt_node) if prompt_node else "",
        "aspect_ratio_node_id": str(aspect_node.get("nodeId") or "").strip() if aspect_node else "",
        "aspect_ratio_field_name": _node_field_name(aspect_node) if aspect_node else "",
        "aspect_ratio_field_data": _node_field_data(aspect_node) if aspect_node else "",
    }

    return {
        "image_api_url": image_api_url,
        "query_url": query_url,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "workflow_config": workflow_config,
    }


def _upload_runninghub_image_candidates(path: Path, api_key: str) -> List[Tuple[str, str]]:
    return _upload_runninghub_binary_candidates(path.read_bytes(), path.name, _guess_mime_type(path), api_key)


def _decode_data_uri(data_uri: str) -> Tuple[str, bytes]:
    if not data_uri.startswith("data:") or "," not in data_uri:
        raise ValueError("无效的 Data URI")

    header, encoded = data_uri.split(",", 1)
    mime = "application/octet-stream"
    if ";" in header:
        mime = header[5:].split(";", 1)[0] or mime
    elif header.startswith("data:"):
        mime = header[5:] or mime

    if ";base64" not in header:
        raise ValueError("仅支持 Base64 Data URI")

    try:
        payload = base64.b64decode(encoded)
    except Exception as exc:
        raise ValueError("无法解码 Base64 Data URI") from exc
    return mime, payload


def _upload_runninghub_binary_candidates(
    payload_bytes: bytes,
    filename: str,
    mime_type: str,
    api_key: str,
) -> List[Tuple[str, str]]:
    from io import BytesIO

    with BytesIO(payload_bytes) as file_obj:
        response = requests.post(
            RUNNINGHUB_UPLOAD_URL,
            headers=_build_runninghub_auth_headers(api_key),
            files={"file": (filename, file_obj, mime_type)},
            timeout=120,
        )

    payload = _parse_json_response(response)
    if response.status_code != 200:
        raise RuntimeError(
            f"上传 RunningHub 素材失败：HTTP {response.status_code} - {_extract_error_message(response, payload)}"
        )
    if not payload:
        raise RuntimeError("上传 RunningHub 素材失败：接口未返回有效 JSON")

    code = payload.get("code")
    if code not in (0, "0", None):
        raise RuntimeError(f"上传 RunningHub 素材失败：{_extract_error_message(response, payload)}")

    data = payload.get("data") or {}
    file_name = str(data.get("fileName") or "").strip()
    download_url = str(data.get("download_url") or data.get("downloadUrl") or "").strip()

    candidates: List[Tuple[str, str]] = []
    if file_name:
        candidates.append(("fileName", file_name))
        base_name = Path(file_name).name
        if base_name and base_name != file_name:
            candidates.append(("basename", base_name))
    if download_url:
        candidates.append(("download_url", download_url))

    if not candidates:
        raise RuntimeError("上传 RunningHub 素材成功，但未返回可用的图片引用")
    return candidates


def _upload_runninghub_data_uri_candidates(data_uri: str, filename: str, api_key: str) -> List[Tuple[str, str]]:
    mime_type, payload_bytes = _decode_data_uri(data_uri)
    from io import BytesIO

    with BytesIO(payload_bytes) as file_obj:
        response = requests.post(
            RUNNINGHUB_UPLOAD_URL,
            headers=_build_runninghub_auth_headers(api_key),
            files={"file": (filename, file_obj, mime_type)},
            timeout=120,
        )

    payload = _parse_json_response(response)
    if response.status_code != 200:
        raise RuntimeError(
            f"上传 RunningHub 素材失败：HTTP {response.status_code} - {_extract_error_message(response, payload)}"
        )
    if not payload:
        raise RuntimeError("上传 RunningHub 素材失败：接口未返回有效 JSON")

    code = payload.get("code")
    if code not in (0, "0", None):
        raise RuntimeError(f"上传 RunningHub 素材失败：{_extract_error_message(response, payload)}")

    data = payload.get("data") or {}
    file_name = str(data.get("fileName") or "").strip()
    download_url = str(data.get("download_url") or data.get("downloadUrl") or "").strip()

    candidates: List[Tuple[str, str]] = []
    if file_name:
        candidates.append(("fileName", file_name))
        base_name = Path(file_name).name
        if base_name and base_name != file_name:
            candidates.append(("basename", base_name))
    if download_url:
        candidates.append(("download_url", download_url))

    if not candidates:
        raise RuntimeError("上传 RunningHub 素材成功，但未返回可用的图片引用")
    return candidates


def _build_runninghub_workflow_payload(
    prompt: str,
    aspect_ratio: str,
    image_values: List[str],
    workflow_config: Dict[str, object],
) -> Dict:
    image_nodes = workflow_config.get("image_nodes") or []
    if not image_nodes:
        raise RuntimeError("工作流缺少图像节点配置")
    if len(image_values) > len(image_nodes):
        raise RuntimeError("当前工作流图像节点数量不足，无法容纳所有参考图")

    node_info_list = []
    for index, image_value in enumerate(image_values):
        image_node = image_nodes[index]
        node_info_list.append(
            {
                "nodeId": image_node["node_id"],
                "fieldName": image_node["field_name"],
                "fieldValue": image_value,
                "description": f"上传图像 {index + 1}",
            }
        )

    if workflow_config.get("prompt_node_id") and workflow_config.get("prompt_field_name"):
        node_info_list.append(
            {
                "nodeId": workflow_config["prompt_node_id"],
                "fieldName": workflow_config["prompt_field_name"],
                "fieldValue": prompt,
                "description": "输入文本",
            }
        )

    if workflow_config.get("aspect_ratio_node_id") and workflow_config.get("aspect_ratio_field_name"):
        aspect_node = {
            "nodeId": workflow_config["aspect_ratio_node_id"],
            "fieldName": workflow_config["aspect_ratio_field_name"],
            "fieldValue": aspect_ratio or RUNNINGHUB_DEFAULT_ASPECT_RATIO,
            "description": "设置比例",
        }
        field_data = workflow_config.get("aspect_ratio_field_data")
        if field_data:
            aspect_node["fieldData"] = field_data
        node_info_list.append(aspect_node)

    return {
        "nodeInfoList": node_info_list,
        "instanceType": RUNNINGHUB_WORKFLOW_INSTANCE_TYPE,
        "usePersonalQueue": RUNNINGHUB_WORKFLOW_USE_PERSONAL_QUEUE,
    }


def _submit_runninghub_workflow_task(
    prompt: str,
    aspect_ratio: str,
    image_candidate_groups: List[List[Tuple[str, str]]],
    api_key: str,
    image_api_url: str,
    workflow_config: Dict[str, object],
) -> Tuple[str, str]:
    last_error = "未知错误"
    if not image_candidate_groups:
        raise RuntimeError("缺少可提交的参考图")

    variant_count = max(len(group) for group in image_candidate_groups if group)
    variant_count = max(variant_count, 1)

    for variant_index in range(variant_count):
        labels: List[str] = []
        image_values: List[str] = []
        for group in image_candidate_groups:
            if not group:
                continue
            selected_label, selected_value = group[min(variant_index, len(group) - 1)]
            labels.append(selected_label)
            image_values.append(selected_value)

        payload = _build_runninghub_workflow_payload(prompt, aspect_ratio, image_values, workflow_config)
        response = requests.post(
            image_api_url or RUNNINGHUB_IMAGE_EDIT_URL,
            headers=_build_runninghub_json_headers(api_key),
            json=payload,
            timeout=120,
        )
        result = _parse_json_response(response)

        if response.status_code == 200 and result and result.get("taskId"):
            return str(result["taskId"]), " / ".join(labels)

        last_error = _extract_error_message(response, result)
        if _is_permanent_workflow_error(last_error):
            raise RunningHubWorkflowConfigError(last_error)

    raise RuntimeError(f"提交 RunningHub 工作流任务失败：{last_error}")


def _poll_runninghub_result(
    task_id: str,
    api_key: str,
    query_url: str,
    on_status: Callable[[str], None] | None = None,
) -> List[str]:
    last_status = None

    for _ in range(RUNNINGHUB_MAX_POLL_ROUNDS):
        response = requests.post(
            query_url or RUNNINGHUB_QUERY_URL,
            headers=_build_runninghub_json_headers(api_key),
            json={"taskId": task_id},
            timeout=60,
        )
        result = _parse_json_response(response)

        if response.status_code != 200:
            raise RuntimeError(
                f"查询 RunningHub 任务失败：HTTP {response.status_code} - {_extract_error_message(response, result)}"
            )
        if not result:
            raise RuntimeError("查询 RunningHub 任务失败：接口未返回有效 JSON")

        status = str(result.get("status") or "").upper()
        if status and status != last_status and on_status:
            on_status(status)
        last_status = status

        if status == "SUCCESS":
            urls = _extract_result_urls(result)
            if not urls:
                raise RuntimeError("RunningHub 任务已完成，但未返回结果图片")
            return urls

        if status in {"RUNNING", "QUEUED"}:
            time.sleep(RUNNINGHUB_POLL_INTERVAL_SECONDS)
            continue

        error_message = result.get("errorMessage") or last_status or "未知错误"
        raise RuntimeError(f"RunningHub 任务失败：{error_message}")

    raise RuntimeError("RunningHub 任务轮询超时，请稍后重试")


def _download_generated_payloads(result_urls: List[str]) -> List[bytes]:
    payloads: List[bytes] = []
    for url in result_urls:
        response = requests.get(url, timeout=120)
        if response.status_code != 200:
            raise RuntimeError(f"下载生成结果失败：HTTP {response.status_code} - {url}")
        payloads.append(response.content)

    if not payloads:
        raise RuntimeError("未下载到任何生成结果")
    return payloads


def generate_images_worker(
    prompt: str,
    filenames: List[str],
    bucket: str,
    overwrite: bool,
    api_key: str,
    aspect_ratio: str,
    image_api_url: str | None = None,
    query_url: str | None = None,
    workflow_config: Dict | None = None,
    extra_reference_images: List[Dict] | None = None,
) -> None:
    total = len(filenames)
    completed_count = 0
    success_count = 0
    failed_count = 0
    resolved_image_api_url = image_api_url or RUNNINGHUB_IMAGE_EDIT_URL
    resolved_query_url = query_url or RUNNINGHUB_QUERY_URL
    normalized_workflow_config = _normalize_workflow_config(workflow_config)
    normalized_extra_references = [item for item in (extra_reference_images or []) if isinstance(item, dict)]
    fatal_error = ""

    update_state(
        "image_generation",
        status="running",
        progress=0,
        processed=0,
        total=total,
        message="正在初始化 RunningHub 工作流",
        prompt=prompt,
        bucket=bucket,
    )
    append_log("image_generation", f"[{get_timestamp()}] 🧠 开始 AI批量生成任务，共 {total} 张图片")
    append_log("image_generation", f"[{get_timestamp()}] 🔗 工作流接口：{resolved_image_api_url}")
    append_log("image_generation", f"[{get_timestamp()}] 🔗 查询接口：{resolved_query_url}")
    append_log(
        "image_generation",
        f"[{get_timestamp()}] 🧩 节点映射：{_describe_workflow_config(normalized_workflow_config)}",
    )
    append_log(
        "image_generation",
        f"[{get_timestamp()}] 🖼️ 当前参考图顺序：图1=默认图，额外参考图 {len(normalized_extra_references)} 张",
    )
    append_log(
        "image_generation",
        f"[{get_timestamp()}] 📐 当前 aspectRatio：{aspect_ratio or RUNNINGHUB_DEFAULT_ASPECT_RATIO}",
    )

    queue: List[Tuple[str, int]] = [(filename, 0) for filename in filenames]

    while queue:
        relative_path, attempts = queue.pop(0)

        try:
            source_path = safe_bucket_path(bucket, relative_path)
        except ValueError as exc:
            append_log("image_generation", f"[{get_timestamp()}] ⏭️ 跳过非法路径：{relative_path} ({exc})")
            completed_count += 1
            failed_count += 1
            continue

        if not source_path.exists():
            append_log("image_generation", f"[{get_timestamp()}] ⏭️ 找不到文件：{relative_path}")
            completed_count += 1
            failed_count += 1
            continue

        update_state(
            "image_generation",
            message=f"正在生成 {relative_path}（第 {attempts + 1} 次尝试）",
        )
        append_log("image_generation", f"[{get_timestamp()}] 🎯 正在生成：{relative_path} (第 {attempts + 1} 次尝试)")

        try:
            image_candidate_groups: List[List[Tuple[str, str]]] = []

            primary_upload_candidates = _upload_runninghub_image_candidates(source_path, api_key)
            primary_base64_fallback = _encode_image_as_data_uri(source_path)
            image_candidate_groups.append(primary_upload_candidates + [("base64", primary_base64_fallback)])

            append_log(
                "image_generation",
                f"[{get_timestamp()}] 📤 图1 已上传到 RunningHub，得到 {len(primary_upload_candidates)} 个可用引用",
            )

            for extra_index, extra_ref in enumerate(normalized_extra_references, start=2):
                data_url = str(extra_ref.get("data_url") or extra_ref.get("dataUrl") or "").strip()
                name = str(extra_ref.get("name") or f"reference_{extra_index}.png").strip() or f"reference_{extra_index}.png"
                if not data_url:
                    continue
                extra_candidates = _upload_runninghub_data_uri_candidates(data_url, name, api_key)
                image_candidate_groups.append(extra_candidates + [("base64", data_url)])
                append_log(
                    "image_generation",
                    f"[{get_timestamp()}] 📤 图{extra_index} 已上传到 RunningHub，得到 {len(extra_candidates)} 个可用引用",
                )

            append_log("image_generation", f"[{get_timestamp()}] 📦 已为所有参考图准备 Base64 Data URI 作为兼容回退")

            task_id, image_source_label = _submit_runninghub_workflow_task(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                image_candidate_groups=image_candidate_groups,
                api_key=api_key,
                image_api_url=resolved_image_api_url,
                workflow_config=normalized_workflow_config,
            )
            append_log(
                "image_generation",
                f"[{get_timestamp()}] ☁️ RunningHub 任务已提交：{task_id}（图片引用：{image_source_label}）",
            )

            def handle_status(status: str) -> None:
                append_log("image_generation", f"[{get_timestamp()}] ⏱️ RunningHub 状态：{status}")
                update_state("image_generation", message=f"正在等待 RunningHub 返回结果（{status}）")

            result_urls = _poll_runninghub_result(
                task_id,
                api_key,
                resolved_query_url,
                on_status=handle_status,
            )
            append_log("image_generation", f"[{get_timestamp()}] 🖼️ RunningHub 返回 {len(result_urls)} 个结果地址")

            payloads = _download_generated_payloads(result_urls)
            saved = save_generation_outputs(payloads, relative_path, bucket, overwrite)

            append_log("image_generation", f"[{get_timestamp()}] ✅ 完成 {relative_path}，输出 {len(saved)} 个文件")
            completed_count += 1
            success_count += 1
        except RunningHubWorkflowConfigError as exc:
            fatal_error = (
                "检测到工作流节点配置错误，已终止本次批量任务。"
                f" 当前错误：{exc}。请检查工作流接口对应的 nodeId / fieldName 配置。"
            )
            append_log("image_generation", f"[{get_timestamp()}] ❌ 生成 {relative_path} 失败：{fatal_error}")
            remaining = len(queue) + 1
            completed_count += remaining
            failed_count += remaining
            queue.clear()
            update_state("image_generation", message=fatal_error)
            break
        except Exception as exc:
            append_log("image_generation", f"[{get_timestamp()}] ❌ 生成 {relative_path} 失败：{exc}")
            attempts += 1
            if attempts < RUNNINGHUB_MAX_RETRIES:
                append_log("image_generation", f"[{get_timestamp()}] 🔄 已重新加入队列，稍后重试")
                queue.append((relative_path, attempts))
            else:
                append_log("image_generation", f"[{get_timestamp()}] 🚫 达到最大重试次数，跳过此图片")
                completed_count += 1
                failed_count += 1

        progress = int(completed_count / total * 100) if total else 100
        update_state(
            "image_generation",
            progress=progress,
            processed=completed_count,
            message=f"已处理 {completed_count}/{total} 张图片（队列剩余 {len(queue)}）",
        )

    final_message = fatal_error or f"生成完成，成功 {success_count} 张，失败 {failed_count} 张"
    final_status = "success" if failed_count == 0 and not fatal_error else "error"
    update_state(
        "image_generation",
        status=final_status,
        message=final_message,
        progress=100,
        processed=completed_count,
    )


def test_ai_platform_connection(
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None = None,
) -> Tuple[bool, str]:
    completion = _ensure_litellm()

    if not model or not api_key:
        return False, "模型名称或 API Key 不能为空"

    messages = [
        {"role": "system", "content": "你是一个连通性测试助手，请仅回复 OK。"},
        {"role": "user", "content": "请仅回复 OK"},
    ]

    resolved_model = _resolve_model_name(provider, model)
    kwargs = {"model": resolved_model, "messages": messages, "api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url

    try:
        completion(**kwargs)
    except Exception as exc:
        return False, f"连接测试失败：{exc}"

    return True, "连接测试成功"


def run_image_cleaning(
    filenames: List[str],
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None,
    prompt: str,
    bucket: str = "source",
) -> List[Dict]:
    completion = _ensure_litellm()

    if not prompt.strip():
        raise ValueError("提示词不能为空")

    total = len(filenames)
    processed_count = 0
    success_count = 0
    failed_count = 0
    results: List[Dict] = []
    resolved_model = _resolve_model_name(provider, model)

    update_state(
        "ai_clean",
        status="running",
        progress=0,
        processed=0,
        total=total,
        message="正在执行 AI 图片清洗",
        prompt=prompt,
        bucket=bucket,
    )
    append_log("ai_clean", f"[{get_timestamp()}] 🧹 开始 AI 图片清洗，共 {total} 张图片")
    append_log("ai_clean", f"[{get_timestamp()}] 🤖 当前模型：{resolved_model}")

    for relative in filenames:
        try:
            source_path = safe_bucket_path(bucket, relative)
        except ValueError as exc:
            append_log("ai_clean", f"[{get_timestamp()}] ⏭️ 跳过非法路径：{relative} ({exc})")
            processed_count += 1
            failed_count += 1
            continue

        if not source_path.exists():
            append_log("ai_clean", f"[{get_timestamp()}] ⏭️ 找不到文件：{relative}")
            processed_count += 1
            failed_count += 1
            continue

        append_log("ai_clean", f"[{get_timestamp()}] 🔎 正在分析：{relative}")

        try:
            mime = _guess_mime_type(source_path)
            raw = source_path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
            data_url = f"data:{mime};base64,{b64}"

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ]

            kwargs = {"model": resolved_model, "messages": messages, "api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url

            response = completion(**kwargs)

            content = None
            if isinstance(response, dict):
                choices = response.get("choices") or []
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
            else:
                choices = getattr(response, "choices", None)
                if choices:
                    message = choices[0].message
                    if isinstance(message, dict):
                        content = message.get("content", "")
                    else:
                        content = getattr(message, "content", "")

            if isinstance(content, list):
                text_parts = []
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        text_parts.append(part.get("text", ""))
                content_text = "\n".join(text_parts).strip()
            else:
                content_text = str(content or "").strip()

            if not content_text:
                raise RuntimeError("模型未返回有效内容")

            parsed = json.loads(_strip_code_fences(content_text))
            tags: Dict[str, List[str]] = {}
            for key in [
                "main_subject",
                "appearance",
                "action_state",
                "environment",
                "visual_style",
            ]:
                value = parsed.get(key, [])
                if isinstance(value, list):
                    tags[key] = [str(v) for v in value]
                elif value:
                    tags[key] = [str(value)]
                else:
                    tags[key] = []

            results.append({"relative_path": relative, "tags": tags})
            success_count += 1
            append_log("ai_clean", f"[{get_timestamp()}] ✅ 完成分析：{relative}")
        except Exception as exc:
            failed_count += 1
            append_log("ai_clean", f"[{get_timestamp()}] ❌ 分析失败：{relative} ({exc})")
        finally:
            processed_count += 1
            progress = int(processed_count / total * 100) if total else 100
            update_state(
                "ai_clean",
                progress=progress,
                processed=processed_count,
                message=f"已处理 {processed_count}/{total} 张图片",
            )

    if not results and failed_count:
        update_state("ai_clean", status="error", progress=100, message=f"清洗失败，共失败 {failed_count} 张")
        raise RuntimeError("AI 图片清洗全部失败，请检查模型配置或提示词")

    final_status = "success" if failed_count == 0 else "error"
    final_message = f"清洗完成，成功 {success_count} 张，失败 {failed_count} 张"
    update_state(
        "ai_clean",
        status=final_status,
        progress=100,
        processed=processed_count,
        message=final_message,
    )
    return results
