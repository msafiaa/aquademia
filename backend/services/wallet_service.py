
def get_pearl_balance(connection, student_id):
    """
    Calculate a student's pearl balance.

    Use the supplied database connection so the
    calculation can participate in a transaction.
    """
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT COALESCE(SUM(pearls_earned), 0) AS earned
            FROM student_rewards
            WHERE student_id = %s
            """,
            (student_id,)
        )
        earned = int(cursor.fetchone()["earned"])

        cursor.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS spent
            FROM pearl_transactions
            WHERE student_id = %s
            """,
            (student_id,)
        )
        spent = int(cursor.fetchone()["spent"])

        return {
            "student_id": student_id,
            "lifetime_pearls": earned,
            "spent_pearls": spent,
            "available_pearls": earned - spent
        }

    finally:
        cursor.close()
