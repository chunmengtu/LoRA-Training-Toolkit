import datetime
import os
import platform
import shutil
import subprocess
import threading
import uuid
import zipfile
import io
import re
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib import request as urllib_request
from urllib.error import URLError
from PIL import Image

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_from_directory,
    url_for,
    send_file,
)
from werkzeug.utils import secure_filename

app = Flask(__name__)

CURRENT_VERSION = "0.0.4"
GITEE_REPO = "rcangbaohz/lora-training-toolkit"

SYSTEM_NAME = platform.system()
IS_LINUX = SYSTEM_NAME.lower() == "linux"

BASE_MODEL_DIR = (
    "/root/autodl-tmp" if IS_LINUX else os.path.join(os.getcwd(), "autodl-tmp")
)
WORKSPACE_ROOT = os.path.join(BASE_MODEL_DIR, "image_workspace")
SOURCE_BUCKET_DIR = os.path.join(WORKSPACE_ROOT, "source")
GENERATED_BUCKET_DIR = os.path.join(WORKSPACE_ROOT, "generated")
TAGS_BUCKET_DIR = os.path.join(WORKSPACE_ROOT, "tags")
TEMP_DIR = os.path.join(WORKSPACE_ROOT, "tmp")
THUMBNAIL_DIR = os.path.join(WORKSPACE_ROOT, "thumbnails")

MEDIA_BUCKETS = {
    "source": SOURCE_BUCKET_DIR,
    "generated": GENERATED_BUCKET_DIR,
    "tags": TAGS_BUCKET_DIR,
}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
MAX_RECENT_LOG_LINES = 400

GEMINI_MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-pro-image-preview")

task_state: Dict[str, Dict] = {
    "setup": {
        "status": "idle",
        "progress": 0,
        "message": "尚未开始",
        "log": [],
        "last_updated": None,
    },
    "download": {
        "status": "idle",
        "progress": 0,
        "message": "等待操作",
        "log": [],
        "last_updated": None,
        "model": None,
        "source": None,
    },
    "image_generation": {
        "status": "idle",
        "progress": 0,
        "message": "等待生成任务",
        "log": [],
        "last_updated": None,
        "prompt": "",
        "total": 0,
        "processed": 0,
        "bucket": "source",
    },
}

state_lock = threading.Lock()


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


ensure_workspace()


def _safe_bucket_path(bucket: str, relative_path: str = "") -> Path:
    if bucket not in MEDIA_BUCKETS:
        raise ValueError("未知的图像分类")
    base_path = Path(MEDIA_BUCKETS[bucket]).resolve()
    target_path = (base_path / relative_path).resolve()
    if not str(target_path).startswith(str(base_path)):
        raise ValueError("非法路径")
    return target_path


def _allowed_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS


def _normalize_relative_path(relative: str) -> str:
    cleaned = relative.strip().lstrip("./\\")
    cleaned = cleaned.replace("\\", "/")
    return cleaned


def _gather_media_items(
    bucket: str,
    keyword: Optional[str] = None,
) -> List[Dict]:
    directory = _safe_bucket_path(bucket)
    if not directory.exists():
        return []
    entries: List[Dict] = []
    for root, _, files in os.walk(directory):
        for file_name in files:
            if not _allowed_image(file_name):
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


def _asset_counts() -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for bucket, directory in MEDIA_BUCKETS.items():
        total = 0
        for root, _, files in os.walk(directory):
            for file_name in files:
                if _allowed_image(file_name):
                    total += 1
        counts[bucket] = total
    return counts


def _unique_path(path: Path) -> Path:
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


def _sanitize_relative_path(raw: str) -> Path:
    normalized = _normalize_relative_path(raw or "")
    parts = [
        secure_filename(part)
        for part in Path(normalized).parts
        if part not in ("", ".", "..")
    ]
    if not parts:
        parts = [secure_filename(Path(raw or f"image_{uuid.uuid4().hex}").name)]
    sanitized = Path(*parts)
    return sanitized


def _save_file_storage(file_storage, relative_path: Path, bucket: str = "source") -> Optional[str]:
    if relative_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        return None
    dest_root = _safe_bucket_path(bucket)
    destination = _unique_path((dest_root / relative_path).resolve())
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_storage.stream.seek(0)
    file_storage.save(destination)
    return str(destination.relative_to(dest_root)).replace("\\", "/")


def _extract_zip_file(zip_path: Path) -> Tuple[int, List[str]]:
    saved: List[str] = []
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            relative_path = _sanitize_relative_path(member.filename)
            if relative_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
                continue
            dest_root = _safe_bucket_path("source")
            destination = _unique_path((dest_root / relative_path).resolve())
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member, "r") as source, open(destination, "wb") as target:
                shutil.copyfileobj(source, target)
            saved.append(str(destination.relative_to(dest_root)).replace("\\", "/"))
    return len(saved), saved


LINUX_BOOTSTRAP_COMMANDS: List[str] = [
    "pip install huggingface_hub",
    "pip install modelscope",
    "curl -sL https://deb.nodesource.com/setup_20.x | bash -",
    "apt install -y nodejs",
    "mkdir -p /root/autodl-tmp && cd /root/autodl-tmp && if [ ! -d ai-toolkit ]; then git clone https://github.com/ostris/ai-toolkit.git; else git -C ai-toolkit pull; fi",
    "cd /root/autodl-tmp/ai-toolkit && pip install -r requirements.txt",
]
WINDOWS_SETUP_SCRIPT = os.path.join(os.getcwd(), "AI-Toolkit-Easy-Install.bat")
WINDOWS_BOOTSTRAP_COMMANDS: List[str] = [
    f'call "{WINDOWS_SETUP_SCRIPT}"',
]

DOWNLOAD_COMMANDS = {
    "modelscope": {
        "Qwen-Image-Edit-2509": "modelscope download --model Qwen/Qwen-Image-Edit-2509 --local_dir \"{target}\"",
        "FLUX.1-Kontext-dev": "modelscope download --model black-forest-labs/FLUX.1-Kontext-dev --local_dir \"{target}\"",
    },
    "huggingface": {
        "Qwen-Image-Edit-2509": "huggingface-cli download Qwen/Qwen-Image-Edit-2509 --local-dir \"{target}\"",
        "FLUX.1-Kontext-dev": "huggingface-cli download black-forest-labs/FLUX.1-Kontext-dev --local-dir \"{target}\"",
    },
}


def _timestamp() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _append_log(section: str, line: str) -> None:
    with state_lock:
        logs = task_state[section]["log"]
        logs.append(line)
        task_state[section]["log"] = logs[-MAX_RECENT_LOG_LINES:]
        task_state[section]["last_updated"] = _timestamp()


def _set_state(section: str, **kwargs) -> None:
    with state_lock:
        task_state[section].update(kwargs)
        task_state[section]["last_updated"] = _timestamp()


def _windows_curl_probe(url: str) -> bool:
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


def _linux_http_probe(url: str) -> bool:
    """Use urllib to perform a lightweight HTTPS request on Linux."""
    try:
        with urllib_request.urlopen(url, timeout=8) as response:
            status = getattr(response, "status", None)
            return bool(status and 200 <= status < 400)
    except URLError:
        return False
    except Exception:
        return False


def _can_access_google() -> bool:
    probe_url = "https://www.google.com/generate_204"
    if IS_LINUX:
        return _linux_http_probe(probe_url)
    return _windows_curl_probe(probe_url)


def _run_command_sequence(section: str, commands: List[str]) -> None:
    total = len(commands)
    _set_state(section, status="running", progress=0)
    for idx, command in enumerate(commands, start=1):
        _append_log(section, f"[{_timestamp()}] $ {command}")
        try:
            proc = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            for line in proc.stdout or []:
                clean_line = line.rstrip()
                if clean_line:
                    _append_log(section, clean_line)
                    _set_state(section, message=clean_line)
            return_code = proc.wait()
        except Exception as exc:  # noqa: BLE001
            _append_log(section, f"执行异常: {exc}")
            _set_state(section, status="error", message=str(exc))
            return

        if return_code != 0:
            _append_log(section, f"命令失败，退出码 {return_code}")
            _set_state(
                section,
                status="error",
                message=f"命令失败，退出码 {return_code}",
                progress=int(idx / total * 100),
            )
            return

        progress = int(idx / total * 100)
        _set_state(section, progress=progress)

    _set_state(section, status="success", message="全部命令执行完毕", progress=100)


def _save_generation_outputs(
    payloads: List[bytes],
    relative_path: str,
    source_bucket: str,
    overwrite: bool,
) -> List[str]:
    original_path = _safe_bucket_path(source_bucket, relative_path)
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

        destination_root = _safe_bucket_path(target_bucket)
        destination_path = (destination_root / rel_parent / file_name).resolve()
        _write_bytes(destination_path, payload)
        saved_files.append(str(destination_path))

        # 如果要求覆盖，则同步更新原文件
        if overwrite and idx == 1 and destination_path != original_path:
            shutil.copy2(destination_path, original_path)

    return saved_files


def _delete_files(paths: List[Path]) -> int:
    removed = 0
    for path in paths:
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)
            removed += 1
    return removed


def _load_vertex_components():
    try:
        import google.auth  # type: ignore
        import vertexai  # type: ignore
        from vertexai.preview.generative_models import (  # type: ignore
            GenerativeModel,
            GenerationConfig,
            Image as VertexImage,
            Part,
        )
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "无法加载 Vertex AI SDK，请确认已安装 google-auth 与 vertexai 相关依赖"
        ) from exc

    return google.auth, vertexai, GenerativeModel, GenerationConfig, VertexImage, Part


def _generate_images_worker(
    prompt: str,
    filenames: List[str],
    bucket: str,
    overwrite: bool,
    key_path: str,
    project_id: str,
    location: str,
) -> None:
    total = len(filenames)
    _set_state(
        "image_generation",
        status="running",
        progress=0,
        processed=0,
        total=total,
        message="正在初始化 Vertex AI",
        prompt=prompt,
        bucket=bucket,
    )
    _append_log("image_generation", f"[{_timestamp()}] 🧠 开始批量生成任务，共 {total} 张图片")

    try:
        (
            google_auth,
            vertexai,
            GenerativeModel,
            GenerationConfig,
            VertexImage,
            Part,
        ) = _load_vertex_components()
        credentials, _ = google_auth.load_credentials_from_file(key_path)
        vertexai.init(project=project_id, location=location, credentials=credentials)
        model = GenerativeModel(GEMINI_MODEL_NAME)
        generation_config = GenerationConfig(temperature=0.4, top_p=0.95, top_k=32)
    except Exception as exc:  # noqa: BLE001
        _append_log("image_generation", f"[{_timestamp()}] ❌ 初始化失败：{exc}")
        _set_state("image_generation", status="error", message=str(exc))
        return

    # Queue format: [(relative_path, attempt_count)]
    queue: List[Tuple[str, int]] = [(f, 0) for f in filenames]
    processed_count = 0
    
    MAX_RETRIES = 3
    RPM_DELAY = 7  # 10 RPM = 6s/req. Use 7s to be safe.

    while queue:
        relative_path, attempts = queue.pop(0)
        
        try:
            source_path = _safe_bucket_path(bucket, relative_path)
        except ValueError as exc:
            _append_log("image_generation", f"[{_timestamp()}] ⚠️ 跳过非法路径：{relative_path} ({exc})")
            processed_count += 1
            continue

        if not source_path.exists():
            _append_log("image_generation", f"[{_timestamp()}] ⚠️ 找不到文件：{relative_path}")
            processed_count += 1
            continue

        _append_log("image_generation", f"[{_timestamp()}] 🎯 正在生成：{relative_path} (第 {attempts + 1} 次尝试)")
        
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

            saved = _save_generation_outputs(payloads, relative_path, bucket, overwrite)
            _append_log(
                "image_generation",
                f"[{_timestamp()}] ✅ 完成 {relative_path}，输出 {len(saved)} 个文件",
            )
            success = True
            processed_count += 1
            
        except Exception as exc:  # noqa: BLE001
            _append_log(
                "image_generation",
                f"[{_timestamp()}] ❌ 生成 {relative_path} 失败：{exc}",
            )
            attempts += 1
            if attempts < MAX_RETRIES:
                _append_log("image_generation", f"[{_timestamp()}] 🔄 已重新加入队列，稍后重试...")
                queue.append((relative_path, attempts))
            else:
                _append_log("image_generation", f"[{_timestamp()}] 🚫 达到最大重试次数，跳过此图片")
                processed_count += 1

        # RPM Rate Limiting
        # Wait regardless of success or failure to respect API limits
        # Unless queue is empty (done)
        if queue:
             _append_log("image_generation", f"[{_timestamp()}] ⏳ 等待 {RPM_DELAY} 秒以满足 API 限制...")
             time.sleep(RPM_DELAY)

        progress = int(processed_count / total * 100)
        _set_state(
            "image_generation",
            progress=progress,
            processed=processed_count,
            message=f"已处理 {processed_count}/{total} 张图片 (队列剩余 {len(queue)})",
        )

    _set_state("image_generation", status="success", message="全部图片生成完成", progress=100)


def _ensure_model_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def run_setup_pipeline(github_accelerator: bool = False) -> None:
    if IS_LINUX:
        commands = list(LINUX_BOOTSTRAP_COMMANDS)
        if github_accelerator:
            # Replace github.com with ghfast.top/https://github.com
            new_commands = []
            for cmd in commands:
                if "git clone https://github.com" in cmd:
                    cmd = cmd.replace(
                        "git clone https://github.com",
                        "git clone https://ghfast.top/https://github.com"
                    )
                new_commands.append(cmd)
            commands = new_commands
            
        _run_command_sequence("setup", commands)
        return

    if not os.path.exists(WINDOWS_SETUP_SCRIPT):
        _set_state(
            "setup",
            status="error",
            message="找不到 AI-Toolkit-Easy-Install.bat，请确认脚本存在于项目根目录",
        )
        return

    _run_command_sequence("setup", WINDOWS_BOOTSTRAP_COMMANDS)


def run_download_pipeline(model_name: str, source: str) -> None:
    if source not in DOWNLOAD_COMMANDS or model_name not in DOWNLOAD_COMMANDS[source]:
        _set_state("download", status="error", message="无效的模型或来源选择")
        return
    command_template = DOWNLOAD_COMMANDS[source][model_name]
    target_dir = os.path.join(BASE_MODEL_DIR, model_name)
    _ensure_model_dir(target_dir)

    _set_state(
        "download",
        status="running",
        progress=5,
        message=f"准备下载 {model_name}",
        model=model_name,
        source=source,
    )
    final_command = command_template.format(target=target_dir)
    _run_command_sequence("download", [final_command])


@app.route("/")
def index():
    return render_template(
        "index.html",
        system=SYSTEM_NAME,
        is_linux=IS_LINUX,
        base_dir=BASE_MODEL_DIR,
    )


@app.route("/uploads/<path:filename>")
def serve_upload(filename: str):
    try:
        safe_dir = _safe_bucket_path("source")
        safe_path = _safe_bucket_path("source", filename)
        if not safe_path.exists():
            return "Not Found", 404
        rel_path = str(safe_path.relative_to(safe_dir)).replace("\\", "/")
        return send_from_directory(str(safe_dir), rel_path)
    except ValueError:
        return "Forbidden", 403


@app.route("/media/<bucket>/<path:filename>")
def serve_media(bucket: str, filename: str):
    try:
        safe_dir = _safe_bucket_path(bucket)
        safe_path = _safe_bucket_path(bucket, filename)
        if not safe_path.exists():
            return "Not Found", 404
        directory = str(safe_dir)
        rel_path = str(safe_path.relative_to(safe_dir)).replace("\\", "/")
        return send_from_directory(directory, rel_path)
    except ValueError:
        return "Forbidden", 403


@app.route("/api/thumbnail/<bucket>/<path:filename>")
def serve_thumbnail(bucket: str, filename: str):
    try:
        source_path = _safe_bucket_path(bucket, filename)
        if not source_path.exists():
            return "Not Found", 404

        # Thumbnails only for supported images
        if not _allowed_image(source_path.name):
            return "Not Supported", 415

        # Determine thumbnail path
        # We replicate directory structure in thumbnails/bucket/
        thumb_root = Path(THUMBNAIL_DIR) / bucket
        
        # Calculate relative path from bucket root to keep structure
        bucket_root = _safe_bucket_path(bucket)
        rel_path = source_path.relative_to(bucket_root)
        
        thumb_path = thumb_root / rel_path
        
        # Check if thumbnail exists and is newer than source
        if thumb_path.exists():
             if thumb_path.stat().st_mtime >= source_path.stat().st_mtime:
                 return send_from_directory(str(thumb_path.parent), thumb_path.name)
        
        # Create thumbnail
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(source_path) as img:
                img.thumbnail((300, 300))
                # Convert to RGB if RGBA and format doesn't support transparency (like JPEG)
                # But we just save as original format usually, or PNG/JPEG.
                # Let's save as same format or PNG if complex.
                # To be safe and simple, save as original format if possible, or PNG.
                # Using original format.
                img.save(thumb_path)
        except Exception as e:
            print(f"Thumbnail generation failed for {source_path}: {e}")
            # Fallback to original image
            return send_from_directory(str(bucket_root), str(rel_path))
            
        return send_from_directory(str(thumb_path.parent), thumb_path.name)
            
    except ValueError:
        return "Forbidden", 403



@app.route("/api/status")
def api_status():
    with state_lock:
        payload = {
            "os": SYSTEM_NAME,
            "is_linux": IS_LINUX,
            "base_dir": BASE_MODEL_DIR,
            "setup": dict(task_state["setup"]),
            "download": dict(task_state["download"]),
            "image_generation": dict(task_state["image_generation"]),
            "version": CURRENT_VERSION,
        }
    return jsonify(payload)


@app.route("/api/check_update")
def api_check_update():
    try:
        url = f"https://gitee.com/api/v5/repos/{GITEE_REPO}/releases/latest"
        req = urllib_request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib_request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            
        tag_name = data.get("tag_name", "")
        # Support v1.0.0 or V1.0.0
        latest_version = re.sub(r'^[vV]', '', tag_name)
        
        body = data.get("body", "")
        name = data.get("name", "")
        html_url = data.get("html_url", "")
        
        # Fallback if release URL is missing
        if not html_url:
            html_url = f"https://gitee.com/{GITEE_REPO}/releases"
        
        return jsonify({
            "ok": True,
            "current_version": CURRENT_VERSION,
            "latest_version": latest_version,
            "release_name": name,
            "release_notes": body,
            "release_url": html_url
        })
    except Exception as e:
        return jsonify({"ok": False, "message": f"检查更新失败: {str(e)}"}), 500



@app.route("/api/run-setup", methods=["POST"])
def api_run_setup():
    data = request.get_json(force=True) or {}
    github_accelerator = bool(data.get("github_accelerator", False))
    
    with state_lock:
        if task_state["setup"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有安装任务正在执行"}), 409
        task_state["setup"] = {
            **task_state["setup"],
            "status": "queued",
            "progress": 0,
            "message": "即将开始",
            "log": [],
        }
    threading.Thread(target=run_setup_pipeline, args=(github_accelerator,), daemon=True).start()
    return jsonify({"ok": True, "message": "安装流程已启动"})


@app.route("/api/run-start", methods=["POST"])
def api_run_start():
    if IS_LINUX:
        command = "cd /root/autodl-tmp/ai-toolkit/ui && sed -i 's/--port [0-9]*/--port 6006/g' package.json && npm run build_and_start"
        # Run in background, don't wait
        try:
            subprocess.Popen(command, shell=True, executable="/bin/bash")
            return jsonify({"ok": True, "message": "启动命令已在后台执行"})
        except Exception as e:
            return jsonify({"ok": False, "message": f"启动失败: {e}"}), 500
    else:
        # Windows
        script_path = os.path.join(os.getcwd(), "Start-AI-Toolkit.bat")
        if not os.path.exists(script_path):
             return jsonify({"ok": False, "message": "找不到 Start-AI-Toolkit.bat"}), 404
        try:
            # Use start to open in new window if possible, or just run
            # os.startfile is Windows only
            os.startfile(script_path)
            return jsonify({"ok": True, "message": "已尝试启动 Start-AI-Toolkit.bat"})
        except Exception as e:
            return jsonify({"ok": False, "message": f"启动失败: {e}"}), 500


@app.route("/api/download", methods=["POST"])
def api_download():
    data = request.get_json(force=True)
    model_name = data.get("model")
    source = data.get("source")
    if not model_name or not source:
        return jsonify({"ok": False, "message": "请选择模型和下载来源"}), 400
    with state_lock:
        if task_state["download"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有下载任务正在执行"}), 409
        task_state["download"] = {
            **task_state["download"],
            "status": "queued",
            "progress": 0,
            "message": "准备中",
            "log": [],
            "model": model_name,
            "source": source,
        }
    threading.Thread(
        target=run_download_pipeline, args=(model_name, source), daemon=True
    ).start()
    return jsonify({"ok": True, "message": "模型下载流程已启动"})


@app.route("/api/images/list")
def api_images_list():
    keyword = request.args.get("keyword", "").strip() or None
    images = _gather_media_items("source", keyword)
    return jsonify(
        {
            "ok": True,
            "images": images,
            "counts": _asset_counts(),
        }
    )


@app.route("/api/ai/list")
def api_ai_list():
    keyword = request.args.get("keyword", "").strip() or None
    source_images = _gather_media_items("source", keyword)
    generated_images = _gather_media_items("generated")
    
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
    
    tags_dir = _safe_bucket_path("tags")
    
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
        
    return jsonify({
        "ok": True,
        "pairs": pairs,
        "counts": _asset_counts()
    })


@app.route("/api/images/upload", methods=["POST"])
def api_images_upload():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"ok": False, "message": "未检测到上传文件"}), 400

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
                count, entries = _extract_zip_file(temp_path)
                saved.extend(entries)
            finally:
                temp_path.unlink(missing_ok=True)
            continue

        relative = _sanitize_relative_path(filename or f"image_{uuid.uuid4().hex}.png")
        stored_rel = _save_file_storage(storage, relative)
        if stored_rel:
            saved.append(stored_rel)
        else:
            skipped += 1

    message = f"成功导入 {len(saved)} 张图片"
    if skipped:
        message += f"，忽略 {skipped} 个不支持的文件"
    return jsonify(
        {
            "ok": True,
            "message": message,
            "added": len(saved),
            "skipped": skipped,
            "items": saved,
        }
    )


@app.route("/api/ai/upload_generated", methods=["POST"])
def api_ai_upload_generated():
    file = request.files.get("file")
    target_stem = request.form.get("target_stem")
    
    if not file or not target_stem:
        return jsonify({"ok": False, "message": "缺少文件或目标标识"}), 400
        
    # Determine extension
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_IMAGE_EXTENSIONS:
        return jsonify({"ok": False, "message": "不支持的文件格式"}), 400
        
    # Construct filename: {stem}_gen1{ext}
    # We use _gen1 to match the pattern expected by api_ai_list
    # If it already exists, we overwrite it (manual override)
    filename = f"{target_stem}_gen1{ext}"
    
    try:
        saved_path = _save_file_storage(file, Path(filename), bucket="generated")
        return jsonify({"ok": True, "message": "上传成功", "path": saved_path})
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500


@app.route("/api/images/organize", methods=["POST"])
def api_images_organize():
    data = request.get_json(force=True)
    prefix = (data.get("prefix") or "").strip()
    start_number = int(data.get("start_number") or 1)
    apply_prefix = bool(data.get("apply_prefix", True))
    apply_sequence = bool(data.get("apply_sequence", True))
    keyword = (data.get("keyword") or "").strip()
    keyword_action = (data.get("keyword_action") or "none").lower()
    targets = data.get("targets") or []

    if not apply_prefix and not apply_sequence:
        return jsonify({"ok": False, "message": "请至少勾选前缀或序号其中一项"}), 400

    base_dir = _safe_bucket_path("source")
    files: List[Path] = []
    if targets:
        for relative in targets:
            try:
                path = _safe_bucket_path("source", _normalize_relative_path(relative))
            except ValueError:
                continue
            if path.exists() and _allowed_image(path.name):
                files.append(path)
    else:
        for root, _, filenames in os.walk(base_dir):
            for filename in filenames:
                if _allowed_image(filename):
                    files.append(Path(root) / filename)

    if not files:
        return jsonify({"ok": False, "message": "未找到可操作的图片"}), 400

    def matches(path: Path) -> bool:
        return keyword.lower() in path.name.lower()

    deleted = 0
    if keyword_action in {"filter", "delete", "keep"} and not keyword:
        return jsonify({"ok": False, "message": "请输入关键字以使用该操作"}), 400

    if keyword and keyword_action == "filter":
        files = [path for path in files if matches(path)]
    elif keyword and keyword_action == "delete":
        for path in files:
            if matches(path):
                path.unlink(missing_ok=True)
                deleted += 1
        files = [path for path in files if path.exists()]
        return jsonify({"ok": True, "message": f"已删除 {deleted} 张图片"})
    elif keyword and keyword_action == "keep":
        for path in files:
            if not matches(path):
                path.unlink(missing_ok=True)
                deleted += 1
        files = [path for path in files if path.exists()]

    if not files:
        return jsonify({"ok": False, "message": "筛选后没有剩余图片"}), 400

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
        destination = _unique_path(path.with_name(new_name))
        path.rename(destination)
        renamed += 1

    summary = f"已重命名 {renamed} 张图片"
    if deleted:
        summary += f"，并删除 {deleted} 张图片"
    return jsonify({"ok": True, "message": summary, "renamed": renamed, "deleted": deleted})


@app.route("/api/images/delete", methods=["POST"])
def api_images_delete():
    data = request.get_json(force=True)
    targets = data.get("targets") or []
    if not targets:
        return jsonify({"ok": False, "message": "请至少选择一张需要删除的图片"}), 400

    paths: List[Path] = []
    for relative in targets:
        normalized = _normalize_relative_path(relative)
        try:
            path = _safe_bucket_path("source", normalized)
        except ValueError:
            continue
        if path.exists() and path.is_file() and _allowed_image(path.name):
            paths.append(path)

    if not paths:
        return jsonify({"ok": False, "message": "未找到可删除的图片"}), 400

    removed = 0
    gen_dir = Path(GENERATED_BUCKET_DIR)
    tags_dir = Path(TAGS_BUCKET_DIR)
    thumb_dir = Path(THUMBNAIL_DIR) / "source"

    for path in paths:
        if path.exists() and path.is_file():
            # 1. Delete Source
            path.unlink(missing_ok=True)
            removed += 1
            
            # 2. Delete Generated Images ({stem}_gen*)
            stem = path.stem
            # Simple glob pattern for generated files
            # We need to search recursively if we support folders, but here paths are absolute
            # For simplicity, just look in generated bucket flattened or relative?
            # generated bucket mirrors source structure.
            rel_path = path.relative_to(SOURCE_BUCKET_DIR)
            rel_parent = rel_path.parent
            
            target_gen_dir = (gen_dir / rel_parent).resolve()
            if target_gen_dir.exists():
                for gen_file in target_gen_dir.glob(f"{stem}_gen*"):
                    gen_file.unlink(missing_ok=True)

            # 3. Delete Tags ({stem}.txt)
            # Tags are flat or mirrored? api_images_tag uses tags_dir / f"{stem}.txt" which implies flat!
            # But api_ai_list uses tags_dir / f"{stem}.txt".
            # Wait, api_ai_export walks tags_dir.
            # Let's assume flat for now based on api_images_tag implementation:
            # tag_file = tags_dir / f"{stem}.txt"
            # If source structure is deep, this flat tag structure is buggy if filenames conflict.
            # But we stick to existing logic: tags_dir / f"{stem}.txt"
            (tags_dir / f"{stem}.txt").unlink(missing_ok=True)
            
            # 4. Delete Thumbnail
            target_thumb = (thumb_dir / rel_path).resolve()
            target_thumb.unlink(missing_ok=True)
            
    return jsonify({"ok": True, "message": f"已删除 {removed} 张图片及其关联文件", "deleted": removed})


@app.route("/api/images/clear", methods=["POST"])
def api_images_clear():
    base_dir = _safe_bucket_path("source")
    paths: List[Path] = []
    for root, _, filenames in os.walk(base_dir):
        for filename in filenames:
            if _allowed_image(filename):
                paths.append(Path(root) / filename)

    if not paths:
        return jsonify({"ok": True, "message": "当前没有可清理的图片", "deleted": 0})

    # Call the delete logic to handle associated files, but optimized for clear all
    # Actually, just wiping directories might be faster but let's be safe.
    # Since we need to delete associated generated/tags/thumbs, simpler to just wipe those dirs?
    # But "generated" might contain things not associated with current source? No, generated is derived.
    # "tags" might too.
    # Let's just iterate and delete for safety, or use shell commands if fast.
    # Let's use the same logic as delete but bulk.
    
    removed = 0
    gen_dir = Path(GENERATED_BUCKET_DIR)
    tags_dir = Path(TAGS_BUCKET_DIR)
    thumb_dir = Path(THUMBNAIL_DIR)

    # Remove all source files
    removed = _delete_files(paths)
    
    # Clear Generated, Tags, Thumbnails
    # We can just recreate the dirs.
    def clear_directory(path: Path):
        if path.exists():
            shutil.rmtree(path)
            path.mkdir(parents=True, exist_ok=True)
            
    clear_directory(gen_dir)
    clear_directory(tags_dir)
    clear_directory(thumb_dir)

    return jsonify({"ok": True, "message": f"已清空 {removed} 张图片及关联数据", "deleted": removed})


@app.route("/api/images/tag", methods=["POST"])
def api_images_tag():
    data = request.get_json(force=True)
    targets = data.get("targets") or []
    tags = (data.get("tags") or "").strip()
    
    if not targets:
        targets = [item["relative_path"] for item in _gather_media_items("source")]
        
    if not targets:
        return jsonify({"ok": False, "message": "请至少选择一张图片"}), 400

    tags_dir = _safe_bucket_path("tags")
    count = 0
    
    for relative in targets:
        try:
            # Ensure source exists
            src_path = _safe_bucket_path("source", relative)
            if not src_path.exists():
                continue
                
            stem = src_path.stem
            tag_file = tags_dir / f"{stem}.txt"
            tag_file.write_text(tags, encoding="utf-8")
            count += 1
        except Exception:
            continue
            
    return jsonify({"ok": True, "message": f"已为 {count} 张图片更新标签"})


@app.route("/api/images/export", methods=["GET"])
def api_images_export():
    # Export source images as zip
    source_dir = _safe_bucket_path("source")
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                if _allowed_image(file):
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(source_dir)
                    zf.write(file_path, arcname)
                    
    memory_file.seek(0)
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'images_export_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
    )


@app.route("/api/ai/export", methods=["GET"])
def api_ai_export():
    # Export source, generated, and tags
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Source
        source_dir = _safe_bucket_path("source")
        for root, _, files in os.walk(source_dir):
            for file in files:
                if _allowed_image(file):
                    file_path = Path(root) / file
                    arcname = f"source/{file_path.relative_to(source_dir)}"
                    zf.write(file_path, arcname)
                    
        # Generated
        gen_dir = _safe_bucket_path("generated")
        if gen_dir.exists():
            for root, _, files in os.walk(gen_dir):
                for file in files:
                    if _allowed_image(file):
                        file_path = Path(root) / file
                        # Rename logic: remove _genX suffix to match source name
                        stem = file_path.stem
                        suffix = file_path.suffix
                        # Remove _gen\d+ from end of stem
                        new_stem = re.sub(r"_gen\d+$", "", stem)
                        
                        # We need to maintain directory structure relative to gen_dir
                        rel_path = file_path.relative_to(gen_dir)
                        # Replace the filename in rel_path
                        new_rel_path = rel_path.with_name(f"{new_stem}{suffix}")
                        
                        arcname = f"generated/{new_rel_path}"
                        zf.write(file_path, arcname)
                        
        # Tags
        tags_dir = _safe_bucket_path("tags")
        if tags_dir.exists():
            for root, _, files in os.walk(tags_dir):
                for file in files:
                    if file.endswith(".txt"):
                        file_path = Path(root) / file
                        arcname = f"tags/{file_path.relative_to(tags_dir)}"
                        zf.write(file_path, arcname)

    memory_file.seek(0)
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'ai_export_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
    )


@app.route("/api/network/accelerator", methods=["POST"])
def api_network_accelerator():
    if not IS_LINUX:
        return (
            jsonify({"ok": False, "message": "该功能仅在 Linux/Autodl 环境可用"}),
            400,
        )
    data = request.get_json(force=True)
    action = (data.get("action") or "").lower()
    if action not in {"enable", "disable"}:
        return jsonify({"ok": False, "message": "无效的操作指令"}), 400

    command = (
        "source /etc/network_turbo"
        if action == "enable"
        else "unset http_proxy && unset https_proxy"
    )
    try:
        result = subprocess.run(
            command,
            shell=True,
            executable="/bin/bash",
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "message": f"执行失败：{exc}"}), 500

    if result.returncode != 0:
        stderr = (result.stderr or "").strip() or "命令执行失败"
        return jsonify({"ok": False, "message": stderr}), 500

    output = (result.stdout or "").strip()
    return jsonify(
        {
            "ok": True,
            "message": "命令执行成功",
            "action": action,
            "output": output,
        }
    )


@app.route("/api/images/generate", methods=["POST"])
def api_images_generate():
    data = request.get_json(force=True)
    prompt = (data.get("prompt") or "").strip()
    overwrite = bool(data.get("overwrite", True))
    targets = data.get("targets") or []
    key_path = (data.get("key_path") or "").strip()
    project_id = (data.get("project_id") or "").strip()
    location = (data.get("location") or "").strip()
    bucket = "source"

    filenames: List[str] = []
    if targets:
        for relative in targets:
            normalized = _normalize_relative_path(relative)
            try:
                path = _safe_bucket_path(bucket, normalized)
            except ValueError:
                continue
            if path.exists() and _allowed_image(path.name):
                filenames.append(normalized)
    else:
        filenames = [item["relative_path"] for item in _gather_media_items(bucket)]

    if not filenames:
        return jsonify({"ok": False, "message": "未找到可生成的图片，请先上传"}), 400

    if not key_path or not project_id or not location:
        return (
            jsonify({"ok": False, "message": "请填写 KEY_PATH、PROJECT_ID 与 LOCATION"}),
            400,
        )

    resolved_key_path = os.path.abspath(os.path.expanduser(key_path))
    if not os.path.exists(resolved_key_path):
        return (
            jsonify({"ok": False, "message": f"找不到凭证文件：{resolved_key_path}"}),
            400,
        )

    if not _can_access_google():
        return jsonify({"ok": False, "message": "当前无法连接 Gemini，请先开启 VPN / 开启系统代理 后再试"}), 502

    with state_lock:
        if task_state["image_generation"]["status"] == "running":
            return jsonify({"ok": False, "message": "已有生成任务正在执行"}), 409
        task_state["image_generation"] = {
            **task_state["image_generation"],
            "status": "queued",
            "progress": 0,
            "message": "任务已排队",
            "log": [],
            "prompt": prompt,
            "total": len(filenames),
            "processed": 0,
        }

    threading.Thread(
        target=_generate_images_worker,
        args=(
            prompt or "请根据参考图生成风格一致的图像",
            filenames,
            bucket,
            overwrite,
            resolved_key_path,
            project_id,
            location,
        ),
        daemon=True,
    ).start()
    return jsonify({"ok": True, "message": "生成任务已启动，请在右侧控制台查看进度"})


if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", 6008))
    print(f"Server running on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)
