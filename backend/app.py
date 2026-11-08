import os
from dotenv import load_dotenv

from flask import Flask, jsonify, redirect, url_for, session
from pathlib import Path
from routes.adaptive_quiz import adaptive_bp
from routes.aquarium import aquarium_bp
from routes.auth import auth_bp
from routes.chat import chat_bp
from routes.quiz import quiz_bp
from routes.shop import shop_bp
from routes.learning import learning_bp
from routes.pages import pages_bp

BASE_DIR = Path(__file__).resolve().parent.parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "frontend" / "templates"),
    static_folder=str(BASE_DIR / "frontend" / "static")
)

load_dotenv(BASE_DIR / ".env")
app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False  # Localhost only
)

app.register_blueprint(auth_bp)
app.register_blueprint(quiz_bp)
app.register_blueprint(adaptive_bp)
app.register_blueprint(aquarium_bp)
app.register_blueprint(shop_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(learning_bp)
app.register_blueprint(pages_bp)

@app.route("/")
def home():
    if session.get("student_id"):
        return redirect(url_for("pages.index_page"))
    return redirect(url_for("pages.login_page"))

if __name__ == "__main__":
    app.run(debug=True)
