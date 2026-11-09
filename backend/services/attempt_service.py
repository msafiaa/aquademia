
import json
from db import get_db_connection
from services.ai_service import generate_verified_adaptive_quiz


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


def get_or_create_adaptive_questions(attempt_id, student_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT year_level, subject, topic, performance_json
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND student_id = %s
              AND quiz_type = 'default'
        """, (attempt_id, student_id))
        attempt = cursor.fetchone()

        if not attempt:
            return None

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (attempt_id,))
        existing_questions = cursor.fetchall()

        cursor.execute("""
            SELECT question_id, skill, question_text, options_json,
                   correct_answer
            FROM questions
            WHERE year_level = %s
              AND subject = %s
              AND topic = %s
            ORDER BY question_id
        """, (
            attempt["year_level"],
            attempt["subject"],
            attempt["topic"]
        ))
        topic_questions = cursor.fetchall()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()

    performance = attempt["performance_json"]
    if isinstance(performance, str):
        performance = json.loads(performance)
    if not isinstance(performance, dict):
        performance = {}

    weak_skills = {
        str(result.get("skill"))
        for result in performance.get("question_results", [])
        if not result.get("is_correct") and result.get("skill")
    }

    source_questions = []
    for question in topic_questions:
        if question["skill"] not in weak_skills:
            continue
        options = question["options_json"]
        if isinstance(options, str):
            options = json.loads(options)
        if (
            not isinstance(options, list)
            or len(options) != 4
            or len(set(options)) != 4
            or question["correct_answer"] not in options
        ):
            continue
        source_questions.append({
            "id": question["question_id"],
            "skill": question["skill"],
            "question": question["question_text"],
            "options": options,
            "correct_answer": question["correct_answer"]
        })

    bank_question_texts = {
        question["question_text"].strip()
        for question in topic_questions
    }
    is_legacy_bank_copy = any(
        question["question_text"].strip() in bank_question_texts
        for question in existing_questions
    )

    if existing_questions and not is_legacy_bank_copy:
        return _format_adaptive_questions(existing_questions)

    if not weak_skills:
        return []

    performance["weak_skills"] = {
        skill: sum(
            1
            for result in performance.get("question_results", [])
            if not result.get("is_correct") and result.get("skill") == skill
        )
        for skill in weak_skills
    }

    if not source_questions:
        raise ValueError("No verified questions found for the weak skills.")

    generated = generate_verified_adaptive_quiz(
        performance,
        source_questions,
        question_count=1,
        exclude_questions=[
            question["question_text"]
            for question in existing_questions
        ]
    )["questions"]

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT attempt_id
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND student_id = %s
              AND quiz_type = 'default'
            FOR UPDATE
        """, (attempt_id, student_id))
        if not cursor.fetchone():
            return None

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (attempt_id,))
        existing_questions = cursor.fetchall()

        cursor.execute("""
            SELECT attempt_id
            FROM quiz_attempts
            WHERE quiz_type = 'adaptive'
              AND JSON_UNQUOTE(
                  JSON_EXTRACT(performance_json,
                               '$.default_attempt_id')
              ) = %s
            LIMIT 1
        """, (str(attempt_id),))
        if cursor.fetchone():
            return _format_adaptive_questions(existing_questions)

        if existing_questions and not is_legacy_bank_copy:
            return _format_adaptive_questions(existing_questions)

        if existing_questions and is_legacy_bank_copy:
            cursor.execute("""
                SELECT attempt_id
                FROM quiz_attempts
                WHERE quiz_type = 'adaptive'
                  AND JSON_UNQUOTE(
                      JSON_EXTRACT(performance_json,
                                   '$.default_attempt_id')
                  ) = %s
                LIMIT 1
            """, (str(attempt_id),))
            if cursor.fetchone():
                return _format_adaptive_questions(existing_questions)
            cursor.execute(
                "DELETE FROM adaptive_questions WHERE attempt_id = %s",
                (attempt_id,)
            )

        cursor.executemany("""
            INSERT INTO adaptive_questions
            (attempt_id, question_text, options_json,
             correct_answer, explanation, skill)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [
            (
                attempt_id,
                question["question"],
                json.dumps(question["options"]),
                question["answer"],
                question.get("explanation", ""),
                question["skill"]
            )
            for question in generated
        ])
        connection.commit()

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (attempt_id,))
        return _format_adaptive_questions(cursor.fetchall())

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def generate_more_adaptive_questions(attempt_id, student_id, count=1):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT year_level, subject, topic, performance_json
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND student_id = %s
              AND quiz_type = 'default'
            FOR UPDATE
        """, (attempt_id, student_id))
        attempt = cursor.fetchone()
        if not attempt:
            return None

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (attempt_id,))
        existing = cursor.fetchall()

        cursor.execute("""
            SELECT question_id, skill, question_text, options_json,
                   correct_answer
            FROM questions
            WHERE year_level = %s
              AND subject = %s
              AND topic = %s
            ORDER BY question_id
        """, (
            attempt["year_level"],
            attempt["subject"],
            attempt["topic"]
        ))
        topic_questions = cursor.fetchall()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    performance = attempt["performance_json"]
    if isinstance(performance, str):
        performance = json.loads(performance)
    if not isinstance(performance, dict):
        performance = {}

    weak_skills = {
        str(result.get("skill"))
        for result in performance.get("question_results", [])
        if not result.get("is_correct") and result.get("skill")
    }
    if not weak_skills:
        raise ValueError("Tiada kemahiran lemah untuk dijadikan fokus.")

    performance["weak_skills"] = {
        skill: sum(
            1
            for result in performance.get("question_results", [])
            if not result.get("is_correct") and result.get("skill") == skill
        )
        for skill in weak_skills
    }

    source_questions = []
    for question in topic_questions:
        if question["skill"] not in weak_skills:
            continue
        options = question["options_json"]
        if isinstance(options, str):
            options = json.loads(options)
        if (
            isinstance(options, list)
            and len(options) == 4
            and len(set(options)) == 4
            and question["correct_answer"] in options
        ):
            source_questions.append({
                "id": question["question_id"],
                "skill": question["skill"],
                "question": question["question_text"],
                "options": options,
                "correct_answer": question["correct_answer"]
            })
    if not source_questions:
        raise ValueError("Tiada rujukan sah untuk kemahiran ini.")

    generated = generate_verified_adaptive_quiz(
        performance,
        source_questions,
        question_count=count,
        exclude_questions=[
            question["question_text"] for question in existing
        ]
    )["questions"]

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT attempt_id
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND student_id = %s
              AND quiz_type = 'default'
            FOR UPDATE
        """, (attempt_id, student_id))
        if not cursor.fetchone():
            return None

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
            ORDER BY adaptive_id
        """, (attempt_id,))
        latest = cursor.fetchall()
        existing_ids = {question["adaptive_id"] for question in latest}
        if existing_ids != {question["adaptive_id"] for question in existing}:
            raise ValueError("Soalan latihan berubah. Muat semula dan cuba lagi.")

        last_existing_id = max(existing_ids, default=0)
        cursor.executemany("""
            INSERT INTO adaptive_questions
            (attempt_id, question_text, options_json,
             correct_answer, explanation, skill)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [
            (
                attempt_id,
                question["question"],
                json.dumps(question["options"]),
                question["answer"],
                question.get("explanation", ""),
                question["skill"]
            )
            for question in generated
        ])
        connection.commit()

        cursor.execute("""
            SELECT adaptive_id, question_text, options_json, skill
            FROM adaptive_questions
            WHERE attempt_id = %s
              AND adaptive_id > %s
            ORDER BY adaptive_id
        """, (attempt_id, last_existing_id))
        return _format_adaptive_questions(cursor.fetchall())
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def answer_adaptive_question(attempt_id, adaptive_id, student_id, answer):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT aq.adaptive_id, aq.question_text,
                   aq.correct_answer, aq.explanation, aq.skill
            FROM adaptive_questions aq
            JOIN quiz_attempts qa ON qa.attempt_id = aq.attempt_id
            WHERE aq.adaptive_id = %s
              AND aq.attempt_id = %s
              AND qa.student_id = %s
              AND qa.quiz_type = 'default'
        """, (adaptive_id, attempt_id, student_id))
        question = cursor.fetchone()
        if not question:
            raise ValueError("Soalan latihan tidak ditemui.")

        cursor.execute("""
            SELECT options_json
            FROM adaptive_questions
            WHERE adaptive_id = %s
              AND attempt_id = %s
        """, (adaptive_id, attempt_id))
        options_row = cursor.fetchone()
        options = options_row["options_json"]
        if isinstance(options, str):
            options = json.loads(options)
        if answer not in options:
            raise ValueError("Jawapan tidak sah untuk soalan ini.")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS adaptive_practice_answers (
                answer_id BIGINT NOT NULL AUTO_INCREMENT,
                student_id INT NOT NULL,
                source_attempt_id INT NOT NULL,
                adaptive_id INT NOT NULL,
                selected_answer VARCHAR(255) NOT NULL,
                is_correct TINYINT(1) NOT NULL,
                answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (answer_id),
                UNIQUE KEY uq_adaptive_practice_student_question
                    (student_id, adaptive_id),
                KEY idx_adaptive_practice_source
                    (student_id, source_attempt_id, answered_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        cursor.execute("""
            INSERT IGNORE INTO adaptive_practice_answers
                (student_id, source_attempt_id, adaptive_id,
                 selected_answer, is_correct)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            student_id,
            attempt_id,
            adaptive_id,
            answer,
            answer == question["correct_answer"]
        ))

        cursor.execute("""
            SELECT selected_answer, is_correct, answered_at
            FROM adaptive_practice_answers
            WHERE student_id = %s
              AND adaptive_id = %s
        """, (student_id, adaptive_id))
        saved = cursor.fetchone()
        connection.commit()

        return {
            "adaptive_id": question["adaptive_id"],
            "question": question["question_text"],
            "skill": question["skill"],
            "selected_answer": saved["selected_answer"],
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"],
            "is_correct": bool(saved["is_correct"]),
            "answered_at": saved["answered_at"]
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def get_adaptive_practice_history(attempt_id, student_id):
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
            return None

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS adaptive_practice_answers (
                answer_id BIGINT NOT NULL AUTO_INCREMENT,
                student_id INT NOT NULL,
                source_attempt_id INT NOT NULL,
                adaptive_id INT NOT NULL,
                selected_answer VARCHAR(255) NOT NULL,
                is_correct TINYINT(1) NOT NULL,
                answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (answer_id),
                UNIQUE KEY uq_adaptive_practice_student_question
                    (student_id, adaptive_id),
                KEY idx_adaptive_practice_source
                    (student_id, source_attempt_id, answered_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        cursor.execute("""
            SELECT h.answer_id, h.adaptive_id, h.selected_answer,
                   h.is_correct, h.answered_at, aq.question_text,
                   aq.correct_answer, aq.explanation, aq.skill
            FROM adaptive_practice_answers h
            JOIN adaptive_questions aq
              ON aq.adaptive_id = h.adaptive_id
             AND aq.attempt_id = h.source_attempt_id
            WHERE h.student_id = %s
              AND h.source_attempt_id = %s
            ORDER BY h.answered_at DESC, h.answer_id DESC
        """, (student_id, attempt_id))
        history = cursor.fetchall()
        for item in history:
            item["is_correct"] = bool(item["is_correct"])
        return history
    finally:
        cursor.close()
        connection.close()


def _format_adaptive_questions(questions):
    formatted = []
    for question in questions:
        options = question["options_json"]
        formatted.append({
            "id": question["adaptive_id"],
            "question": question["question_text"],
            "options": json.loads(options) if isinstance(options, str) else options,
            "skill": question["skill"]
        })
    return formatted


def grade_adaptive_quiz(default_attempt_id, answers, student_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # Retrieve original default quiz attempt
        cursor.execute("""
            SELECT
                attempt_id,
                student_id,
                year_level,
                subject,
                topic,
                score
            FROM quiz_attempts
            WHERE attempt_id = %s
            AND student_id = %s
            AND quiz_type = 'default'
            FOR UPDATE
        """, (default_attempt_id, student_id))

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
            SELECT attempt_id, score, performance_json
            FROM quiz_attempts
            WHERE quiz_type = 'adaptive'
              AND JSON_UNQUOTE(
                  JSON_EXTRACT(performance_json,
                               '$.default_attempt_id')
              ) = %s
            LIMIT 1
        """, (str(default_attempt_id),))

        previous_attempt = cursor.fetchone()
        if previous_attempt:
            previous_result = previous_attempt["performance_json"]
            if isinstance(previous_result, str):
                previous_result = json.loads(previous_result)
            if not isinstance(previous_result, dict):
                previous_result = {}
            previous_result["attempt_id"] = previous_attempt["attempt_id"]
            previous_result["score"] = float(previous_attempt["score"])
            connection.commit()
            return previous_result

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
