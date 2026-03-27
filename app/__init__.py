from flask import Flask

from .core.config import PROJECT_ROOT
from .core.utils import ensure_workspace
from .modules import register_blueprints

def create_app():
    app = Flask(
        __name__,
        template_folder=str(PROJECT_ROOT / "templates"),
        static_folder=str(PROJECT_ROOT / "static"),
    )

    ensure_workspace()
    register_blueprints(app)

    return app

