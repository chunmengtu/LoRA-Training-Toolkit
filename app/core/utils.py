import datetime
import json
import re
import uuid
from pathlib import Path
from typing import Dict
from urllib import request as urllib_request
from urllib.parse import urlparse

from werkzeug.utils import secure_filename

from .config import (
    BASE_MODEL_DIR,
    GENERATED_BUCKET_DIR,
    MEDIA_BUCKETS,
    SOURCE_BUCKET_DIR,
    SUPPORTED_IMAGE_EXTENSIONS,
    TAGS_BUCKET_DIR,
    TEMP_DIR,
    THUMBNAIL_DIR,
    WORKSPACE_ROOT,
)


def get_timestamp() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def ensure_workspace() -> None:
    for path in (
        BASE_MODEL_DIR,
        WORKSPACE_ROOT,
        SOURCE_BUCKET_DIR,
        GENERATED_BUCKET_DIR,
        TAGS_BUCKET_DIR,
        TEMP_DIR,
        THUMBNAIL_DIR,
    ):
        Path(path).mkdir(parents=True, exist_ok=True)


def safe_bucket_path(bucket: str, relative_path: str = "") -> Path:
    if bucket not in MEDIA_BUCKETS:
        raise ValueError("未知的图像分类")
    base_path = Path(MEDIA_BUCKETS[bucket]).resolve()
    target_path = (base_path / relative_path).resolve()
    if not str(target_path).startswith(str(base_path)):
        raise ValueError("非法路径")
    return target_path


def allowed_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS


def normalize_relative_path(relative: str) -> str:
    cleaned = (relative or "").strip().lstrip("./\\")
    return cleaned.replace("\\", "/")


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    counter = 1
    while True:
        candidate = path.with_name(f"{path.stem}_{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def sanitize_relative_path(raw: str) -> Path:
    normalized = normalize_relative_path(raw)
    parts = [
        secure_filename(part)
        for part in Path(normalized).parts
        if part not in ("", ".", "..")
    ]
    if not parts:
        parts = [secure_filename(Path(raw or f"image_{uuid.uuid4().hex}").name)]
    return Path(*parts)


def is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def check_update(repo: str, current_version: str) -> Dict:
    try:
        url = f"https://gitee.com/api/v5/repos/{repo}/releases/latest"
        req = urllib_request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib_request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))

        latest_version = re.sub(r"^[vV]", "", data.get("tag_name", ""))
        return {
            "ok": True,
            "current_version": current_version,
            "latest_version": latest_version,
            "release_name": data.get("name", ""),
            "release_notes": data.get("body", ""),
            "release_url": data.get("html_url") or f"https://gitee.com/{repo}/releases",
        }
    except Exception as exc:
        return {"ok": False, "message": f"检查更新失败: {exc}"}
