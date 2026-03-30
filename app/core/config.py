import os
import platform
from pathlib import Path


CURRENT_VERSION = "0.0.9"
GITEE_REPO = "rcangbaohz/lora-training-toolkit"

SYSTEM_NAME = platform.system()
IS_LINUX = SYSTEM_NAME.lower() == "linux"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BASE_MODEL_DIR = Path(
    os.environ.get(
        "BASE_MODEL_DIR",
        "/root/autodl-tmp" if IS_LINUX else str(PROJECT_ROOT / "autodl-tmp"),
    )
)
WORKSPACE_ROOT = BASE_MODEL_DIR / "image_workspace"
SOURCE_BUCKET_DIR = WORKSPACE_ROOT / "source"
GENERATED_BUCKET_DIR = WORKSPACE_ROOT / "generated"
TAGS_BUCKET_DIR = WORKSPACE_ROOT / "tags"
TEMP_DIR = WORKSPACE_ROOT / "tmp"
THUMBNAIL_DIR = WORKSPACE_ROOT / "thumbnails"

ULTRALYTICS_WEIGHTS_DIR = BASE_MODEL_DIR / "ultralytics" / "weights"
YOLO_POSE_WEIGHTS = Path(os.environ.get("YOLO_POSE_WEIGHTS", str(ULTRALYTICS_WEIGHTS_DIR / "YOLO26m-pose.pt")))

MEDIA_BUCKETS = {
    "source": SOURCE_BUCKET_DIR,
    "generated": GENERATED_BUCKET_DIR,
    "tags": TAGS_BUCKET_DIR,
}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
MAX_RECENT_LOG_LINES = 400

RUNNINGHUB_API_BASE = os.environ.get("RUNNINGHUB_API_BASE", "https://www.runninghub.cn/openapi/v2")
RUNNINGHUB_SITE_BASE = os.environ.get(
    "RUNNINGHUB_SITE_BASE",
    RUNNINGHUB_API_BASE.split("/openapi", 1)[0] if "/openapi" in RUNNINGHUB_API_BASE else "https://www.runninghub.cn",
)
RUNNINGHUB_IMAGE_EDIT_URL = os.environ.get(
    "RUNNINGHUB_IMAGE_EDIT_URL",
    f"{RUNNINGHUB_API_BASE}/run/ai-app/1968246516144058370",
)
RUNNINGHUB_QUERY_URL = os.environ.get(
    "RUNNINGHUB_QUERY_URL",
    f"{RUNNINGHUB_API_BASE}/query",
)
RUNNINGHUB_UPLOAD_URL = os.environ.get(
    "RUNNINGHUB_UPLOAD_URL",
    f"{RUNNINGHUB_API_BASE}/media/upload/binary",
)
RUNNINGHUB_DEFAULT_IMAGE_PROMPT = os.environ.get(
    "RUNNINGHUB_DEFAULT_IMAGE_PROMPT",
    "请参考原图，在保持主体特征和整体构图一致的前提下，生成更精致、更完整的高质量成图。",
)
RUNNINGHUB_DEFAULT_ASPECT_RATIO = os.environ.get("RUNNINGHUB_DEFAULT_ASPECT_RATIO", "auto")
RUNNINGHUB_ALLOWED_ASPECT_RATIOS = (
    "auto",
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "5:4",
    "4:5",
    "21:9",
)
RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID = os.environ.get("RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID", "2")
RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME = os.environ.get("RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME", "image")
RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID = os.environ.get("RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID", "16")
RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME = os.environ.get("RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME", "prompt")
RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID = os.environ.get("RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID", "1")
RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME = os.environ.get(
    "RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME",
    "aspectRatio",
)
RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA = os.environ.get(
    "RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA",
    '[["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"], {"default": "auto"}]',
)
RUNNINGHUB_WORKFLOW_INSTANCE_TYPE = os.environ.get("RUNNINGHUB_WORKFLOW_INSTANCE_TYPE", "default")
RUNNINGHUB_WORKFLOW_USE_PERSONAL_QUEUE = os.environ.get(
    "RUNNINGHUB_WORKFLOW_USE_PERSONAL_QUEUE",
    "false",
)
