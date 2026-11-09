import json
from db import get_db_connection


def _image_url(path):
    """DB stores e.g. 'images/questions/x.png' -> browser needs '/static/images/questions/x.png'."""
    if not path:
        return None

    path = str(path).strip().replace("\\", "/")

    if not path:
        return None

    if path.startswith(("http://", "https://", "/")):
        return path

    if path.startswith("static/"):
        path = path[len("static/"):]

    return "/static/" + path


def get_topics(year, subject):
    """Topics that really have questions for this year + subject (in import order)."""
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT topic, COUNT(*) AS question_count
            FROM questions
            WHERE year_level = %s
              AND subject = %s
            GROUP BY topic
            ORDER BY MIN(question_id)
            """,
            (year, subject)
        )

        return [
            {"topic": row["topic"], "count": row["question_count"]}
            for row in cursor.fetchall()
        ]

    finally:
        cursor.close()
        connection.close()


def get_default_questions(year, subject, topic):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT question_id, year_level, subject,
                   topic, skill, question_text,
                   options_json, correct_answer, image_path
            FROM questions
            WHERE year_level = %s
              AND subject = %s
              AND topic = %s
            ORDER BY question_id
            """,
            (year, subject, topic)
        )

        rows = cursor.fetchall()
        questions = []

        for row in rows:
            options = row["options_json"]

            if isinstance(options, str):
                options = json.loads(options)

            questions.append({
                "id": row["question_id"],
                "year": row["year_level"],
                "subject": row["subject"],
                "topic": row["topic"],
                "skill": row["skill"],
                "question": row["question_text"],
                "options": options,
                "answer": row["correct_answer"],
                "image_path": _image_url(row.get("image_path"))
            })

        return questions

    finally:
        cursor.close()
        connection.close()