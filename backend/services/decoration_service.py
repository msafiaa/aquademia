
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
