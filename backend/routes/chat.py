
from flask import Blueprint, jsonify, request, session

from services.chat_service import ask_aqua

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/api/chat", methods=["POST"])
def chat_with_aqua():
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({
            "error": "Login required."
        }), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid JSON request."
        }), 400

    attempt_id = data.get("attempt_id")
    message = data.get("message")
    history = data.get("history", [])

    if type(attempt_id) is not int or attempt_id <= 0:
        return jsonify({
            "error": "Invalid attempt ID."
        }), 400

    if not isinstance(message, str) or not message.strip():
        return jsonify({
            "error": "Please enter a question."
        }), 400

    if len(message) > 1000:
        return jsonify({
            "error": "Message is too long (max 1000 characters)."
        }), 400

    if not isinstance(history, list):
        return jsonify({
            "error": "Invalid chat history."
        }), 400

    try:
        result = ask_aqua(
            student_id=student_id,
            attempt_id=attempt_id,
            message=message,
            history=history
        )

        return jsonify(result), 200

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    except Exception as error:
        print("ASK AQUA ERROR:", repr(error))

        return jsonify({
            "error": "Aqua is temporarily unavailable."
        }), 503
