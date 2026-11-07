
from flask import Blueprint, jsonify, request
from services.ai_service import generate_adaptive_quiz
from services.performance_service import analyze_performance

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
        return jsonify({
            "error": "Answers must be an object"
        }), 400

    expected_ids = {str(q["id"]) for q in questions}

    if set(answers.keys()) != expected_ids:
        return jsonify({
            "error": "Submit one answer per question"
        }), 400

    for question in questions:
        answer = answers[str(question["id"])]

        if answer not in question["options"]:
            return jsonify({
                "error": "Invalid answer option"
            }), 400

   
    # Analyze default quiz performance
    result = analyze_performance(questions, answers)

    # Add learning context for AI
    result["year"] = questions[0]["year"]
    result["subject"] = questions[0]["subject"]
    result["topic"] = questions[0]["topic"]

    # Generate adaptive quiz based on performance
    if result["weak_skills"]:
        try:
            adaptive_result = generate_adaptive_quiz(result)

            result["adaptive_quiz"] = {
                "analysis": adaptive_result["analysis"],
                "questions": [
                    {
                        "id": index + 1,
                        "question": question["question"],
                        "options": question["options"],
                        "skill": question["skill"]
                    }
                    for index, question in enumerate(
                        adaptive_result["questions"]
                    )
                ]
            }

        except Exception:
            result["adaptive_quiz"] = {
                "status": "unavailable",
                "message": "Adaptive quiz is temporarily unavailable."
            }

    else:
        result["adaptive_quiz"] = {
            "status": "completed",
            "message": "Excellent! No weak skills detected."
        }

    return jsonify(result)

