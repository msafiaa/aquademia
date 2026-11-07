
from datetime import date
from calendar import monthrange

from db import get_db_connection


def get_aquarium_data(student_id, year, month):
    first_day = date(year, month, 1)

    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                reward_id,
                attempt_id,
                fish_type,
                pearls_earned,
                created_at
            FROM student_rewards
            WHERE student_id = %s
              AND created_at >= %s
              AND created_at < %s
            ORDER BY created_at, reward_id
        """, (student_id, first_day, next_month))

        rewards = cursor.fetchall()

        # Always create exactly four aquariums
        last_day = monthrange(year, month)[1]

        aquariums = [
            {
                "week": 1,
                "start_day": 1,
                "end_day": 7,
                "fish": []
            },
            {
                "week": 2,
                "start_day": 8,
                "end_day": 14,
                "fish": []
            },
            {
                "week": 3,
                "start_day": 15,
                "end_day": 21,
                "fish": []
            },
            {
                "week": 4,
                "start_day": 22,
                "end_day": last_day,
                "fish": []
            }
        ]

        monthly_fish = []
        monthly_pearls = 0

        for reward in rewards:
            day = reward["created_at"].day
            week_index = min((day - 1) // 7, 3)

            fish = {
                "reward_id": reward["reward_id"],
                "attempt_id": reward["attempt_id"],
                "fish_type": reward["fish_type"],
                "pearls_earned": reward["pearls_earned"],
                "earned_at": reward["created_at"].isoformat()
            }

            aquariums[week_index]["fish"].append(fish)
            monthly_fish.append(fish)
            monthly_pearls += reward["pearls_earned"]

        for aquarium in aquariums:
            aquarium["fish_count"] = len(aquarium["fish"])
            aquarium["pearls_earned"] = sum(
                fish["pearls_earned"]
                for fish in aquarium["fish"]
            )

        return {
            "month": f"{year}-{month:02d}",
            "student_id": student_id,
            "aquariums": aquariums,
            "monthly_ocean": {
                "fish": monthly_fish,
                "fish_count": len(monthly_fish),
                "pearls_earned": monthly_pearls
            }
        }

    finally:
        cursor.close()
        connection.close()


def get_lifetime_stats(student_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                COUNT(*) AS total_fish,
                COALESCE(SUM(pearls_earned), 0)
                    AS total_pearls
            FROM student_rewards
            WHERE student_id = %s
        """, (student_id,))

        stats = cursor.fetchone()

        return {
            "student_id": student_id,
            "total_fish": int(stats["total_fish"]),
            "total_pearls": int(stats["total_pearls"])
        }

    finally:
        cursor.close()
        connection.close()


def get_aquarium_history(student_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                DATE_FORMAT(created_at, '%Y-%m')
                    AS month,
                COUNT(*) AS fish_count,
                COALESCE(SUM(pearls_earned), 0)
                    AS pearls_earned
            FROM student_rewards
            WHERE student_id = %s
            GROUP BY
                YEAR(created_at),
                MONTH(created_at)
            ORDER BY
                YEAR(created_at) DESC,
                MONTH(created_at) DESC
        """, (student_id,))

        rows = cursor.fetchall()

        return [
            {
                "month": row["month"],
                "fish_count": int(row["fish_count"]),
                "pearls_earned": int(row["pearls_earned"])
            }
            for row in rows
        ]

    finally:
        cursor.close()
        connection.close()
