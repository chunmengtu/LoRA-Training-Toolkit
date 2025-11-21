import os
from flask import Flask
from .routes import register_routes
from .utils import ensure_workspace

def create_app():
    # Determine the project root directory (one level up from this file)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    template_dir = os.path.join(project_root, "templates")
    static_dir = os.path.join(project_root, "static")
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    
    ensure_workspace()
    register_routes(app)
    
    return app

