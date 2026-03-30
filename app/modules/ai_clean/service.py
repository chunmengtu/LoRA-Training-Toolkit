import threading
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageOps

from app.core.state import append_log, state_lock, task_state, update_state
from app.core.utils import allowed_image, get_timestamp, normalize_relative_path, safe_bucket_path
from app.shared.storage.media_store import create_export_zip_for_targets, gather_media_items


HashCacheEntry = Tuple[float, int]

_hash_lock = threading.RLock()
_hash_cache: Dict[str, HashCacheEntry] = {}
MAX_SIMILAR_RESULTS = 500


def compute_dhash(image: Image.Image, *, hash_size: int = 8) -> int:
    resized = image.convert("L").resize((hash_size + 1, hash_size))
    pixels = list(resized.getdata())
    rows = [pixels[row_index * (hash_size + 1) : (row_index + 1) * (hash_size + 1)] for row_index in range(hash_size)]

    value = 0
    bit_index = 0
    for row in rows:
        for left, right in zip(row, row[1:]):
            if left > right:
                value |= 1 << bit_index
            bit_index += 1
    return value


def dhash_from_filestorage(file_storage, *, hash_size: int = 8) -> int:
    file_storage.stream.seek(0)
    try:
        with Image.open(file_storage.stream) as image:
            return compute_dhash(ImageOps.exif_transpose(image), hash_size=hash_size)
    except Exception as exc:
        raise ValueError(f"参考图解析失败：{exc}") from exc


def dhash_from_path(path: Path, *, hash_size: int = 8) -> int:
    with Image.open(path) as image:
        return compute_dhash(ImageOps.exif_transpose(image), hash_size=hash_size)


def get_cached_dhash(path: Path, *, hash_size: int = 8) -> int:
    cache_key = f"{path}|{hash_size}"
    mtime = path.stat().st_mtime
    with _hash_lock:
        cached = _hash_cache.get(cache_key)
        if cached and cached[0] == mtime:
            return cached[1]

    value = dhash_from_path(path, hash_size=hash_size)
    with _hash_lock:
        _hash_cache[cache_key] = (mtime, value)
    return value


def compute_similarity_percent(left: int, right: int, *, bits: int) -> float:
    distance = (left ^ right).bit_count()
    return max(0.0, min(100.0, (1.0 - distance / bits) * 100.0))


def resolve_similarity_targets(targets: List[str], bucket: str) -> List[dict]:
    if not targets:
        return gather_media_items(bucket)

    items: List[dict] = []
    for relative in targets:
        normalized = normalize_relative_path(relative)
        try:
            path = safe_bucket_path(bucket, normalized)
        except ValueError:
            continue
        if not path.exists() or not allowed_image(path.name):
            continue
        stat = path.stat()
        url_prefix = "/uploads" if bucket == "source" else f"/media/{bucket}"
        items.append(
            {
                "name": path.name,
                "path": normalized,
                "relative_path": normalized,
                "bucket": bucket,
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "url": f"{url_prefix}/{normalized}",
            }
        )
    return items


def find_similar_images(
    reference_storage,
    *,
    bucket: str = "source",
    targets: List[str] | None = None,
) -> List[dict]:
    candidates = resolve_similarity_targets(list(targets or []), bucket=bucket)
    if not candidates:
        update_state("ai_clean", status="idle", progress=0, processed=0, total=0, bucket=bucket, message="未找到可筛选的图片")
        return []

    total = len(candidates)
    with state_lock:
        if task_state["ai_clean"]["status"] == "running":
            raise RuntimeError("已有 AI 图片清洗任务正在执行")
        update_state(
            "ai_clean",
            status="running",
            progress=0,
            processed=0,
            total=total,
            bucket=bucket,
            message="正在筛选相似图片",
            log=[],
        )
    append_log("ai_clean", f"[{get_timestamp()}] 🧹 开始相似图片筛选，共 {total} 张图片")

    try:
        reference_hash = dhash_from_filestorage(reference_storage)
    except Exception as exc:
        update_state("ai_clean", status="error", progress=100, message=str(exc))
        raise

    bits = 8 * 8

    results: List[dict] = []
    processed = 0
    for item in candidates:
        try:
            relative_path = item.get("relative_path") or ""
            image_path = safe_bucket_path(bucket, relative_path)
            if not image_path.exists():
                raise FileNotFoundError(relative_path)
            image_hash = get_cached_dhash(image_path)
            probability = compute_similarity_percent(reference_hash, image_hash, bits=bits)
            results.append({**item, "probability": round(probability, 2)})
        except Exception:
            pass
        finally:
            processed += 1
            if processed == total or processed % 25 == 0:
                update_state(
                    "ai_clean",
                    progress=int(processed / total * 100) if total else 100,
                    processed=processed,
                    message=f"已处理 {processed}/{total} 张图片",
                )

    results.sort(key=lambda entry: entry.get("probability", 0), reverse=True)
    results = results[:MAX_SIMILAR_RESULTS]
    if not results:
        update_state("ai_clean", status="error", progress=100, processed=processed, message="筛选失败：未获得有效结果")
        append_log("ai_clean", f"[{get_timestamp()}] ❌ 筛选失败：未获得有效结果")
        return []

    best = results[0]
    update_state(
        "ai_clean",
        status="success",
        progress=100,
        processed=processed,
        message=f"筛选完成，找到 {len(results)} 张相似图片",
    )
    append_log(
        "ai_clean",
        f"[{get_timestamp()}] ✅ 筛选完成，最佳匹配：{best.get('name', '')}（{best.get('probability', 0)}%）",
    )
    return results


def build_export_zip(targets: List[str], bucket: str = "source"):
    if not targets:
        raise ValueError("请先选择需要导出的图片")
    memory_file, added = create_export_zip_for_targets(targets, bucket=bucket)
    if added == 0:
        raise ValueError("未找到可导出的图片")
    return memory_file, added
