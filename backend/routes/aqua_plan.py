from datetime import date

from flask import Blueprint, jsonify, request, session

from services.aqua_plan_service import (
    complete_task,
    create_plan,
    get_latest_plan,
    update_schedule
)


aqua_plan_bp = Blueprint("aqua_plan", __name__)


@aqua_plan_bp.route("/api/aquaplan", methods=["GET"])
def load_aqua_plan():
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401
    try:
        return jsonify({"plan": get_latest_plan(student_id)}), 200
    except Exception as error:
        print("AQUAPLAN LOAD ERROR:", repr(error))
        return jsonify({"error": "Tidak dapat memuatkan AquaPlan."}), 500


@aqua_plan_bp.route("/api/aquaplan", methods=["POST"])
def generate_aqua_plan():
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Maklumat pelan tidak sah."}), 400

    free_days = data.get("free_days")
    minutes = data.get("minutes_per_day")
    exam_date = data.get("exam_date") or None
    if (
        not isinstance(free_days, list)
        or not free_days
        or any(type(day) is not int or day < 0 or day > 6 for day in free_days)
        or len(set(free_days)) != len(free_days)
    ):
        return jsonify({"error": "Pilih sekurang-kurangnya satu hari lapang."}), 400
    if type(minutes) is not int or minutes not in (10, 20, 30):
        return jsonify({"error": "Masa harian mestilah 10, 20 atau 30 minit."}), 400
    if exam_date:
        try:
            parsed_exam_date = date.fromisoformat(exam_date)
        except (TypeError, ValueError):
            return jsonify({"error": "Tarikh peperiksaan tidak sah."}), 400
        if parsed_exam_date < date.today():
            return jsonify({"error": "Tarikh peperiksaan tidak boleh lepas."}), 400

    try:
        plan = create_plan(student_id, {
            "free_days": free_days,
            "minutes_per_day": minutes,
            "exam_date": exam_date
        })
        return jsonify({"plan": plan}), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 409
    except Exception as error:
        print("AQUAPLAN GENERATION ERROR:", repr(error))
        return jsonify({"error": "Tidak dapat menjana pelan sekarang."}), 500


@aqua_plan_bp.route(
    "/api/aquaplan/<int:plan_id>/complete",
    methods=["POST"]
)
def mark_aqua_plan_task_complete(plan_id):
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    data = request.get_json(silent=True)
    task_id = data.get("task_id") if isinstance(data, dict) else None
    if not isinstance(task_id, str) or not task_id or len(task_id) > 32:
        return jsonify({"error": "Tugasan tidak sah."}), 400

    try:
        result = complete_task(student_id, plan_id, task_id)
        if result is None:
            return jsonify({"error": "Pelan AquaPlan tidak ditemui."}), 404
        return jsonify(result), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        print("AQUAPLAN COMPLETION ERROR:", repr(error))
        return jsonify({"error": "Tidak dapat menyimpan tugasan ini."}), 500


@aqua_plan_bp.route(
    "/api/aquaplan/<int:plan_id>/schedule",
    methods=["POST"]
)
def edit_aqua_plan_schedule(plan_id):
    student_id = session.get("student_id")
    if student_id is None:
        return jsonify({"error": "Login required."}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Maklumat jadual tidak sah."}), 400
    day_date = data.get("date")
    action = data.get("action")
    if not isinstance(day_date, str):
        return jsonify({"error": "Tarikh jadual tidak sah."}), 400
    try:
        date.fromisoformat(day_date)
    except ValueError:
        return jsonify({"error": "Tarikh jadual tidak sah."}), 400
    if action not in ("add_event", "remove_event", "set_busy"):
        return jsonify({"error": "Tindakan jadual tidak sah."}), 400

    try:
        plan = update_schedule(student_id, plan_id, day_date, action, data)
        if plan is None:
            return jsonify({"error": "Pelan AquaPlan tidak ditemui."}), 404
        return jsonify({"plan": plan}), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        print("AQUAPLAN SCHEDULE UPDATE ERROR:", repr(error))
        return jsonify({"error": "Tidak dapat mengemas kini jadual."}), 500
