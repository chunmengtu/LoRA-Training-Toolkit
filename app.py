import os
from app import create_app


app = create_app()

BANNER = r"""
    __    ____  ____  ___       ______              _       _               ______            __ __    _  __  
   / /   / __ \/ __ \/   |     /_  __/________ _   (_)___  (_)___  ____ _  /_  __/___  ____  / // /__ (_)  /_ 
  / /   / / / / /_/ / /| |      / / / ___/ __  /  / / __ \/ / __ \/ __  /   / / / __ \/ __ \/ // //_/ / /  __/
 / /___/ /_/ / _, _/ ___ |     / / / /  / /_/ /  / / / / / / / / / /_/ /   / / / /_/ / /_/ / // ,<   / /  /_ 
/_____/\____/_/ |_/_/  |_|    /_/ /_/   \__,_/  /_/_/ /_/_/_/ /_/\__, /   /_/  \____/\____/_//_/|_| /_/ \__/ 
                                                                /____/                             
"""


def _parse_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _print_startup_info(host: str, port: int) -> None:
    print(BANNER, flush=True)
    if host in {"0.0.0.0", "::"}:
        print(f"Local: http://127.0.0.1:{port}", flush=True)


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "6008"))
    _print_startup_info(host, port)

    debug = _parse_bool(os.environ.get("DEBUG"), default=False)
    if debug:
        use_reloader = _parse_bool(os.environ.get("USE_RELOADER"), default=False)
        app.run(host=host, port=port, debug=True, use_reloader=use_reloader)
        return

    try:
        from waitress import serve
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "waitress 未安装，无法使用生产级 WSGI 服务启动。"
            "请先执行：pip install waitress"
        ) from exc

    threads = int(os.environ.get("WAITRESS_THREADS", "8"))
    serve(app, host=host, port=port, threads=threads)


if __name__ == "__main__":
    main()
