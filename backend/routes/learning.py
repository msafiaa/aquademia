
import json

from flask import Blueprint, jsonify, session
from db import get_db_connection
from services.notes_service import (
    generate_personalised_notes,
    save_personalised_notes
)

learning_bp = Blueprint("learning", __name__)


def parse_json(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


@learning_bp.route("/api/learning/notes/<int:attempt_id>", methods=["GET"])
def get_notes(attempt_id):
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT ln.note_id, ln.attempt_id, ln.subject,
                   ln.topic, ln.weak_skills_json, ln.notes_json,
                   ln.created_at
            FROM learning_notes ln
            JOIN quiz_attempts qa ON ln.attempt_id = qa.attempt_id
            WHERE ln.attempt_id = %s
              AND ln.student_id = %s
              AND qa.student_id = %s
              AND qa.quiz_type = 'default'
        """, (attempt_id, student_id, student_id))

        note = cursor.fetchone()

        if note:
            note["weak_skills_json"] = parse_json(note["weak_skills_json"])
            note["notes_json"] = parse_json(note["notes_json"])
            notes_content = note["notes_json"]
        else:
            notes_content = None

        if (
            not isinstance(notes_content, dict)
            or not notes_content.get("key_concepts")
        ):
            cursor.execute("""
                SELECT year_level, subject, topic, performance_json
                FROM quiz_attempts
                WHERE attempt_id = %s
                  AND student_id = %s
                  AND quiz_type = 'default'
            """, (attempt_id, student_id))
            attempt = cursor.fetchone()
            if not attempt:
                return jsonify({"error": "Quiz attempt not found."}), 404

            performance = parse_json(attempt["performance_json"]) or {}
            performance.update({
                "year": attempt["year_level"],
                "subject": attempt["subject"],
                "topic": attempt["topic"]
            })
            performance.setdefault("weak_skills", {})

            notes_content = generate_personalised_notes(performance)
            save_personalised_notes(
                student_id,
                attempt_id,
                performance,
                notes_content
            )
            note = {
                "attempt_id": attempt_id,
                "subject": attempt["subject"],
                "topic": attempt["topic"],
                "weak_skills_json": performance["weak_skills"],
                "notes_json": notes_content
            }

        if note and not isinstance(note.get("notes_json"), dict):
            note["notes_json"] = parse_json(note["notes_json"])

        return jsonify(note), 200

    finally:
        cursor.close()
        connection.close()


@learning_bp.route(
    "/api/learning/explanations/<int:attempt_id>",
    methods=["GET"]
)
def get_explanations(attempt_id):
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
            SELECT qe.explanation_id, qe.question_id, qe.student_answer,
                   qe.correct_answer, qe.is_correct, qe.explanation,
                   q.question_text
            FROM question_explanations qe
            LEFT JOIN questions q ON q.question_id = qe.question_id
            WHERE qe.attempt_id = %s AND qe.student_id = %s
            ORDER BY qe.explanation_id
        """, (attempt_id, student_id))

        explanations = cursor.fetchall()

        return jsonify({
            "attempt_id": attempt_id,
            "explanations": explanations
        }), 200

    finally:
        cursor.close()
        connection.close()


@learning_bp.route("/api/learning/history", methods=["GET"])
def get_learning_history():
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT qa.attempt_id, qa.year_level, qa.subject,
                   qa.topic, qa.score, qa.total_questions,
                   qa.correct_answers, qa.created_at,
                   CASE WHEN ln.note_id IS NOT NULL
                        THEN TRUE ELSE FALSE END AS has_notes
            FROM quiz_attempts qa
            LEFT JOIN learning_notes ln
              ON qa.attempt_id = ln.attempt_id
             AND qa.student_id = ln.student_id
            WHERE qa.student_id = %s
              AND qa.quiz_type = 'default'
            ORDER BY qa.created_at DESC, qa.attempt_id DESC
            LIMIT 50
        """, (student_id,))

        history = cursor.fetchall()

        for attempt in history:
            attempt["score"] = float(attempt["score"])
            attempt["has_notes"] = bool(attempt["has_notes"])

        return jsonify({"history": history}), 200

    finally:
        cursor.close()
        connection.close()
