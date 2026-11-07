from flask import Blueprint, jsonify, request
from services.attempt_service import (
    save_quiz_attempt,
    save_adaptive_questions
)
from services.quiz_service import get_default_questions
from services.performance_service import analyze_performance
from services.question_validator import validate_adaptive_questions
from services.ai_service import generate_verified_adaptive_quiz

quiz_bp = Blueprint("quiz", __name__)


@quiz_bp.route("/api/questions", methods=["GET"])
def get_questions():
    year = request.args.get("year", default=4, type=int)
    subject = request.args.get("subject", "Mathematics")
    topic = request.args.get("topic", "Addition")

    questions = get_default_questions(year, subject, topic)

    # Never send default quiz answer keys to frontend
    public_questions = [
        {k: v for k, v in q.items() if k != "answer"}
        for q in questions
    ]

    return jsonify(public_questions)


@quiz_bp.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    data = request.get_json(silent=True) or {}

    answers = data.get("answers")
    year = data.get("year", 4)
    subject = data.get("subject", "Mathematics")
    topic = data.get("topic", "Addition")

    if not isinstance(answers, dict):
        return jsonify({"error": "Invalid answers"}), 400

    if not isinstance(year, int) or year not in (4, 5, 6):
        return jsonify({"error": "Invalid year"}), 400

    questions = get_default_questions(year, subject, topic)

    if not questions:
        return jsonify({"error": "No questions found"}), 404

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

    result = analyze_performance(questions, answers)

    result["year"] = year
    result["subject"] = subject
    result["topic"] = topic
    
    # Temporary demo student
    student_id = 1

    # Save default quiz attempt
    attempt_id = save_quiz_attempt(student_id, result)

    result["attempt_id"] = attempt_id

    #

    if result["weak_skills"]:
        try:
            adaptive_result = generate_verified_adaptive_quiz(result)

            question_ids = save_adaptive_questions(
                attempt_id,
                adaptive_result["questions"]
            )

            result["adaptive_quiz"] = {
                "analysis": adaptive_result["analysis"],
                
                "questions": [
                    {
                        "id": question_ids[index],
                        "question": question["question"],
                        "options": question["options"],
                        "skill": question["skill"]
                    }
                    for index, question in enumerate(
                        adaptive_result["questions"]
                    )
                ]

            }

        except Exception as e:
            print("ADAPTIVE QUIZ ERROR:", repr(e))

            result["adaptive_quiz"] = {
                "status": "unavailable",
                "message": "Adaptive quiz temporarily unavailable."
        }

    else:
        result["adaptive_quiz"] = {
            "status": "completed",
            "message": "No weak skills detected."
        }

    # Don't expose correct answers in student-facing results
    for item in result["question_results"]:
        item.pop("correct_answer", None)

    return jsonify(result)
