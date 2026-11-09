from flask import Blueprint, jsonify, request, session
from services.ai_service import generate_verified_adaptive_quiz

from services.attempt_service import (
    save_quiz_attempt,
    save_adaptive_questions
)
from services.explanation_service import (
    generate_question_explanations,
    save_question_explanations
)
from services.notes_service import (
    generate_personalised_notes,
    save_personalised_notes
)

from services.performance_service import analyze_performance
from services.quiz_service import get_default_questions, get_topics
from services.question_validator import validate_adaptive_questions
from services.reward_service import award_quiz_reward


quiz_bp = Blueprint("quiz", __name__)


@quiz_bp.route("/api/topics", methods=["GET"])
def list_topics():
    if session.get("student_id") is None:
        return jsonify({"error": "Login required."}), 401

    year = request.args.get("year", default=4, type=int)
    subject = request.args.get("subject", "Science")

    if year not in (4, 5, 6):
        return jsonify({"error": "Invalid year"}), 400

    return jsonify(get_topics(year, subject))


@quiz_bp.route("/api/questions", methods=["GET"])
def get_questions():
    
    if session.get("student_id") is None:
         return jsonify({"error": "Login required."}), 401

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
    
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({
            "error": "Login required."
        }), 401

    # Save default quiz attempt
    attempt_id = save_quiz_attempt(student_id, result)

    result["attempt_id"] = attempt_id
    try:
        result["reward"] = award_quiz_reward(attempt_id)
        result["reward_status"] = "available"
    except Exception as error:
        print("QUIZ REWARD ERROR:", repr(error))
        result["reward"] = None
        result["reward_status"] = "unavailable"

    
    # Generate explanations for completed quiz questions
    try:
        explanations = generate_question_explanations(result)

        save_question_explanations(
            student_id=student_id,
            attempt_id=attempt_id,
            question_results=result["question_results"],
            explanations=explanations
        )

        explanation_map = {
            item["question_id"]: item["explanation"]
            for item in explanations
        }

        for item in result["question_results"]:
            item["explanation"] = explanation_map[
                item["question_id"]
            ]

        result["explanation_status"] = "available"

    except Exception as error:
        print("AI EXPLANATION ERROR:", repr(error))

        result["explanation_status"] = "unavailable"

        for item in result["question_results"]:
            item["explanation"] = None

    
    # Generate personalised AI revision notes
    try:
        notes = generate_personalised_notes(result)

        save_personalised_notes(
            student_id=student_id,
            attempt_id=attempt_id,
            performance=result,
            notes=notes
        )

        result["notes_status"] = "available"
        result["personalised_notes"] = notes

    except Exception as error:
        print("AI NOTES ERROR:", repr(error))

        result["notes_status"] = "unavailable"
        result["personalised_notes"] = None


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

    return jsonify(result)