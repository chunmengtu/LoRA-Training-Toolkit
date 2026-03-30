from flask import Flask

from .ai_tag.routes import blueprints as ai_tag_blueprints
from .ai_generate.routes import blueprints as ai_generate_blueprints
from .ai_clean.routes import blueprints as ai_clean_blueprints
from .console.routes import blueprints as console_blueprints
from .images.routes import blueprints as image_blueprints
from .model_download.routes import blueprints as model_download_blueprints
from .setup.routes import blueprints as setup_blueprints
from .system.routes import blueprints as system_blueprints


def register_blueprints(app: Flask) -> None:
    for blueprint_group in (
        system_blueprints,
        console_blueprints,
        setup_blueprints,
        model_download_blueprints,
        image_blueprints,
        ai_generate_blueprints,
        ai_clean_blueprints,
        ai_tag_blueprints,
    ):
        for blueprint in blueprint_group:
            app.register_blueprint(blueprint)
