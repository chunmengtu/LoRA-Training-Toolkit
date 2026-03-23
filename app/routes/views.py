import json
from pathlib import Path
from PIL import Image
from flask import Blueprint, render_template, send_from_directory
from ..config import (
    BASE_MODEL_DIR,
    IS_LINUX,
    RUNNINGHUB_DEFAULT_ASPECT_RATIO,
    RUNNINGHUB_IMAGE_EDIT_URL,
    RUNNINGHUB_QUERY_URL,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
    RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
    RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
    SYSTEM_NAME,
    THUMBNAIL_DIR,
)
from ..services.tasks import MODEL_REGISTRY
from ..utils import safe_bucket_path, allowed_image

bp = Blueprint("views", __name__)

@bp.route("/")
def index():
    return render_template(
        "index.html",
        system=SYSTEM_NAME,
        is_linux=IS_LINUX,
        base_dir=BASE_MODEL_DIR,
        runninghub_image_edit_url=RUNNINGHUB_IMAGE_EDIT_URL,
        runninghub_query_url=RUNNINGHUB_QUERY_URL,
        runninghub_default_aspect_ratio=RUNNINGHUB_DEFAULT_ASPECT_RATIO,
        runninghub_workflow_image_node_id=RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
        runninghub_workflow_image_field_name=RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
        runninghub_workflow_prompt_node_id=RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
        runninghub_workflow_prompt_field_name=RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
        runninghub_workflow_aspect_ratio_node_id=RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
        runninghub_workflow_aspect_ratio_field_name=RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
        runninghub_workflow_aspect_ratio_field_data=RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
        model_registry_json=json.dumps(
            [{"name": m["name"], "desc": m["desc"], "featured": m["featured"]}
             for m in MODEL_REGISTRY],
            ensure_ascii=False,
        ),
    )

@bp.route("/uploads/<path:filename>")
def serve_upload(filename: str):
    try:
        safe_dir = safe_bucket_path("source")
        safe_path = safe_bucket_path("source", filename)
        if not safe_path.exists():
            return "Not Found", 404
        rel_path = str(safe_path.relative_to(safe_dir)).replace("\\", "/")
        return send_from_directory(str(safe_dir), rel_path)
    except ValueError:
        return "Forbidden", 403

@bp.route("/media/<bucket>/<path:filename>")
def serve_media(bucket: str, filename: str):
    try:
        safe_dir = safe_bucket_path(bucket)
        safe_path = safe_bucket_path(bucket, filename)
        if not safe_path.exists():
            return "Not Found", 404
        directory = str(safe_dir)
        rel_path = str(safe_path.relative_to(safe_dir)).replace("\\", "/")
        return send_from_directory(directory, rel_path)
    except ValueError:
        return "Forbidden", 403

@bp.route("/api/thumbnail/<bucket>/<path:filename>")
def serve_thumbnail(bucket: str, filename: str):
    try:
        source_path = safe_bucket_path(bucket, filename)
        if not source_path.exists():
            return "Not Found", 404

        if not allowed_image(source_path.name):
            return "Not Supported", 415

        thumb_root = Path(THUMBNAIL_DIR) / bucket
        bucket_root = safe_bucket_path(bucket)
        rel_path = source_path.relative_to(bucket_root)
        thumb_path = thumb_root / rel_path
        
        if thumb_path.exists():
             if thumb_path.stat().st_mtime >= source_path.stat().st_mtime:
                 return send_from_directory(str(thumb_path.parent), thumb_path.name)
        
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(source_path) as img:
                img.thumbnail((300, 300))
                img.save(thumb_path)
        except Exception as e:
            print(f"Thumbnail generation failed for {source_path}: {e}")
            return send_from_directory(str(bucket_root), str(rel_path))
            
        return send_from_directory(str(thumb_path.parent), thumb_path.name)
            
    except ValueError:
        return "Forbidden", 403

