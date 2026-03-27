from pathlib import Path

from PIL import Image
from flask import send_from_directory

from app.core.config import THUMBNAIL_DIR
from app.core.utils import allowed_image, safe_bucket_path


def serve_thumbnail(bucket: str, filename: str):
    source_path = safe_bucket_path(bucket, filename)
    if not source_path.exists():
        return "Not Found", 404
    if not allowed_image(source_path.name):
        return "Not Supported", 415

    thumbnail_root = Path(THUMBNAIL_DIR) / bucket
    bucket_root = safe_bucket_path(bucket)
    relative_path = source_path.relative_to(bucket_root)
    thumbnail_path = thumbnail_root / relative_path

    if thumbnail_path.exists() and thumbnail_path.stat().st_mtime >= source_path.stat().st_mtime:
        return send_from_directory(str(thumbnail_path.parent), thumbnail_path.name)

    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(source_path) as image:
            image.thumbnail((300, 300))
            image.save(thumbnail_path)
        return send_from_directory(str(thumbnail_path.parent), thumbnail_path.name)
    except Exception:
        return send_from_directory(str(bucket_root), str(relative_path).replace("\\", "/"))
