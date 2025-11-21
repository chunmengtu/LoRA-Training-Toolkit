import os
import subprocess
import uuid
import datetime
import platform
import json
import re
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import URLError
from typing import Dict
from werkzeug.utils import secure_filename

from .config import (
    BASE_MODEL_DIR,
    WORKSPACE_ROOT,
    SOURCE_BUCKET_DIR,
    GENERATED_BUCKET_DIR,
    TAGS_BUCKET_DIR,
    TEMP_DIR,
    THUMBNAIL_DIR,
    MEDIA_BUCKETS,
    SUPPORTED_IMAGE_EXTENSIONS,
    IS_LINUX,
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
        os.makedirs(path, exist_ok=True)

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
    cleaned = relative.strip().lstrip("./\\")
    cleaned = cleaned.replace("\\", "/")
    return cleaned

def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    counter = 1
    stem = path.stem
    suffix = path.suffix
    while True:
        candidate = path.with_name(f"{stem}_{counter}{suffix}")
        if not candidate.exists():
            return candidate
        counter += 1

def sanitize_relative_path(raw: str) -> Path:
    normalized = normalize_relative_path(raw or "")
    parts = [
        secure_filename(part)
        for part in Path(normalized).parts
        if part not in ("", ".", "..")
    ]
    if not parts:
        parts = [secure_filename(Path(raw or f"image_{uuid.uuid4().hex}").name)]
    sanitized = Path(*parts)
    return sanitized

def windows_curl_probe(url: str) -> bool:
    """Use curl with optional SOCKS5 proxy to verify connectivity on Windows."""
    socks_proxy = os.environ.get("SOCKS5_PROXY")
    command = [
        "curl",
        "--max-time",
        "8",
        "--silent",
        "--output",
        os.devnull,
        "--write-out",
        "%{http_code}",
    ]
    if socks_proxy:
        command.extend(["--socks5", socks_proxy])
    command.append(url)
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        status_line = (result.stdout or "").strip()
        return status_line.startswith("2") or status_line.startswith("3")
    except FileNotFoundError:
        return False

def linux_http_probe(url: str) -> bool:
    """Use urllib to perform a lightweight HTTPS request on Linux."""
    try:
        with urllib_request.urlopen(url, timeout=8) as response:
            status = getattr(response, "status", None)
            return bool(status and 200 <= status < 400)
    except URLError:
        return False
    except Exception:
        return False

def can_access_google() -> bool:
    probe_url = "https://www.google.com/generate_204"
    if IS_LINUX:
        return linux_http_probe(probe_url)
    return windows_curl_probe(probe_url)

def check_update(repo: str, current_version: str) -> Dict:
    try:
        url = f"https://gitee.com/api/v5/repos/{repo}/releases/latest"
        req = urllib_request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib_request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            
        tag_name = data.get("tag_name", "")
        latest_version = re.sub(r'^[vV]', '', tag_name)
        
        body = data.get("body", "")
        name = data.get("name", "")
        html_url = data.get("html_url", "")
        
        if not html_url:
            html_url = f"https://gitee.com/{repo}/releases"
        
        return {
            "ok": True,
            "current_version": current_version,
            "latest_version": latest_version,
            "release_name": name,
            "release_notes": body,
            "release_url": html_url
        }
    except Exception as e:
        return {"ok": False, "message": f"检查更新失败: {str(e)}"}
