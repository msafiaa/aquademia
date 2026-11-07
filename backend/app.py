from flask import Flask, jsonify
from pathlib import Path
from routes.quiz import quiz_bp
from routes.adaptive_quiz import adaptive_bp

BASE_DIR = Path(__file__).resolve().parent.parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "frontend" / "templates"),
    static_folder=str(BASE_DIR / "frontend" / "static")
)

app.register_blueprint(quiz_bp)
app.register_blueprint(adaptive_bp)

@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to Aquademia!",
        "status": "Backend running successfully"
    })

if __name__ == "__main__":
    app.run(debug=True)
