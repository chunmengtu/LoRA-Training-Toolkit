import uuid
from pathlib import Path
from typing import List

from app.core.config import TEMP_DIR
from app.core.utils import allowed_image, sanitize_relative_path
from app.shared.storage.media_store import (
    asset_counts,
    clear_all_images,
    create_export_zip,
    delete_images_and_associations,
    extract_zip_file,
    gather_media_items,
    organize_images,
    save_file_storage,
    tag_images,
)


def list_images(keyword: str | None = None):
    return {"images": gather_media_items("source", keyword), "counts": asset_counts()}


def handle_uploads(files) -> tuple[str, List[str], int]:
    saved: List[str] = []
    skipped = 0
    temp_dir_path = Path(TEMP_DIR)
    temp_dir_path.mkdir(parents=True, exist_ok=True)

    for storage in files:
        filename = storage.filename or ""
        if filename.lower().endswith(".zip"):
            temp_path = temp_dir_path / f"{uuid.uuid4().hex}.zip"
            storage.save(temp_path)
            try:
                _, entries = extract_zip_file(temp_path)
                saved.extend(entries)
            finally:
                temp_path.unlink(missing_ok=True)
            continue

        relative = sanitize_relative_path(filename or f"image_{uuid.uuid4().hex}.png")
        stored_rel = save_file_storage(storage, relative)
        if stored_rel:
            saved.append(stored_rel)
        else:
            skipped += 1

    message = f"成功导入 {len(saved)} 张图片"
    if skipped:
        message += f"，忽略 {skipped} 个不支持的文件"
    return message, saved, skipped


def delete_selected_images(targets: List[str]):
    return delete_images_and_associations(targets)


def clear_images() -> int:
    return clear_all_images()


def organize_selected_images(payload: dict):
    return organize_images(
        targets=payload.get("targets") or [],
        prefix=(payload.get("prefix") or "").strip(),
        start_number=int(payload.get("start_number") or 1),
        apply_prefix=bool(payload.get("apply_prefix", True)),
        apply_sequence=bool(payload.get("apply_sequence", True)),
        keyword=(payload.get("keyword") or "").strip(),
        keyword_action=(payload.get("keyword_action") or "none").lower(),
    )


def apply_tags(targets: List[str], tags: str) -> int:
    if not targets:
        targets = [item["relative_path"] for item in gather_media_items("source")]
    return tag_images(targets, tags)


def validate_generated_upload(file, target_stem: str) -> tuple[bool, str]:
    if not file or not target_stem:
        return False, "缺少文件或目标标识"
    if not allowed_image(file.filename or ""):
        return False, "不支持的文件格式"
    return True, ""


def build_export_zip():
    return create_export_zip("source")
