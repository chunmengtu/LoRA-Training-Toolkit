from flask import Flask
from .views import bp as views_bp
from .api import bp as api_bp

def register_routes(app: Flask):
    app.register_blueprint(views_bp)
    app.register_blueprint(api_bp)

