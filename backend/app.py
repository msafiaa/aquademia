import os
from threading import Lock
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, jsonify, redirect, request, session, url_for
from pathlib import Path
from routes.adaptive_quiz import adaptive_bp
from routes.aqua_plan import aqua_plan_bp
from routes.aquarium import aquarium_bp
from routes.auth import auth_bp
from routes.chat import chat_bp
from routes.quiz import quiz_bp
from routes.shop import shop_bp
from routes.learning import learning_bp
from routes.pages import pages_bp
from db import get_db_connection
from services.aqua_plan_service import ensure_plan_tables

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
app.register_blueprint(aqua_plan_bp)
app.register_blueprint(aquarium_bp)
app.register_blueprint(shop_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(learning_bp)
app.register_blueprint(pages_bp)

_aquaplan_schema_ready = False
_aquaplan_schema_lock = Lock()


@app.before_request
def ensure_aquaplan_schema_for_rewards():
    global _aquaplan_schema_ready
    if not (
        request.path.startswith("/api/shop/")
        or request.path.startswith("/api/aquaplan")
    ):
        return
    if _aquaplan_schema_ready:
        return

    with _aquaplan_schema_lock:
        if _aquaplan_schema_ready:
            return
        connection = get_db_connection()
        cursor = connection.cursor()
        try:
            ensure_plan_tables(cursor)
            connection.commit()
        finally:
            cursor.close()
            connection.close()
        _aquaplan_schema_ready = True


@app.route("/")
def home():
    if session.get("student_id"):
        return redirect(url_for("pages.index_page"))
    return redirect(url_for("pages.login_page"))

if __name__ == "__main__":
    app.run(debug=True)
