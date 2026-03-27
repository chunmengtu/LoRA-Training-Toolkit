import threading

from app.core.state import state_lock, task_state, update_state
from app.shared.tasks.runner import run_setup_commands


def queue_setup(github_accelerator: bool) -> bool:
    with state_lock:
        if task_state["setup"]["status"] == "running":
            return False
        update_state("setup", status="queued", progress=0, message="即将开始", log=[])

    threading.Thread(target=run_setup_commands, args=(github_accelerator,), daemon=True).start()
    return True
