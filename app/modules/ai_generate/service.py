import threading
from pathlib import Path
from typing import Dict, List

from app.core.config import RUNNINGHUB_DEFAULT_IMAGE_PROMPT
from app.core.state import append_log, state_lock, task_state, update_state
from app.core.utils import allowed_image, get_timestamp, normalize_relative_path, safe_bucket_path
from app.shared.integrations.runninghub import (
    RUNNINGHUB_MAX_RETRIES,
    RunningHubClient,
    RunningHubError,
    TaskFailedError,
    TaskTimeoutError,
    UnifiedImageRequest,
    ValidationError,
    extract_result_urls,
    get_model_spec,
    resolve_model_name,
)
from app.shared.storage.media_store import (
    create_ai_export_zip,
    gather_media_items,
    get_ai_pairs,
    save_file_storage,
    save_generation_outputs,
)


def list_ai_pairs(keyword: str | None = None):
    return get_ai_pairs(keyword)


def build_ai_export():
    return create_ai_export_zip()


def save_manual_generated(file, target_stem: str) -> str:
    extension = Path(file.filename or "").suffix.lower() or ".png"
    return save_file_storage(file, Path(f"{target_stem}_gen1{extension}"), bucket="generated")


def validate_generation_request(payload: Dict) -> str | None:
    if not payload["api_key"]:
        return "请填写 RunningHub API Key"
    try:
        resolved_model_name = resolve_model_name(payload.get("model", ""), payload.get("image_api_url", ""))
        payload["model"] = resolved_model_name
        spec = get_model_spec(resolved_model_name, payload.get("extra_params"))
    except ValidationError as exc:
        return str(exc)

    if payload.get("query_url") and not payload["query_url"].startswith(("http://", "https://")):
        return f"查询接口地址无效：{payload['query_url']}"
    if payload.get("image_api_url") and not payload["image_api_url"].startswith(("http://", "https://")):
        return f"模型接口地址无效：{payload['image_api_url']}"
    if not isinstance(payload.get("extra_params"), dict):
        return "高级设置中的模型参数必须是 JSON 对象"
    payload["extra_reference_images"] = [
        item for item in payload["extra_reference_images"] if isinstance(item, dict)
    ]
    return None


def resolve_generation_targets(targets: List[str], bucket: str = "source") -> List[str]:
    filenames: List[str] = []
    if targets:
        for relative in targets:
            normalized = normalize_relative_path(relative)
            try:
                path = safe_bucket_path(bucket, normalized)
            except ValueError:
                continue
            if path.exists() and allowed_image(path.name):
                filenames.append(normalized)
    else:
        filenames = [item["relative_path"] for item in gather_media_items(bucket)]
    return filenames


def queue_generation(payload: Dict) -> tuple[bool, str]:
    filenames = resolve_generation_targets(payload["targets"])
    if not filenames:
        return False, "未找到可生成的图片，请先上传"

    try:
        preview_request = build_generation_request(
            payload=payload,
            source_path=filenames[0],
            bucket="source",
        )
        RunningHubClient(api_key=payload["api_key"], query_url=payload["query_url"]).validate_request(preview_request)
    except RunningHubError as exc:
        return False, str(exc)

    with state_lock:
        if task_state["image_generation"]["status"] == "running":
            return False, "已有生成任务正在执行"
        update_state(
            "image_generation",
            status="queued",
            progress=0,
            message="任务已排队",
            log=[],
            prompt=payload["prompt"] or RUNNINGHUB_DEFAULT_IMAGE_PROMPT,
            total=len(filenames),
            processed=0,
            bucket="source",
        )

    threading.Thread(
        target=generate_images_worker,
        args=(payload, filenames, "source"),
        daemon=True,
    ).start()
    return True, "AI批量生成任务已启动，请在右侧控制台查看进度"


def build_generation_request(payload: Dict, source_path: str, bucket: str) -> UnifiedImageRequest:
    image_inputs = [str(safe_bucket_path(bucket, source_path))]
    for extra_ref in payload.get("extra_reference_images") or []:
        data_url = str(extra_ref.get("data_url") or extra_ref.get("dataUrl") or "").strip()
        if data_url:
            image_inputs.append(data_url)

    return UnifiedImageRequest(
        model=payload["model"],
        prompt=payload["prompt"] or RUNNINGHUB_DEFAULT_IMAGE_PROMPT,
        images=image_inputs,
        resolution=payload.get("resolution") or "",
        aspect_ratio=payload.get("aspect_ratio") or "",
        width=_to_int(payload.get("width")),
        height=_to_int(payload.get("height")),
        size=payload.get("size") or "",
        quality=payload.get("quality") or "",
        input_fidelity=payload.get("input_fidelity") or "",
        sequential_image_generation=payload.get("sequential_image_generation") or "",
        max_images=_to_int(payload.get("max_images")),
        webhook_url=payload.get("webhook_url") or "",
        extra_params=payload.get("extra_params") or {},
        endpoint_override=payload.get("image_api_url") or "",
        query_url=payload.get("query_url") or "",
    )


def generate_images_worker(payload: Dict, filenames: List[str], bucket: str) -> None:
    total = len(filenames)
    completed_count = 0
    success_count = 0
    failed_count = 0
    prompt = payload["prompt"] or RUNNINGHUB_DEFAULT_IMAGE_PROMPT
    spec = get_model_spec(payload["model"], payload.get("extra_params"))

    def log_message(message: str) -> None:
        append_log("image_generation", f"[{get_timestamp()}] {message}")

    client = RunningHubClient(
        api_key=payload["api_key"],
        query_url=payload["query_url"],
        log=log_message,
    )

    update_state(
        "image_generation",
        status="running",
        progress=0,
        processed=0,
        total=total,
        message=f"正在初始化 {spec.label}",
        prompt=prompt,
        bucket=bucket,
    )
    log_message(f"开始 AI批量生成任务，共 {total} 张图片")
    log_message(f"当前模型：{spec.label} ({spec.model_name})")
    log_message(f"模型接口：{payload.get('image_api_url') or spec.endpoint}")
    log_message(f"查询接口：{payload.get('query_url') or client.query_url}")
    if payload.get("aspect_ratio"):
        log_message(f"当前 aspectRatio：{payload.get('aspect_ratio')}")
    if payload.get("extra_params"):
        log_message(f"附加模型参数：{payload['extra_params']}")

    queue = [(filename, 0) for filename in filenames]
    while queue:
        relative_path, attempts = queue.pop(0)
        try:
            source_file = safe_bucket_path(bucket, relative_path)
        except ValueError as exc:
            log_message(f"跳过非法路径：{relative_path} ({exc})")
            completed_count += 1
            failed_count += 1
            continue

        if not source_file.exists():
            log_message(f"跳过不存在的文件：{relative_path}")
            completed_count += 1
            failed_count += 1
            continue

        update_state("image_generation", message=f"正在生成 {relative_path}（第 {attempts + 1} 次尝试）")
        log_message(f"正在生成：{relative_path} (第 {attempts + 1} 次尝试)")

        try:
            request = build_generation_request(payload, relative_path, bucket)
            result = client.run(request, wait=True)
            result_urls = extract_result_urls(result)
            if not result_urls:
                raise RunningHubError("RunningHub 任务已完成，但未返回结果图片")
            saved = save_generation_outputs(download_generated_payloads(result_urls), relative_path, bucket, payload["overwrite"])
            log_message(f"完成 {relative_path}，输出 {len(saved)} 个文件")
            completed_count += 1
            success_count += 1
        except (ValidationError, TaskFailedError, TaskTimeoutError, RunningHubError) as exc:
            log_message(f"生成 {relative_path} 失败：{exc}")
            attempts += 1
            if attempts < RUNNINGHUB_MAX_RETRIES:
                log_message("已重新加入队列，稍后重试")
                queue.append((relative_path, attempts))
            else:
                log_message("达到最大重试次数，跳过此图片")
                completed_count += 1
                failed_count += 1
        except Exception as exc:
            log_message(f"生成 {relative_path} 失败：{exc}")
            completed_count += 1
            failed_count += 1

        update_state(
            "image_generation",
            progress=int(completed_count / total * 100) if total else 100,
            processed=completed_count,
            message=f"已处理 {completed_count}/{total} 张图片（队列剩余 {len(queue)}）",
        )

    update_state(
        "image_generation",
        status="success" if failed_count == 0 else "error",
        message=f"生成完成，成功 {success_count} 张，失败 {failed_count} 张",
        progress=100,
        processed=completed_count,
    )


def download_generated_payloads(result_urls: List[str]) -> List[bytes]:
    import requests

    payloads: List[bytes] = []
    for url in result_urls:
        response = requests.get(url, timeout=120)
        if response.status_code != 200:
            raise RuntimeError(f"下载生成结果失败：HTTP {response.status_code} - {url}")
        payloads.append(response.content)
    if not payloads:
        raise RuntimeError("未下载到任何生成结果")
    return payloads


def _to_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
