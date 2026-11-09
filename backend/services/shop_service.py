
from db import get_db_connection
from services.reward_service import award_missing_quiz_rewards
from services.wallet_service import get_pearl_balance


class ShopError(Exception):
    pass


def get_shop_items():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT item_id, item_name, description,
                   category, price, image_path
            FROM shop_items
            WHERE is_active = TRUE
            ORDER BY price ASC, item_id ASC
        """)
        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


def get_student_wallet(student_id):
    award_missing_quiz_rewards(student_id)
    connection = get_db_connection()

    try:
        return get_pearl_balance(connection, student_id)
    finally:
        connection.close()


def get_student_inventory(student_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT i.inventory_id, i.item_id,
                   s.item_name, s.category,
                   s.image_path, i.is_placed,
                   i.position_x, i.position_y,
                   i.purchased_at
            FROM student_inventory i
            JOIN shop_items s ON i.item_id = s.item_id
            WHERE i.student_id = %s
            ORDER BY i.inventory_id ASC
            """,
            (student_id,)
        )

        items = cursor.fetchall()

        for item in items:
            for field in ("position_x", "position_y"):
                if item[field] is not None:
                    item[field] = float(item[field])

            item["is_placed"] = bool(item["is_placed"])
            item["purchased_at"] = (
                item["purchased_at"].isoformat()
            )

        return items

    finally:
        cursor.close()
        connection.close()


def purchase_decoration(student_id, item_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()

        # Lock this student's row so concurrent
        # purchases are processed one at a time.
        cursor.execute(
            """
            SELECT student_id
            FROM students
            WHERE student_id = %s
            FOR UPDATE
            """,
            (student_id,)
        )

        if cursor.fetchone() is None:
            raise ShopError("Student not found.")

        cursor.execute(
            """
            SELECT item_id, item_name, price
            FROM shop_items
            WHERE item_id = %s AND is_active = TRUE
            """,
            (item_id,)
        )

        item = cursor.fetchone()

        if item is None:
            raise ShopError("Decoration not found.")

        wallet = get_pearl_balance(
            connection, student_id
        )

        if wallet["available_pearls"] < item["price"]:
            raise ShopError("Insufficient pearls.")

        cursor.execute(
            """
            INSERT INTO student_inventory
                (student_id, item_id, is_placed)
            VALUES (%s, %s, FALSE)
            """,
            (student_id, item_id)
        )

        inventory_id = cursor.lastrowid

        # Free items need no spending transaction.
        if item["price"] > 0:
            cursor.execute(
                """
                INSERT INTO pearl_transactions
                    (student_id, inventory_id,
                     amount, transaction_type)
                VALUES (%s, %s, %s, 'purchase')
                """,
                (student_id, inventory_id, item["price"])
            )

        connection.commit()

        return {
            "message": "Decoration purchased successfully!",
            "inventory_id": inventory_id,
            "item_id": item["item_id"],
            "item_name": item["item_name"],
            "pearls_spent": item["price"],
            "remaining_pearls": (
                wallet["available_pearls"] - item["price"]
            )
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
