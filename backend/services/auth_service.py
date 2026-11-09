import re

from werkzeug.security import generate_password_hash
from mysql.connector import IntegrityError
from werkzeug.security import check_password_hash
from db import get_db_connection


def register_student(username, password, year_level):
    # Validate username
    if not isinstance(username, str):
        raise ValueError("Username must be a string.")

    username = username.strip()

    if not re.fullmatch(r"[A-Za-z0-9_]{3,30}", username):
        raise ValueError(
            "Username must be 3-30 characters "
            "and contain only letters, numbers or underscores."
        )

    # Validate password
    if not isinstance(password, str):
        raise ValueError("Password must be a string.")

    if len(password) < 8 or len(password) > 128:
        raise ValueError(
            "Password must be between 8 and 128 characters."
        )

    # Validate year level
    if type(year_level) is not int or year_level not in (4, 5, 6):
        raise ValueError("Year level must be 4, 5 or 6.")

    # Never store plaintext passwords
    password_hash = generate_password_hash(password)

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            INSERT INTO students
                (username, year_level, password_hash)
            VALUES (%s, %s, %s)
        """, (username, year_level, password_hash))

        connection.commit()

        return {
            "student_id": cursor.lastrowid,
            "username": username,
            "year_level": year_level
        }

    except IntegrityError as error:
        connection.rollback()

        if error.errno == 1062:
            raise ValueError("Username already exists.") from error

        raise

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def authenticate_student(username, password):
    if not isinstance(username, str) or not isinstance(password, str):
        return None

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT student_id, username, year_level, password_hash
            FROM students
            WHERE username = %s
        """, (username.strip(),))

        student = cursor.fetchone()

        if not student or not student["password_hash"]:
            return None

        if not check_password_hash(student["password_hash"], password):
            return None

        return {
            "student_id": student["student_id"],
            "username": student["username"],
            "year_level": student["year_level"]
        }

    finally:
        cursor.close()
        connection.close()


def update_student_profile(student_id, username, year_level):
    """Change a student's username and/or year level (None = leave unchanged)."""
    fields = []
    values = []

    if username is not None:
        if not isinstance(username, str):
            raise ValueError("Username must be a string.")

        username = username.strip()

        if not re.fullmatch(r"[A-Za-z0-9_]{3,30}", username):
            raise ValueError(
                "Username must be 3-30 characters "
                "and contain only letters, numbers or underscores."
            )

        fields.append("username = %s")
        values.append(username)

    if year_level is not None:
        if type(year_level) is not int or year_level not in (4, 5, 6):
            raise ValueError("Year level must be 4, 5 or 6.")

        fields.append("year_level = %s")
        values.append(year_level)

    if not fields:
        raise ValueError("Nothing to update.")

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            "UPDATE students SET " + ", ".join(fields) + " WHERE student_id = %s",
            tuple(values) + (student_id,)
        )
        connection.commit()

        cursor.execute("""
            SELECT student_id, username, year_level
            FROM students
            WHERE student_id = %s
        """, (student_id,))

        student = cursor.fetchone()

        if not student:
            raise ValueError("Account not found.")

        return student

    except IntegrityError as error:
        connection.rollback()

        if error.errno == 1062:
            raise ValueError("Username already exists.") from error

        raise

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def change_student_password(student_id, current_password, new_password):
    if not isinstance(current_password, str) or not isinstance(new_password, str):
        raise ValueError("Password must be a string.")

    if len(new_password) < 8 or len(new_password) > 128:
        raise ValueError("Password must be between 8 and 128 characters.")

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT password_hash
            FROM students
            WHERE student_id = %s
        """, (student_id,))

        row = cursor.fetchone()

        if (
            not row
            or not row["password_hash"]
            or not check_password_hash(row["password_hash"], current_password)
        ):
            raise ValueError("Current password is incorrect.")

        cursor.execute("""
            UPDATE students
            SET password_hash = %s
            WHERE student_id = %s
        """, (generate_password_hash(new_password), student_id))

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()