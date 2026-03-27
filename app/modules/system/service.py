import json

from app.core.config import (
    BASE_MODEL_DIR,
    CURRENT_VERSION,
    GITEE_REPO,
    IS_LINUX,
    RUNNINGHUB_DEFAULT_ASPECT_RATIO,
    RUNNINGHUB_QUERY_URL,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
    RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
    RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
    RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
    SYSTEM_NAME,
)
from app.core.utils import check_update
from app.modules.model_download.registry import MODEL_REGISTRY
from app.shared.tasks.runner import run_network_accelerator


def build_index_context() -> dict:
    return {
        "system": SYSTEM_NAME,
        "is_linux": IS_LINUX,
        "base_dir": str(BASE_MODEL_DIR),
        "runninghub_query_url": RUNNINGHUB_QUERY_URL,
        "runninghub_default_aspect_ratio": RUNNINGHUB_DEFAULT_ASPECT_RATIO,
        "runninghub_workflow_image_node_id": RUNNINGHUB_WORKFLOW_IMAGE_NODE_ID,
        "runninghub_workflow_image_field_name": RUNNINGHUB_WORKFLOW_IMAGE_FIELD_NAME,
        "runninghub_workflow_prompt_node_id": RUNNINGHUB_WORKFLOW_PROMPT_NODE_ID,
        "runninghub_workflow_prompt_field_name": RUNNINGHUB_WORKFLOW_PROMPT_FIELD_NAME,
        "runninghub_workflow_aspect_ratio_node_id": RUNNINGHUB_WORKFLOW_ASPECT_RATIO_NODE_ID,
        "runninghub_workflow_aspect_ratio_field_name": RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_NAME,
        "runninghub_workflow_aspect_ratio_field_data": RUNNINGHUB_WORKFLOW_ASPECT_RATIO_FIELD_DATA,
        "model_registry_json": json.dumps(
            [
                {"name": item["name"], "desc": item["desc"], "featured": item["featured"]}
                for item in MODEL_REGISTRY
            ],
            ensure_ascii=False,
        ),
    }


def check_latest_release():
    return check_update(GITEE_REPO, CURRENT_VERSION)


def toggle_network_accelerator(action: str):
    return run_network_accelerator(action)
