import time
from typing import List, Tuple, Dict
import base64
import json
from ..config import GEMINI_MODEL_NAME
from ..state import append_log, update_state
from ..utils import get_timestamp, safe_bucket_path
from .filesystem import save_generation_outputs

def load_vertex_components():
    try:
        import google.auth
        import vertexai
        from vertexai.preview.generative_models import (
            GenerativeModel,
            GenerationConfig,
            Image as VertexImage,
            Part,
        )
    except Exception as exc:
        raise RuntimeError(
            "无法加载 Vertex AI SDK，请确认已安装 google-auth 与 vertexai 相关依赖"
        ) from exc

    return google.auth, vertexai, GenerativeModel, GenerationConfig, VertexImage, Part

def generate_images_worker(
    prompt: str,
    filenames: List[str],
    bucket: str,
    overwrite: bool,
    key_path: str,
    project_id: str,
    location: str,
) -> None:
    total = len(filenames)
    update_state(
        "image_generation",
        status="running",
        progress=0,
        processed=0,
        total=total,
        message="正在初始化 Vertex AI",
        prompt=prompt,
        bucket=bucket,
    )
    append_log("image_generation", f"[{get_timestamp()}] 🧠 开始批量生成任务，共 {total} 张图片")

    try:
        (
            google_auth,
            vertexai,
            GenerativeModel,
            GenerationConfig,
            VertexImage,
            Part,
        ) = load_vertex_components()
        credentials, _ = google_auth.load_credentials_from_file(key_path)
        vertexai.init(project=project_id, location=location, credentials=credentials)
        model = GenerativeModel(GEMINI_MODEL_NAME)
        generation_config = GenerationConfig(temperature=0.4, top_p=0.95, top_k=32)
    except Exception as exc:
        append_log("image_generation", f"[{get_timestamp()}] ❌ 初始化失败：{exc}")
        update_state("image_generation", status="error", message=str(exc))
        return

    # Queue format: [(relative_path, attempt_count)]
    queue: List[Tuple[str, int]] = [(f, 0) for f in filenames]
    processed_count = 0
    
    MAX_RETRIES = 3
    RPM_DELAY = 7  # 10 RPM = 6s/req. Use 7s to be safe.

    while queue:
        relative_path, attempts = queue.pop(0)
        
        try:
            source_path = safe_bucket_path(bucket, relative_path)
        except ValueError as exc:
            append_log("image_generation", f"[{get_timestamp()}] ⚠️ 跳过非法路径：{relative_path} ({exc})")
            processed_count += 1
            continue

        if not source_path.exists():
            append_log("image_generation", f"[{get_timestamp()}] ⚠️ 找不到文件：{relative_path}")
            processed_count += 1
            continue

        append_log("image_generation", f"[{get_timestamp()}] 🎯 正在生成：{relative_path} (第 {attempts + 1} 次尝试)")
        
        success = False
        try:
            request_parts = [
                Part.from_text(prompt),
                Part.from_image(VertexImage.load_from_file(str(source_path))),
            ]
            response = model.generate_content(request_parts, generation_config=generation_config)
            payloads = []
            for candidate in getattr(response, "candidates", []) or []:
                content = getattr(candidate, "content", None)
                if not content:
                    continue
                for part in getattr(content, "parts", []):
                    inline_data = getattr(part, "inline_data", None)
                    if inline_data and getattr(inline_data, "data", None):
                        payloads.append(inline_data.data)
            if not payloads and hasattr(response, "images"):
                for image in getattr(response, "images", []):
                    raw = getattr(image, "_image_bytes", None)
                    if raw:
                        payloads.append(raw)

            if not payloads:
                raise RuntimeError("未从 Gemini 响应中获取到任何图像数据")

            saved = save_generation_outputs(payloads, relative_path, bucket, overwrite)
            append_log(
                "image_generation",
                f"[{get_timestamp()}] ✅ 完成 {relative_path}，输出 {len(saved)} 个文件",
            )
            success = True
            processed_count += 1
            
        except Exception as exc:
            append_log(
                "image_generation",
                f"[{get_timestamp()}] ❌ 生成 {relative_path} 失败：{exc}",
            )
            attempts += 1
            if attempts < MAX_RETRIES:
                append_log("image_generation", f"[{get_timestamp()}] 🔄 已重新加入队列，稍后重试...")
                queue.append((relative_path, attempts))
            else:
                append_log("image_generation", f"[{get_timestamp()}] 🚫 达到最大重试次数，跳过此图片")
                processed_count += 1

        # RPM Rate Limiting
        # Wait regardless of success or failure to respect API limits
        # Unless queue is empty (done)
        if queue:
             append_log("image_generation", f"[{get_timestamp()}] ⏳ 等待 {RPM_DELAY} 秒以满足 API 限制...")
             time.sleep(RPM_DELAY)

        progress = int(processed_count / total * 100)
        update_state(
            "image_generation",
            progress=progress,
            processed=processed_count,
            message=f"已处理 {processed_count}/{total} 张图片 (队列剩余 {len(queue)})",
        )

    update_state("image_generation", status="success", message="全部图片生成完成", progress=100)


def _ensure_litellm():
    try:
        from litellm import completion
    except Exception as exc:
        raise RuntimeError(
            "无法导入 litellm，请先安装依赖：pip install litellm"
        ) from exc
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
    # 已经是 provider/model 形式，或未指定 provider/custom，自定义保持原样
    if "/" in base_model or not provider_id:
        return base_model
    # OpenAI / Anthropic 在 litellm 中通常直接使用裸模型名（例如 gpt-4o、claude-3-5-sonnet-20241022）
    if provider_id in {"openai", "anthropic"}:
        return base_model
    # 其他厂商按 provider/model 规则补全前缀
    return f"{provider_id}/{base_model}"


def test_ai_platform_connection(provider: str, model: str, api_key: str, base_url: str | None = None) -> Tuple[bool, str]:
    completion = _ensure_litellm()

    if not model or not api_key:
        return False, "模型名称或 API Key 不能为空"

    messages = [
        {"role": "system", "content": "你是一个连通性测试助手，请仅回复“OK”。"},
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
    """调用大模型为多张图片生成结构化标签。"""
    completion = _ensure_litellm()

    if not prompt.strip():
        raise ValueError("提示词不能为空")

    resolved_model = _resolve_model_name(provider, model)

    results: List[Dict] = []

    for relative in filenames:
        try:
            source_path = safe_bucket_path(bucket, relative)
        except ValueError:
            continue
        if not source_path.exists():
            continue

        suffix = source_path.suffix.lower()
        mime = "image/png"
        if suffix in {".jpg", ".jpeg"}:
            mime = "image/jpeg"
        elif suffix == ".webp":
            mime = "image/webp"
        elif suffix == ".bmp":
            mime = "image/bmp"

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

        try:
            response = completion(**kwargs)
        except Exception as exc:
            raise RuntimeError(f"调用大模型失败（{relative}）：{exc}") from exc

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
            raise RuntimeError(f"模型未返回有效内容（{relative}）")

        try:
            parsed = json.loads(_strip_code_fences(content_text))
        except Exception as exc:
            raise RuntimeError(f"解析模型返回 JSON 失败（{relative}）：{exc}") from exc

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

    return results
