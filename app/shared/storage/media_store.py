import io
import os
import re
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.core.config import GENERATED_BUCKET_DIR, MEDIA_BUCKETS, SOURCE_BUCKET_DIR, TAGS_BUCKET_DIR, THUMBNAIL_DIR
from app.core.utils import (
    allowed_image,
    normalize_relative_path,
    safe_bucket_path,
    sanitize_relative_path,
    unique_path,
)


def gather_media_items(bucket: str, keyword: Optional[str] = None) -> List[Dict]:
    directory = safe_bucket_path(bucket)
    if not directory.exists():
        return []

    entries: List[Dict] = []
    for root, _, files in os.walk(directory):
        for file_name in files:
            if not allowed_image(file_name):
                continue
            relative = Path(root).relative_to(directory) / file_name
            relative_path = str(relative).replace("\\", "/")
            if keyword and keyword.lower() not in relative_path.lower():
                continue
            file_path = Path(root) / file_name
            stat = file_path.stat()
            url_prefix = "/uploads" if bucket == "source" else f"/media/{bucket}"
            entries.append(
                {
                    "name": file_name,
                    "path": relative_path,
                    "relative_path": relative_path,
                    "bucket": bucket,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "url": f"{url_prefix}/{relative_path}",
                }
            )
    entries.sort(key=lambda item: item["modified"], reverse=True)
    return entries


def asset_counts() -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for bucket, directory in MEDIA_BUCKETS.items():
        total = 0
        for root, _, files in os.walk(directory):
            for file_name in files:
                if allowed_image(file_name):
                    total += 1
        counts[bucket] = total
    return counts


def save_file_storage(file_storage, relative_path: Path, bucket: str = "source") -> Optional[str]:
    if not allowed_image(relative_path.name):
        return None
    destination_root = safe_bucket_path(bucket)
    destination = unique_path((destination_root / relative_path).resolve())
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_storage.stream.seek(0)
    file_storage.save(destination)
    return str(destination.relative_to(destination_root)).replace("\\", "/")


def extract_zip_file(zip_path: Path) -> Tuple[int, List[str]]:
    saved: List[str] = []
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            relative_path = sanitize_relative_path(member.filename)
            if not allowed_image(relative_path.name):
                continue
            destination_root = safe_bucket_path("source")
            destination = unique_path((destination_root / relative_path).resolve())
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member, "r") as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)
            saved.append(str(destination.relative_to(destination_root)).replace("\\", "/"))
    return len(saved), saved


def save_generation_outputs(
    payloads: List[bytes],
    relative_path: str,
    source_bucket: str,
    overwrite: bool,
) -> List[str]:
    original_path = safe_bucket_path(source_bucket, relative_path)
    relative_parent = Path(relative_path).parent
    saved_files: List[str] = []

    for index, payload in enumerate(payloads, start=1):
        if overwrite and index == 1:
            target_bucket = source_bucket
            file_name = Path(relative_path).name
        else:
            target_bucket = "generated"
            stem = Path(relative_path).stem
            suffix = Path(relative_path).suffix or ".png"
            file_name = f"{stem}_gen{index}{suffix}"

        destination_root = safe_bucket_path(target_bucket)
        destination = (destination_root / relative_parent / file_name).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
        saved_files.append(str(destination))

        if overwrite and index == 1 and destination != original_path:
            shutil.copy2(destination, original_path)

    return saved_files


def organize_images(
    targets: List[str],
    prefix: str,
    start_number: int,
    apply_prefix: bool,
    apply_sequence: bool,
    keyword: str,
    keyword_action: str,
) -> Dict:
    source_root = safe_bucket_path("source")
    files: List[Path] = []

    if targets:
        for relative in targets:
            try:
                path = safe_bucket_path("source", normalize_relative_path(relative))
            except ValueError:
                continue
            if path.exists() and allowed_image(path.name):
                files.append(path)
    else:
        for root, _, filenames in os.walk(source_root):
            for filename in filenames:
                if allowed_image(filename):
                    files.append(Path(root) / filename)

    if not files:
        return {"ok": False, "message": "未找到可操作的图片"}

    def matches(path: Path) -> bool:
        return keyword.lower() in path.name.lower()

    deleted = 0
    if keyword_action in {"filter", "delete", "keep"} and not keyword:
        return {"ok": False, "message": "请输入关键字以使用该操作"}

    if keyword and keyword_action == "filter":
        files = [path for path in files if matches(path)]
    elif keyword and keyword_action == "delete":
        for path in files:
            if matches(path):
                path.unlink(missing_ok=True)
                deleted += 1
        files = [path for path in files if path.exists()]
        return {"ok": True, "message": f"已删除 {deleted} 张图片"}
    elif keyword and keyword_action == "keep":
        for path in files:
            if not matches(path):
                path.unlink(missing_ok=True)
                deleted += 1
        files = [path for path in files if path.exists()]

    if not files:
        return {"ok": False, "message": "筛选后没有剩余图片"}

    pad = max(len(str(start_number + len(files) - 1)), 2) if apply_sequence and prefix else 0
    renamed = 0
    current_number = start_number

    for path in sorted(files):
        new_segments: List[str] = []
        if apply_prefix and prefix:
            new_segments.append(prefix)
        if apply_sequence:
            new_segments.append(str(current_number).zfill(pad))
            current_number += 1
        if not new_segments:
            continue
        destination = unique_path(path.with_name(f"{''.join(new_segments)}{path.suffix.lower()}"))
        path.rename(destination)
        renamed += 1

    summary = f"已重命名 {renamed} 张图片"
    if deleted:
        summary += f"，并删除 {deleted} 张图片"
    return {"ok": True, "message": summary, "renamed": renamed, "deleted": deleted}


def delete_images_and_associations(targets: List[str]) -> Tuple[int, int]:
    paths: List[Path] = []
    for relative in targets:
        try:
            path = safe_bucket_path("source", normalize_relative_path(relative))
        except ValueError:
            continue
        if path.exists() and path.is_file() and allowed_image(path.name):
            paths.append(path)

    if not paths:
        return 0, 0

    removed = 0
    generated_root = Path(GENERATED_BUCKET_DIR)
    tags_root = Path(TAGS_BUCKET_DIR)
    thumbnail_root = Path(THUMBNAIL_DIR) / "source"

    for path in paths:
        path.unlink(missing_ok=True)
        removed += 1
        stem = path.stem
        relative_path = path.relative_to(SOURCE_BUCKET_DIR)
        relative_parent = relative_path.parent

        target_generated_dir = (generated_root / relative_parent).resolve()
        if target_generated_dir.exists():
            for generated_file in target_generated_dir.glob(f"{stem}_gen*"):
                generated_file.unlink(missing_ok=True)

        (tags_root / f"{stem}.txt").unlink(missing_ok=True)
        (thumbnail_root / relative_path).unlink(missing_ok=True)

    return len(paths), removed


def clear_all_images() -> int:
    source_root = safe_bucket_path("source")
    paths: List[Path] = []
    for root, _, filenames in os.walk(source_root):
        for filename in filenames:
            if allowed_image(filename):
                paths.append(Path(root) / filename)

    if not paths:
        return 0

    removed = 0
    for path in paths:
        path.unlink(missing_ok=True)
        removed += 1

    for path in (Path(GENERATED_BUCKET_DIR), Path(TAGS_BUCKET_DIR), Path(THUMBNAIL_DIR)):
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)

    return removed


def tag_images(targets: List[str], tags: str) -> int:
    tags_root = safe_bucket_path("tags")
    count = 0
    for relative in targets:
        try:
            source_path = safe_bucket_path("source", normalize_relative_path(relative))
        except ValueError:
            continue
        if not source_path.exists():
            continue
        (tags_root / f"{source_path.stem}.txt").write_text(tags, encoding="utf-8")
        count += 1
    return count


def create_export_zip(bucket: str = "source") -> io.BytesIO:
    source_root = safe_bucket_path(bucket)
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as archive:
        for root, _, files in os.walk(source_root):
            for file_name in files:
                if allowed_image(file_name):
                    file_path = Path(root) / file_name
                    archive.write(file_path, file_path.relative_to(source_root))
    memory_file.seek(0)
    return memory_file


def create_ai_export_zip() -> io.BytesIO:
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as archive:
        source_root = safe_bucket_path("source")
        for root, _, files in os.walk(source_root):
            for file_name in files:
                if allowed_image(file_name):
                    file_path = Path(root) / file_name
                    archive.write(file_path, f"source/{file_path.relative_to(source_root)}")

        generated_root = safe_bucket_path("generated")
        for root, _, files in os.walk(generated_root):
            for file_name in files:
                if allowed_image(file_name):
                    file_path = Path(root) / file_name
                    cleaned_stem = re.sub(r"_gen\d+$", "", file_path.stem)
                    relative_path = file_path.relative_to(generated_root)
                    archive.write(
                        file_path,
                        f"generated/{relative_path.with_name(f'{cleaned_stem}{file_path.suffix}')}",
                    )

        tags_root = safe_bucket_path("tags")
        for root, _, files in os.walk(tags_root):
            for file_name in files:
                if file_name.endswith(".txt"):
                    file_path = Path(root) / file_name
                    archive.write(file_path, f"tags/{file_path.relative_to(tags_root)}")

    memory_file.seek(0)
    return memory_file


def get_ai_pairs(keyword: Optional[str] = None) -> List[Dict]:
    source_images = gather_media_items("source", keyword)
    generated_images = gather_media_items("generated")
    generated_map: Dict[str, List[Dict]] = {}

    for image in generated_images:
        stem = Path(image["relative_path"]).stem
        match = re.search(r"^(.*)_gen\d+$", stem)
        if not match:
            continue
        generated_map.setdefault(match.group(1), []).append(image)

    tags_root = safe_bucket_path("tags")
    pairs = []
    for source in source_images:
        source_stem = Path(source["relative_path"]).stem
        generated_items = generated_map.get(source_stem, [])
        generated_items.sort(key=lambda item: item["modified"], reverse=True)

        tag_content = ""
        tag_file = tags_root / f"{source_stem}.txt"
        if tag_file.exists():
            try:
                tag_content = tag_file.read_text(encoding="utf-8")
            except Exception:
                tag_content = ""

        pairs.append({"source": source, "generated": generated_items, "tags": tag_content})
    return pairs
