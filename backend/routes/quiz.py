
from flask import Blueprint, jsonify, request

quiz_bp = Blueprint("quiz", __name__)

# Temporary questions for testing only.
# Replace with verified KSSR-aligned questions later.
questions = [
    {
        "id": 1,
        "year": 4,
        "subject": "Mathematics",
        "topic": "Addition",
        "question": "What is 125 + 235?",
        "options": ["350", "360", "370", "380"],
        "answer": "360",
        "skill": "addition"
    },
    {
        "id": 2,
        "year": 4,
        "subject": "Mathematics",
        "topic": "Addition",
        "question": "What is 420 + 180?",
        "options": ["500", "600", "650", "700"],
        "answer": "600",
        "skill": "addition"
    }
]


@quiz_bp.route("/api/questions", methods=["GET"])
def get_questions():
    # Never send correct answers to the frontend.
    public_questions = [
        {k: v for k, v in q.items() if k != "answer"}
        for q in questions
    ]
    return jsonify(public_questions)


@quiz_bp.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    data = request.get_json(silent=True) or {}
    answers = data.get("answers")

    if not isinstance(answers, dict):
        return jsonify({"error": "answers must be an object"}), 400

    if set(answers.keys()) != {str(q["id"]) for q in questions}:
        return jsonify({"error": "Submit one answer per question"}), 400

    if any(
        answers[str(q["id"])] not in q["options"]
        for q in questions
    ):
        return jsonify({"error": "Invalid answer option"}), 400

    correct = sum(
        answers[str(q["id"])] == q["answer"]
        for q in questions
    )

    total = len(questions)
    score = round(correct / total * 100)

    return jsonify({
        "correct": correct,
        "total": total,
        "score": score
    })
