import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app import create_app
app = create_app()

if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", 6008))
    print(f"Server running on http://{host}:{port}")
    debug = os.environ.get("DEBUG", "true").strip().lower() in {"1", "true", "yes", "y"}
    use_reloader = os.environ.get("USE_RELOADER", "false").strip().lower() in {"1", "true", "yes", "y"}
    app.run(host=host, port=port, debug=debug, use_reloader=use_reloader)
