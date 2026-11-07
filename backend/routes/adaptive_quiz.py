from unittest import result

from flask import Blueprint, jsonify, request
from services.ai_service import generate_adaptive_quiz
from services.attempt_service import grade_adaptive_quiz
from services.reward_service import award_quiz_reward

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


@adaptive_bp.route("/api/adaptive/submit", methods=["POST"])
def submit_adaptive_quiz():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    default_attempt_id = data.get("attempt_id")
    answers = data.get("answers")

    if (
        not isinstance(default_attempt_id, int)
        or isinstance(default_attempt_id, bool)
        or default_attempt_id <= 0
        or not isinstance(answers, dict)
        or not all(
            isinstance(k, str) and isinstance(v, str)
            for k, v in answers.items()
        )
    ):
        return jsonify({
            "error": "Invalid attempt ID or answers."
        }), 400

    try:
        result = grade_adaptive_quiz(
            default_attempt_id,
            answers
        )

        reward = award_quiz_reward(result["attempt_id"])

        result["reward"] = reward

        return jsonify(result)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    except Exception as error:
        print("ADAPTIVE SUBMISSION ERROR:", repr(error))

        return jsonify({
            "error": "Unable to submit adaptive quiz."
        }), 500
