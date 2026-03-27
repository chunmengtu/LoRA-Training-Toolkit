import base64
import json
from pathlib import Path
from typing import Dict, List, Tuple


def ensure_litellm():
    try:
        from litellm import completion
    except Exception as exc:
        raise RuntimeError("无法导入 litellm，请先安装依赖：pip install litellm") from exc
    return completion


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


def normalize_provider(provider: str | None) -> str:
    value = (provider or "").strip().lower()
    return "" if not value or value == "custom" else value


def resolve_model_name(provider: str | None, model: str) -> str:
    base_model = (model or "").strip()
    provider_id = normalize_provider(provider)
    if "/" in base_model or not provider_id:
        return base_model
    if provider_id in {"openai", "anthropic"}:
        return base_model
    return f"{provider_id}/{base_model}"


def guess_mime_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".bmp":
        return "image/bmp"
    return "image/png"


def test_connection(
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None = None,
) -> Tuple[bool, str]:
    completion = ensure_litellm()
    if not model or not api_key:
        return False, "模型名称或 API Key 不能为空"

    kwargs = {
        "model": resolve_model_name(provider, model),
        "messages": [
            {"role": "system", "content": "你是一个连通性测试助手，请仅回复 OK。"},
            {"role": "user", "content": "请仅回复 OK"},
        ],
        "api_key": api_key,
    }
    if base_url:
        kwargs["base_url"] = base_url
    try:
        completion(**kwargs)
    except Exception as exc:
        return False, f"连接测试失败：{exc}"
    return True, "连接测试成功"


def analyze_image(
    image_path: Path,
    *,
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None,
    prompt: str,
) -> Dict[str, List[str]]:
    completion = ensure_litellm()
    mime = guess_mime_type(image_path)
    data_url = f"data:{mime};base64,{base64.b64encode(image_path.read_bytes()).decode('ascii')}"
    kwargs = {
        "model": resolve_model_name(provider, model),
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "api_key": api_key,
    }
    if base_url:
        kwargs["base_url"] = base_url

    response = completion(**kwargs)
    content = extract_message_content(response)
    if not content:
        raise RuntimeError("模型未返回有效内容")

    parsed = json.loads(strip_code_fences(content))
    tags: Dict[str, List[str]] = {}
    for key in ("main_subject", "appearance", "action_state", "environment", "visual_style"):
        value = parsed.get(key, [])
        if isinstance(value, list):
            tags[key] = [str(item) for item in value]
        elif value:
            tags[key] = [str(value)]
        else:
            tags[key] = []
    return tags


def extract_message_content(response) -> str:
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
        return "\n".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ).strip()
    return str(content or "").strip()
