from datetime import date
from flask import Blueprint, jsonify, request
from services.aquarium_service import (
    get_aquarium_data,
    get_lifetime_stats,
    get_aquarium_history
)

aquarium_bp = Blueprint("aquarium", __name__)


@aquarium_bp.route("/api/aquarium", methods=["GET"])
def get_aquarium():
    month_param = request.args.get("month")
    view = request.args.get("view", "weekly")

    if view not in ("weekly", "monthly"):
        return jsonify({
            "error": "View must be weekly or monthly."
        }), 400

    if not month_param:
        month_param = date.today().strftime("%Y-%m")

    try:
        selected_month = date.fromisoformat(
            month_param + "-01"
        )
    except ValueError:
        return jsonify({
            "error": "Invalid month. Use YYYY-MM."
        }), 400

    # Temporary demo student
    student_id = 1

    try:
        data = get_aquarium_data(
            student_id,
            selected_month.year,
            selected_month.month
        )

        if view == "weekly":
            return jsonify({
                "view": "weekly",
                "month": data["month"],
                "student_id": student_id,
                "aquariums": data["aquariums"]
            })

        return jsonify({
            "view": "monthly",
            "month": data["month"],
            "student_id": student_id,
            "monthly_ocean": data["monthly_ocean"]
        })

    except Exception as error:
        print("AQUARIUM ERROR:", repr(error))
        return jsonify({
            "error": "Unable to load aquarium."
        }), 500


@aquarium_bp.route("/api/aquarium/stats", methods=["GET"])
def aquarium_stats():
    student_id = 1  # Temporary demo student

    try:
        stats = get_lifetime_stats(student_id)
        return jsonify(stats)

    except Exception as error:
        print("AQUARIUM STATS ERROR:", repr(error))
        return jsonify({
            "error": "Unable to load aquarium stats."
        }), 500


@aquarium_bp.route("/api/aquarium/history", methods=["GET"])
def aquarium_history():
    student_id = 1  # Temporary demo student

    try:
        history = get_aquarium_history(student_id)

        return jsonify({
            "student_id": student_id,
            "history": history
        })

    except Exception as error:
        print("AQUARIUM HISTORY ERROR:", repr(error))
        return jsonify({
            "error": "Unable to load aquarium history."
        }), 500
