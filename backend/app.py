import os
from dotenv import load_dotenv

from flask import Flask, jsonify
from pathlib import Path
from routes.quiz import quiz_bp
from routes.adaptive_quiz import adaptive_bp
from routes.aquarium import aquarium_bp
from routes.auth import auth_bp

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

@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to Aquademia!",
        "status": "Backend running successfully"
    })

if __name__ == "__main__":
    app.run(debug=True)
