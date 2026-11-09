
from flask import Blueprint, jsonify, request, session

from services.attempt_service import (
    answer_adaptive_question,
    get_adaptive_practice_history,
    generate_more_adaptive_questions,
    get_or_create_adaptive_questions,
    grade_adaptive_quiz
)
from services.reward_service import award_quiz_reward

adaptive_bp = Blueprint("adaptive", __name__)


@adaptive_bp.route(
    "/api/adaptive/<int:attempt_id>/answer",
    methods=["POST"]
)
def submit_adaptive_answer(attempt_id):
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    adaptive_id = data.get("adaptive_id")
    answer = data.get("answer")
    if (
        type(adaptive_id) is not int
        or adaptive_id <= 0
        or not isinstance(answer, str)
    ):
        return jsonify({"error": "Invalid question or answer."}), 400

    try:
        result = answer_adaptive_question(
            attempt_id,
            adaptive_id,
            student_id,
            answer
        )
        return jsonify(result), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        print("ADAPTIVE ANSWER ERROR:", repr(error))
        return jsonify({
            "error": "Unable to save this practice answer."
        }), 500


@adaptive_bp.route(
    "/api/adaptive/<int:attempt_id>/history",
    methods=["GET"]
)
def adaptive_practice_history(attempt_id):
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401
    try:
        history = get_adaptive_practice_history(attempt_id, student_id)
        if history is None:
            return jsonify({"error": "Quiz attempt not found."}), 404
        return jsonify({"history": history}), 200
    except Exception as error:
        print("ADAPTIVE HISTORY ERROR:", repr(error))
        return jsonify({
            "error": "Unable to load practice history."
        }), 500


@adaptive_bp.route(
    "/api/adaptive/<int:attempt_id>/more",
    methods=["POST"]
)
def get_more_adaptive_questions(attempt_id):
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    try:
        questions = generate_more_adaptive_questions(
            attempt_id,
            student_id
        )
        if questions is None:
            return jsonify({"error": "Quiz attempt not found."}), 404
        return jsonify({"questions": questions}), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        print("MORE ADAPTIVE QUESTIONS ERROR:", repr(error))
        return jsonify({
            "error": "Unable to generate more adaptive questions."
        }), 500


@adaptive_bp.route("/api/adaptive/<int:attempt_id>", methods=["GET"])
def get_adaptive_questions(attempt_id):
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    try:
        questions = get_or_create_adaptive_questions(
            attempt_id,
            student_id
        )
        if questions is None:
            return jsonify({"error": "Quiz attempt not found."}), 404

        return jsonify({"questions": questions}), 200

    except Exception as error:
        print("ADAPTIVE QUESTION LOAD ERROR:", repr(error))
        return jsonify({
            "error": "Unable to load adaptive questions."
        }), 500


@adaptive_bp.route("/api/adaptive/submit", methods=["POST"])
def submit_adaptive_quiz():
    # Student must be logged in
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({
            "error": "Login required."
        }), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request."
        }), 400

    default_attempt_id = data.get("attempt_id")
    answers = data.get("answers")

    if (
        type(default_attempt_id) is not int
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
            answers,
            student_id
        )

        reward = award_quiz_reward(result["attempt_id"])

        result["reward"] = reward

        return jsonify(result), 200

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    except Exception as error:
        print("ADAPTIVE SUBMISSION ERROR:", repr(error))

        return jsonify({
            "error": "Unable to submit adaptive quiz."
        }), 500
