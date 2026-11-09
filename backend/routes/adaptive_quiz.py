
import json

from flask import Blueprint, jsonify, request, session

from services.attempt_service import grade_adaptive_quiz
from services.reward_service import award_quiz_reward
from db import get_db_connection

adaptive_bp = Blueprint("adaptive", __name__)


@adaptive_bp.route("/api/adaptive/<int:attempt_id>", methods=["GET"])
def get_adaptive_questions(attempt_id):
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT attempt_id
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND student_id = %s
              AND quiz_type = 'default'
        """, (attempt_id, student_id))

        if not cursor.fetchone():
            return jsonify({"error": "Quiz attempt not found."}), 404

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (attempt_id,))

        questions = cursor.fetchall()
        for question in questions:
            options = question["options_json"]
            question["options"] = (
                json.loads(options) if isinstance(options, str) else options
            )
            del question["options_json"]
            question["id"] = question.pop("adaptive_id")
            question["question"] = question.pop("question_text")

        return jsonify({"questions": questions}), 200

    finally:
        cursor.close()
        connection.close()


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
