
from flask import Blueprint, jsonify, request
from services.ai_service import generate_adaptive_quiz

adaptive_bp = Blueprint("adaptive", __name__)


@adaptive_bp.route("/api/adaptive/generate", methods=["POST"])
def generate_quiz():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request"}), 400

    try:
        result = generate_adaptive_quiz(data)
        return jsonify(result)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    except Exception:
        return jsonify({
            "error": "AI service temporarily unavailable"
        }), 503
