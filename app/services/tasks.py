import os
import subprocess
from typing import List, Dict
from ..config import IS_LINUX, BASE_MODEL_DIR
from ..state import append_log, update_state
from ..utils import get_timestamp

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

def _run_command_sequence(section: str, commands: List[str]) -> None:
    total = len(commands)
    update_state(section, status="running", progress=0)
    for idx, command in enumerate(commands, start=1):
        append_log(section, f"[{get_timestamp()}] $ {command}")
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
                    append_log(section, clean_line)
                    update_state(section, message=clean_line)
            return_code = proc.wait()
        except Exception as exc:
            append_log(section, f"执行异常: {exc}")
            update_state(section, status="error", message=str(exc))
            return

        if return_code != 0:
            append_log(section, f"命令失败，退出码 {return_code}")
            update_state(
                section,
                status="error",
                message=f"命令失败，退出码 {return_code}",
                progress=int(idx / total * 100),
            )
            return

        progress = int(idx / total * 100)
        update_state(section, progress=progress)

    update_state(section, status="success", message="全部命令执行完毕", progress=100)

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
        update_state(
            "setup",
            status="error",
            message="找不到 AI-Toolkit-Easy-Install.bat，请确认脚本存在于项目根目录",
        )
        return

    _run_command_sequence("setup", WINDOWS_BOOTSTRAP_COMMANDS)

def run_download_pipeline(model_name: str, source: str) -> None:
    if source not in DOWNLOAD_COMMANDS or model_name not in DOWNLOAD_COMMANDS[source]:
        update_state("download", status="error", message="无效的模型或来源选择")
        return
    command_template = DOWNLOAD_COMMANDS[source][model_name]
    target_dir = os.path.join(BASE_MODEL_DIR, model_name)
    os.makedirs(target_dir, exist_ok=True)

    update_state(
        "download",
        status="running",
        progress=5,
        message=f"准备下载 {model_name}",
        model=model_name,
        source=source,
    )
    final_command = command_template.format(target=target_dir)
    _run_command_sequence("download", [final_command])

def run_start_command() -> Dict:
    if IS_LINUX:
        command = "cd /root/autodl-tmp/ai-toolkit/ui && sed -i 's/--port [0-9]*/--port 6006/g' package.json && npm run build_and_start"
        # Run in background, don't wait
        try:
            subprocess.Popen(command, shell=True, executable="/bin/bash")
            return {"ok": True, "message": "启动命令已在后台执行"}
        except Exception as e:
            return {"ok": False, "message": f"启动失败: {e}"}
    else:
        # Windows
        script_path = os.path.join(os.getcwd(), "Start-AI-Toolkit.bat")
        if not os.path.exists(script_path):
             return {"ok": False, "message": "找不到 Start-AI-Toolkit.bat"}
        try:
            # Use start to open in new window if possible, or just run
            os.startfile(script_path)
            return {"ok": True, "message": "已尝试启动 Start-AI-Toolkit.bat"}
        except Exception as e:
            return {"ok": False, "message": f"启动失败: {e}"}

def run_network_accelerator(action: str) -> Dict:
    if not IS_LINUX:
         return {"ok": False, "message": "该功能仅在 Linux/Autodl 环境可用"}

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
    except Exception as exc:
        return {"ok": False, "message": f"执行失败：{exc}"}

    if result.returncode != 0:
        stderr = (result.stderr or "").strip() or "命令执行失败"
        return {"ok": False, "message": stderr}

    output = (result.stdout or "").strip()
    return {
        "ok": True,
        "message": "命令执行成功",
        "action": action,
        "output": output,
    }
