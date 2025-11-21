import threading
from typing import Dict
from .config import MAX_RECENT_LOG_LINES
from .utils import get_timestamp

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

def append_log(section: str, line: str) -> None:
    with state_lock:
        logs = task_state[section]["log"]
        logs.append(line)
        task_state[section]["log"] = logs[-MAX_RECENT_LOG_LINES:]
        task_state[section]["last_updated"] = get_timestamp()

def update_state(section: str, **kwargs) -> None:
    with state_lock:
        task_state[section].update(kwargs)
        task_state[section]["last_updated"] = get_timestamp()
