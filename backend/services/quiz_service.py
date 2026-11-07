
import json
from db import get_db_connection


def get_default_questions(year, subject, topic):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT question_id, year_level, subject,
                   topic, skill, question_text,
                   options_json, correct_answer
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
                "answer": row["correct_answer"]
            })

        return questions

    finally:
        cursor.close()
        connection.close()
