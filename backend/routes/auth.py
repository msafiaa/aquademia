from flask import Blueprint, jsonify, request, session

from services.auth_service import (
    register_student,
    authenticate_student,
    update_student_profile,
    change_student_password
)

from services.auth_service import register_student
from db import get_db_connection

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid JSON request."
        }), 400

    username = data.get("username")
    password = data.get("password")
    confirm_password = data.get("confirm_password")
    year_level = data.get("year_level")

    if not isinstance(password, str):
        return jsonify({
            "error": "Password is required."
        }), 400

    if password != confirm_password:
        return jsonify({
            "error": "Passwords do not match."
        }), 400

    try:
        student = register_student(
            username,
            password,
            year_level
        )

        return jsonify({
            "message": "Account created successfully!",
            "student": student
        }), 201

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    except Exception as error:
        print("REGISTRATION ERROR:", repr(error))

        return jsonify({
            "error": "Unable to create account."
        }), 500


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON request."}), 400

    student = authenticate_student(
        data.get("username"),
        data.get("password")
    )

    if not student:
        return jsonify({
            "error": "Invalid username or password."
        }), 401

    session.clear()
    session["student_id"] = student["student_id"]

    return jsonify({
        "message": "Login successful!",
        "student": student
    }), 200


@auth_bp.route("/api/auth/me", methods=["GET"])
def current_student():
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({"error": "Not logged in."}), 401

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT student_id, username, year_level
            FROM students
            WHERE student_id = %s
        """, (student_id,))

        student = cursor.fetchone()

        if not student:
            session.clear()
            return jsonify({"error": "Account not found."}), 401

        return jsonify({"student": student}), 200

    finally:
        cursor.close()
        connection.close()


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()

    return jsonify({
        "message": "Logged out successfully!"
    }), 200


@auth_bp.route("/api/auth/update-profile", methods=["POST"])
def update_profile():
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({"error": "Not logged in."}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON request."}), 400

    try:
        student = update_student_profile(
            student_id,
            data.get("username"),
            data.get("year_level")
        )

        return jsonify({
            "message": "Profile updated!",
            "student": student
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    except Exception as error:
        print("PROFILE UPDATE ERROR:", repr(error))

        return jsonify({"error": "Unable to update profile."}), 500


@auth_bp.route("/api/auth/change-password", methods=["POST"])
def change_password():
    student_id = session.get("student_id")

    if student_id is None:
        return jsonify({"error": "Not logged in."}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON request."}), 400

    new_password = data.get("new_password")

    if new_password != data.get("confirm_password"):
        return jsonify({"error": "Passwords do not match."}), 400

    try:
        change_student_password(
            student_id,
            data.get("current_password"),
            new_password
        )

        return jsonify({"message": "Password changed!"}), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    except Exception as error:
        print("PASSWORD CHANGE ERROR:", repr(error))

        return jsonify({"error": "Unable to change password."}), 500