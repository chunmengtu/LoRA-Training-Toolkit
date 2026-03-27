import threading

from app.core.state import state_lock, task_state, update_state
from app.shared.tasks.runner import run_download_command
from .registry import DOWNLOAD_COMMANDS


def queue_download(model_name: str, source: str) -> tuple[bool, str]:
    if source not in DOWNLOAD_COMMANDS or model_name not in DOWNLOAD_COMMANDS[source]:
        return False, "无效的模型或来源选择"

    with state_lock:
        if task_state["download"]["status"] == "running":
            return False, "已有下载任务正在执行"
        update_state(
            "download",
            status="queued",
            progress=0,
            message="准备中",
            log=[],
            model=model_name,
            source=source,
        )

    threading.Thread(
        target=run_download_command,
        args=(DOWNLOAD_COMMANDS[source][model_name], model_name, source),
        daemon=True,
    ).start()
    return True, "模型下载流程已启动"
