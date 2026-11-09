
from db import get_db_connection


class DecorationError(Exception):
    pass


def update_decoration_placement(
    student_id, inventory_id, is_placed,
    position_x=None, position_y=None
):
    if type(is_placed) is not bool:
        raise DecorationError("is_placed must be a boolean.")

    if is_placed:
        if (
            type(position_x) not in (int, float)
            or type(position_y) not in (int, float)
            or not 0 <= position_x <= 1
            or not 0 <= position_y <= 1
        ):
            raise DecorationError(
                "Position must be between 0 and 1."
            )
    else:
        position_x = None
        position_y = None

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE student_inventory
            SET is_placed = %s,
                is_unboxed = TRUE,
                position_x = %s,
                position_y = %s
            WHERE inventory_id = %s
              AND student_id = %s
            """,
            (
                is_placed,
                position_x,
                position_y,
                inventory_id,
                student_id
            )
        )

        if cursor.rowcount == 0:
            connection.rollback()
            raise DecorationError(
                "Decoration not found in your inventory."
            )

        connection.commit()

        return {
            "inventory_id": inventory_id,
            "is_placed": is_placed,
            "position_x": position_x,
            "position_y": position_y
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def unbox_decoration(student_id, inventory_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()
        cursor.execute(
            """
            SELECT i.inventory_id, i.item_id, i.is_unboxed,
                   i.is_placed, i.position_x, i.position_y,
                   s.item_name, s.category
            FROM student_inventory i
            JOIN shop_items s ON s.item_id = i.item_id
            WHERE i.inventory_id = %s
              AND i.student_id = %s
            FOR UPDATE
            """,
            (inventory_id, student_id)
        )
        item = cursor.fetchone()

        if item is None:
            raise DecorationError("Parcel not found in your inventory.")

        if item["is_unboxed"]:
            connection.commit()
            return {
                "inventory_id": item["inventory_id"],
                "item_id": item["item_id"],
                "item_name": item["item_name"],
                "category": item["category"],
                "is_unboxed": True,
                "is_placed": bool(item["is_placed"]),
                "position_x": (
                    float(item["position_x"])
                    if item["position_x"] is not None else None
                ),
                "position_y": (
                    float(item["position_y"])
                    if item["position_y"] is not None else None
                )
            }

        cursor.execute(
            """
            SELECT COUNT(*) AS placed_count
            FROM student_inventory
            WHERE student_id = %s
              AND is_placed = TRUE
            """,
            (student_id,)
        )
        placed_count = int(cursor.fetchone()["placed_count"])
        position_x = (0.18, 0.4, 0.62, 0.82)[placed_count % 4]
        position_y = (0.78, 0.84, 0.76, 0.82)[placed_count % 4]

        cursor.execute(
            """
            UPDATE student_inventory
            SET is_unboxed = TRUE,
                is_placed = TRUE,
                position_x = %s,
                position_y = %s
            WHERE inventory_id = %s
              AND student_id = %s
            """,
            (position_x, position_y, inventory_id, student_id)
        )
        connection.commit()

        return {
            "inventory_id": item["inventory_id"],
            "item_id": item["item_id"],
            "item_name": item["item_name"],
            "category": item["category"],
            "is_unboxed": True,
            "is_placed": True,
            "position_x": position_x,
            "position_y": position_y
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
