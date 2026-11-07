
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
              AND quiz_type = 'adaptive'
        """, (attempt_id,))

        attempt = cursor.fetchone()

        if not attempt:
            raise ValueError("Adaptive quiz attempt not found.")

        # Calculate fish and pearls
        score = float(attempt["score"])
        fish_type, pearls = calculate_reward(score)

        # Insert only if reward does not already exist
        cursor.execute("""
            INSERT INTO student_rewards
                (student_id, attempt_id, fish_type, pearls_earned)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE reward_id = reward_id
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
