
import json
from db import get_db_connection


def save_quiz_attempt(student_id, performance):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        sql = """
            INSERT INTO quiz_attempts
            (student_id, quiz_type, year_level,
             subject, topic, score,
             total_questions, correct_answers,
             performance_json)
            VALUES (%s, %s, %s, %s, %s,
                    %s, %s, %s, %s)
        """

        values = (
            student_id,
            performance["quiz_type"],
            performance["year"],
            performance["subject"],
            performance["topic"],
            performance["score"],
            performance["total"],
            performance["correct"],
            json.dumps(performance)
        )

        cursor.execute(sql, values)
        connection.commit()

        return cursor.lastrowid

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def save_adaptive_questions(attempt_id, questions):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        sql = """
            INSERT INTO adaptive_questions
            (attempt_id, question_text, options_json,
             correct_answer, explanation, skill)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        question_ids = []

        for question in questions:
            values = (
                attempt_id,
                question["question"],
                json.dumps(question["options"]),
                question["answer"],
                question.get("explanation", ""),
                question["skill"]
            )

            cursor.execute(sql, values)
            question_ids.append(cursor.lastrowid)

        connection.commit()
        return question_ids

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def grade_adaptive_quiz(default_attempt_id, answers):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # Retrieve original default quiz attempt
        cursor.execute("""
            SELECT attempt_id, student_id, year_level,
                   subject, topic, score
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND quiz_type = 'default'
        """, (default_attempt_id,))

        default_attempt = cursor.fetchone()

        if not default_attempt:
            raise ValueError("Default quiz attempt not found.")

        # Retrieve AI-generated questions and answer keys
        cursor.execute("""
            SELECT adaptive_id, question_text,
                   correct_answer, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (default_attempt_id,))

        questions = cursor.fetchall()

        if not questions:
            raise ValueError("No adaptive questions found.")

        # Prevent repeated submissions
        cursor.execute("""
            SELECT attempt_id
            FROM quiz_attempts
            WHERE quiz_type = 'adaptive'
              AND JSON_UNQUOTE(
                  JSON_EXTRACT(performance_json,
                               '$.default_attempt_id')
              ) = %s
            LIMIT 1
        """, (str(default_attempt_id),))

        if cursor.fetchone():
            raise ValueError("Adaptive quiz already submitted.")

        expected_ids = {
            str(q["adaptive_id"]) for q in questions
        }

        if set(answers.keys()) != expected_ids:
            raise ValueError("Submit one answer per question.")

        correct = 0
        question_results = []

        for question in questions:
            question_id = str(question["adaptive_id"])
            student_answer = answers[question_id]
            is_correct = (
                student_answer == question["correct_answer"]
            )

            if is_correct:
                correct += 1

            question_results.append({
                "question_id": question["adaptive_id"],
                "student_answer": student_answer,
                "is_correct": is_correct,
                "skill": question["skill"]
            })

        total = len(questions)
        score = round((correct / total) * 100, 2)
        default_score = float(default_attempt["score"])

        performance = {
            "quiz_type": "adaptive",
            "default_attempt_id": default_attempt_id,
            "score": score,
            "correct": correct,
            "total": total,
            "default_score": default_score,
            "improvement": round(score - default_score, 2),
            "question_results": question_results
        }

        # Save adaptive quiz attempt
        cursor.execute("""
            INSERT INTO quiz_attempts
            (student_id, quiz_type, year_level,
             subject, topic, score,
             total_questions, correct_answers,
             performance_json)
            VALUES (%s, 'adaptive', %s, %s, %s,
                    %s, %s, %s, %s)
        """, (
            default_attempt["student_id"],
            default_attempt["year_level"],
            default_attempt["subject"],
            default_attempt["topic"],
            score,
            total,
            correct,
            json.dumps(performance)
        ))

        adaptive_attempt_id = cursor.lastrowid
        connection.commit()

        performance["attempt_id"] = adaptive_attempt_id
        return performance

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
