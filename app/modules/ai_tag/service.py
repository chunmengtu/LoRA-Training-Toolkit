from typing import Dict, List

from app.core.state import append_log, state_lock, task_state, update_state
from app.core.utils import allowed_image, get_timestamp, normalize_relative_path, safe_bucket_path
from app.shared.integrations.ai_platform import analyze_image, test_connection
from app.shared.storage.media_store import gather_media_items


def test_ai_platform(provider: str, model: str, api_key: str, base_url: str | None = None):
    return test_connection(provider, model, api_key, base_url)


def resolve_tag_targets(targets: List[str], bucket: str = "source") -> List[str]:
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


def run_image_tagging(
    filenames: List[str],
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None,
    prompt: str,
    bucket: str = "source",
) -> List[Dict]:
    if not prompt.strip():
        raise ValueError("提示词不能为空")

    total = len(filenames)
    processed_count = 0
    success_count = 0
    failed_count = 0
    results: List[Dict] = []

    update_state(
        "ai_tag",
        status="running",
        progress=0,
        processed=0,
        total=total,
        message="正在执行 AI 图片标签",
        prompt=prompt,
        bucket=bucket,
    )
    append_log("ai_tag", f"[{get_timestamp()}] 🏷️ 开始 AI 图片标签，共 {total} 张图片")
    append_log("ai_tag", f"[{get_timestamp()}] 🤖 当前模型：{model}")

    for relative in filenames:
        try:
            source_path = safe_bucket_path(bucket, relative)
        except ValueError as exc:
            append_log("ai_tag", f"[{get_timestamp()}] ⏭️ 跳过非法路径：{relative} ({exc})")
            processed_count += 1
            failed_count += 1
            continue

        if not source_path.exists():
            append_log("ai_tag", f"[{get_timestamp()}] ⏭️ 找不到文件：{relative}")
            processed_count += 1
            failed_count += 1
            continue

        append_log("ai_tag", f"[{get_timestamp()}] 🔎 正在分析：{relative}")
        try:
            tags = analyze_image(
                source_path,
                provider=provider,
                model=model,
                api_key=api_key,
                base_url=base_url,
                prompt=prompt,
            )
            results.append({"relative_path": relative, "tags": tags})
            success_count += 1
            append_log("ai_tag", f"[{get_timestamp()}] ✅ 完成分析：{relative}")
        except Exception as exc:
            failed_count += 1
            append_log("ai_tag", f"[{get_timestamp()}] ❌ 分析失败：{relative} ({exc})")
        finally:
            processed_count += 1
            update_state(
                "ai_tag",
                progress=int(processed_count / total * 100) if total else 100,
                processed=processed_count,
                message=f"已处理 {processed_count}/{total} 张图片",
            )

    if not results and failed_count:
        update_state("ai_tag", status="error", progress=100, message=f"打标失败，共失败 {failed_count} 张")
        raise RuntimeError("AI 图片标签全部失败，请检查模型配置或提示词")

    update_state(
        "ai_tag",
        status="success" if failed_count == 0 else "error",
        progress=100,
        processed=processed_count,
        message=f"打标完成，成功 {success_count} 张，失败 {failed_count} 张",
    )
    return results


def queue_tagging(payload: dict) -> tuple[bool, str, List[Dict] | None]:
    if not payload["model"] or not payload["api_key"]:
        return False, "请先在 AI 平台配置中填写模型名称与 API Key", None

    filenames = resolve_tag_targets(payload["targets"])
    if not filenames:
        return False, "未找到可打标的图片，请先上传", None

    with state_lock:
        if task_state["ai_tag"]["status"] == "running":
            return False, "已有 AI 图片标签任务正在执行", None
        update_state(
            "ai_tag",
            status="queued",
            progress=0,
            message="任务已排队",
            log=[],
            prompt=payload["prompt"],
            total=len(filenames),
            processed=0,
            bucket="source",
        )

    try:
        items = run_image_tagging(
            filenames,
            payload["provider"],
            payload["model"],
            payload["api_key"],
            payload["base_url"],
            payload["prompt"],
            bucket="source",
        )
        return True, f"已为 {len(items)} 张图片生成标签", items
    except Exception as exc:
        update_state("ai_tag", status="error", message=str(exc))
        return False, str(exc), None
