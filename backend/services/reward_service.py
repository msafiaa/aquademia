
from db import get_db_connection


def calculate_reward(score):
    if score == 100:
        return "Royal Betta", 30
    elif score >= 80:
        return "Angelfish", 20
    elif score >= 60:
        return "Clownfish", 15
    elif score >= 40:
        return "Neon Tetra", 10
    else:
        return "Guppy", 5


def award_quiz_reward(attempt_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # Retrieve quiz attempt from MySQL
        cursor.execute("""
            SELECT attempt_id, student_id, score
            FROM quiz_attempts
            WHERE attempt_id = %s
              AND quiz_type IN ('default', 'adaptive')
        """, (attempt_id,))

        attempt = cursor.fetchone()

        if not attempt:
            raise ValueError("Quiz attempt not found.")

        # Calculate fish and pearls
        score = float(attempt["score"])
        fish_type, pearls = calculate_reward(score)

        # Insert only if reward does not already exist
        cursor.execute("""
            INSERT IGNORE INTO student_rewards
                (student_id, attempt_id, fish_type, pearls_earned)
            VALUES (%s, %s, %s, %s)
        """, (
            attempt["student_id"],
            attempt_id,
            fish_type,
            pearls
        ))

        connection.commit()

        # Retrieve stored reward
        cursor.execute("""
            SELECT reward_id, student_id, attempt_id,
                   fish_type, pearls_earned
            FROM student_rewards
            WHERE attempt_id = %s
        """, (attempt_id,))

        reward = cursor.fetchone()
        return reward

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def award_missing_quiz_rewards(student_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            INSERT IGNORE INTO student_rewards
                (student_id, attempt_id, fish_type, pearls_earned)
            SELECT qa.student_id, qa.attempt_id,
                   CASE
                       WHEN qa.score = 100 THEN 'Royal Betta'
                       WHEN qa.score >= 80 THEN 'Angelfish'
                       WHEN qa.score >= 60 THEN 'Clownfish'
                       WHEN qa.score >= 40 THEN 'Neon Tetra'
                       ELSE 'Guppy'
                   END,
                   CASE
                       WHEN qa.score = 100 THEN 30
                       WHEN qa.score >= 80 THEN 20
                       WHEN qa.score >= 60 THEN 15
                       WHEN qa.score >= 40 THEN 10
                       ELSE 5
                   END
            FROM quiz_attempts qa
            LEFT JOIN student_rewards sr
              ON sr.attempt_id = qa.attempt_id
            WHERE qa.student_id = %s
              AND qa.quiz_type IN ('default', 'adaptive')
              AND sr.attempt_id IS NULL
        """, (student_id,))
        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
