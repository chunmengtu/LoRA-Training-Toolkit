import os
import shutil
import zipfile
import re
import io
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from ..config import (
    MEDIA_BUCKETS, SUPPORTED_IMAGE_EXTENSIONS,
    SOURCE_BUCKET_DIR, GENERATED_BUCKET_DIR, TAGS_BUCKET_DIR, THUMBNAIL_DIR
)
from ..utils import (
    safe_bucket_path,
    allowed_image,
    unique_path,
    sanitize_relative_path,
    normalize_relative_path
)

def gather_media_items(
    bucket: str,
    keyword: Optional[str] = None,
) -> List[Dict]:
    directory = safe_bucket_path(bucket)
    if not directory.exists():
        return []
    entries: List[Dict] = []
    for root, _, files in os.walk(directory):
        for file_name in files:
            if not allowed_image(file_name):
                continue
            relative = Path(root).relative_to(directory) / file_name
            rel_str = str(relative).replace("\\", "/")
            if keyword and keyword.lower() not in rel_str.lower():
                continue
            file_path = Path(root) / file_name
            stat = file_path.stat()
            url_prefix = "/uploads" if bucket == "source" else f"/media/{bucket}"
            entries.append(
                {
                    "name": file_name,
                    "path": rel_str,
                    "relative_path": rel_str,
                    "bucket": bucket,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "url": f"{url_prefix}/{rel_str}",
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
    if relative_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        return None
    dest_root = safe_bucket_path(bucket)
    destination = unique_path((dest_root / relative_path).resolve())
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_storage.stream.seek(0)
    file_storage.save(destination)
    return str(destination.relative_to(dest_root)).replace("\\", "/")

def extract_zip_file(zip_path: Path) -> Tuple[int, List[str]]:
    saved: List[str] = []
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            relative_path = sanitize_relative_path(member.filename)
            if relative_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
                continue
            dest_root = safe_bucket_path("source")
            destination = unique_path((dest_root / relative_path).resolve())
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member, "r") as source, open(destination, "wb") as target:
                shutil.copyfileobj(source, target)
            saved.append(str(destination.relative_to(dest_root)).replace("\\", "/"))
    return len(saved), saved

def save_generation_outputs(
    payloads: List[bytes],
    relative_path: str,
    source_bucket: str,
    overwrite: bool,
) -> List[str]:
    original_path = safe_bucket_path(source_bucket, relative_path)
    rel_parent = Path(relative_path).parent
    saved_files: List[str] = []

    def _write_bytes(destination: Path, content: bytes) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

    for idx, payload in enumerate(payloads, start=1):
        if overwrite and idx == 1:
            target_bucket = source_bucket
            file_name = Path(relative_path).name
        else:
            target_bucket = "generated"
            stem = Path(relative_path).stem
            suffix = Path(relative_path).suffix or ".png"
            suffix_idx = idx if overwrite else idx
            file_name = f"{stem}_gen{suffix_idx}{suffix}"

        destination_root = safe_bucket_path(target_bucket)
        destination_path = (destination_root / rel_parent / file_name).resolve()
        _write_bytes(destination_path, payload)
        saved_files.append(str(destination_path))

        # 如果要求覆盖，则同步更新原文件
        if overwrite and idx == 1 and destination_path != original_path:
            shutil.copy2(destination_path, original_path)

    return saved_files

def delete_files(paths: List[Path]) -> int:
    removed = 0
    for path in paths:
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)
            removed += 1
    return removed

def organize_images(
    targets: List[str],
    prefix: str,
    start_number: int,
    apply_prefix: bool,
    apply_sequence: bool,
    keyword: str,
    keyword_action: str
) -> Dict:
    base_dir = safe_bucket_path("source")
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
        for root, _, filenames in os.walk(base_dir):
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

    if apply_sequence:
        if prefix:
            pad = max(len(str(start_number + len(files) - 1)), 2)
        else:
            pad = 0
    else:
        pad = 0

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
        new_name = "".join(new_segments) + path.suffix.lower()
        destination = unique_path(path.with_name(new_name))
        path.rename(destination)
        renamed += 1

    summary = f"已重命名 {renamed} 张图片"
    if deleted:
        summary += f"，并删除 {deleted} 张图片"
    return {"ok": True, "message": summary, "renamed": renamed, "deleted": deleted}

def delete_images_and_associations(targets: List[str]) -> Tuple[int, int]:
    paths: List[Path] = []
    for relative in targets:
        normalized = normalize_relative_path(relative)
        try:
            path = safe_bucket_path("source", normalized)
        except ValueError:
            continue
        if path.exists() and path.is_file() and allowed_image(path.name):
            paths.append(path)

    if not paths:
        return 0, 0

    removed = 0
    gen_dir = Path(GENERATED_BUCKET_DIR)
    tags_dir = Path(TAGS_BUCKET_DIR)
    thumb_dir = Path(THUMBNAIL_DIR) / "source"

    for path in paths:
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)
            removed += 1
            
            stem = path.stem
            rel_path = path.relative_to(SOURCE_BUCKET_DIR)
            rel_parent = rel_path.parent
            
            target_gen_dir = (gen_dir / rel_parent).resolve()
            if target_gen_dir.exists():
                for gen_file in target_gen_dir.glob(f"{stem}_gen*"):
                    gen_file.unlink(missing_ok=True)

            (tags_dir / f"{stem}.txt").unlink(missing_ok=True)
            
            target_thumb = (thumb_dir / rel_path).resolve()
            target_thumb.unlink(missing_ok=True)
            
    return len(paths), removed

def clear_all_images() -> int:
    base_dir = safe_bucket_path("source")
    paths: List[Path] = []
    for root, _, filenames in os.walk(base_dir):
        for filename in filenames:
            if allowed_image(filename):
                paths.append(Path(root) / filename)

    if not paths:
        return 0

    removed = delete_files(paths)
    
    def clear_directory(path: Path):
        if path.exists():
            shutil.rmtree(path)
            path.mkdir(parents=True, exist_ok=True)
            
    clear_directory(Path(GENERATED_BUCKET_DIR))
    clear_directory(Path(TAGS_BUCKET_DIR))
    clear_directory(Path(THUMBNAIL_DIR))
    
    return removed

def tag_images(targets: List[str], tags: str) -> int:
    tags_dir = safe_bucket_path("tags")
    count = 0
    
    for relative in targets:
        try:
            src_path = safe_bucket_path("source", relative)
            if not src_path.exists():
                continue
                
            stem = src_path.stem
            tag_file = tags_dir / f"{stem}.txt"
            tag_file.write_text(tags, encoding="utf-8")
            count += 1
        except Exception:
            continue
    return count

def create_export_zip(bucket: str = "source") -> io.BytesIO:
    source_dir = safe_bucket_path(bucket)
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                if allowed_image(file):
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(source_dir)
                    zf.write(file_path, arcname)
    memory_file.seek(0)
    return memory_file

def create_ai_export_zip() -> io.BytesIO:
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Source
        source_dir = safe_bucket_path("source")
        for root, _, files in os.walk(source_dir):
            for file in files:
                if allowed_image(file):
                    file_path = Path(root) / file
                    arcname = f"source/{file_path.relative_to(source_dir)}"
                    zf.write(file_path, arcname)
                    
        # Generated
        gen_dir = safe_bucket_path("generated")
        if gen_dir.exists():
            for root, _, files in os.walk(gen_dir):
                for file in files:
                    if allowed_image(file):
                        file_path = Path(root) / file
                        # Rename logic: remove _genX suffix
                        stem = file_path.stem
                        suffix = file_path.suffix
                        new_stem = re.sub(r"_gen\d+$", "", stem)
                        rel_path = file_path.relative_to(gen_dir)
                        new_rel_path = rel_path.with_name(f"{new_stem}{suffix}")
                        
                        arcname = f"generated/{new_rel_path}"
                        zf.write(file_path, arcname)
                        
        # Tags
        tags_dir = safe_bucket_path("tags")
        if tags_dir.exists():
            for root, _, files in os.walk(tags_dir):
                for file in files:
                    if file.endswith(".txt"):
                        file_path = Path(root) / file
                        arcname = f"tags/{file_path.relative_to(tags_dir)}"
                        zf.write(file_path, arcname)

    memory_file.seek(0)
    return memory_file

def get_ai_pairs(keyword: Optional[str] = None) -> List[Dict]:
    source_images = gather_media_items("source", keyword)
    generated_images = gather_media_items("generated")
    
    gen_map = {}
    for img in generated_images:
        p = Path(img["relative_path"])
        stem = p.stem
        match = re.search(r"^(.*)_gen\d+$", stem)
        if match:
            original_stem = match.group(1)
            if original_stem not in gen_map:
                gen_map[original_stem] = []
            gen_map[original_stem].append(img)
    
    tags_dir = safe_bucket_path("tags")
    
    pairs = []
    for src in source_images:
        src_stem = Path(src["relative_path"]).stem
        
        gens = gen_map.get(src_stem, [])
        gens.sort(key=lambda x: x["modified"], reverse=True)
        
        tag_content = ""
        tag_file = tags_dir / f"{src_stem}.txt"
        if tag_file.exists():
            try:
                tag_content = tag_file.read_text(encoding="utf-8")
            except Exception:
                pass
                
        pairs.append({
            "source": src,
            "generated": gens,
            "tags": tag_content
        })
    return pairs
