import os
import platform

CURRENT_VERSION = "0.0.5"
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

