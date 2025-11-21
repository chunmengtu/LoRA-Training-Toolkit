import time
from typing import List, Tuple
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

