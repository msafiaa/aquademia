import json
from datetime import date, datetime, timedelta
from uuid import uuid4

PLAN_TABLES_SQL = (
    """
    CREATE TABLE IF NOT EXISTS aqua_plans (
        plan_id INT NOT NULL AUTO_INCREMENT,
        student_id INT NOT NULL,
        preferences_json LONGTEXT NOT NULL,
        plan_json LONGTEXT NOT NULL,
        source_attempt_id INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (plan_id),
        KEY idx_aqua_plans_student (student_id, plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS aqua_plan_completions (
        completion_id BIGINT NOT NULL AUTO_INCREMENT,
        plan_id INT NOT NULL,
        student_id INT NOT NULL,
        task_id VARCHAR(32) NOT NULL,
        completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (completion_id),
        UNIQUE KEY uq_aqua_plan_task (plan_id, task_id),
        KEY idx_aqua_plan_completions_student (student_id, plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS aqua_plan_rewards (
        reward_id BIGINT NOT NULL AUTO_INCREMENT,
        plan_id INT NOT NULL,
        student_id INT NOT NULL,
        reward_key VARCHAR(40) NOT NULL,
        pearls_earned INT NOT NULL,
        reward_label VARCHAR(100) NOT NULL,
        inventory_id INT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (reward_id),
        UNIQUE KEY uq_aqua_plan_reward (plan_id, reward_key),
        KEY idx_aqua_plan_rewards_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """
)

DAYS = (
    "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"
)


def _get_db_connection():
    from db import get_db_connection

    return get_db_connection()


def ensure_plan_tables(cursor):
    for statement in PLAN_TABLES_SQL:
        cursor.execute(statement)
    cursor.execute("SHOW COLUMNS FROM aqua_plans LIKE %s", ("source_attempt_id",))
    if not cursor.fetchone():
        cursor.execute("""
            ALTER TABLE aqua_plans
            ADD COLUMN source_attempt_id INT NOT NULL DEFAULT 0
        """)


def _json_value(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def _plan_task_ids(plan):
    return {
        task["task_id"]
        for day in plan["days"]
        for task in day["tasks"]
    }


def _is_week_complete(completed_ids, plan):
    current_task_ids = _plan_task_ids(plan)
    minimum_task_count = int(
        plan.get("bonus_task_count", len(current_task_ids))
    )
    return (
        len(current_task_ids) >= minimum_task_count
        and current_task_ids.issubset(completed_ids)
    )


def _catch_up_day(plan):
    catch_up = next(
        (item for item in plan["days"] if item.get("is_catch_up")),
        None
    )
    if catch_up:
        return catch_up

    last_date = max(
        date.fromisoformat(item["date"]) for item in plan["days"]
    )
    catch_up_date = last_date + timedelta(days=1)
    catch_up = {
        "day_number": max(item["day_number"] for item in plan["days"]) + 1,
        "weekday": DAYS[catch_up_date.weekday()],
        "date": catch_up_date.isoformat(),
        "is_free": True,
        "is_catch_up": True,
        "tasks": [],
        "events": []
    }
    plan["days"].append(catch_up)
    return catch_up


def _set_day_busy(plan, day, is_busy, completed_ids):
    day["is_busy"] = is_busy
    if is_busy:
        tasks_to_move = [
            task for task in day["tasks"]
            if task["task_id"] not in completed_ids
        ]
        day["tasks"] = [
            task for task in day["tasks"]
            if task["task_id"] in completed_ids
        ]
        if tasks_to_move:
            catch_up = _catch_up_day(plan)
            for task in tasks_to_move:
                moved_task = dict(task)
                moved_task["moved_from_date"] = day["date"]
                catch_up["tasks"].append(moved_task)
    else:
        for catch_up in list(plan["days"]):
            if not catch_up.get("is_catch_up"):
                continue
            returning_tasks = [
                task for task in catch_up["tasks"]
                if task.get("moved_from_date") == day["date"]
                and task["task_id"] not in completed_ids
            ]
            for task in returning_tasks:
                task.pop("moved_from_date", None)
            day["tasks"].extend(returning_tasks)
            catch_up["tasks"] = [
                task for task in catch_up["tasks"]
                if task not in returning_tasks
            ]
            if not catch_up["tasks"] and not catch_up.get("events"):
                plan["days"].remove(catch_up)


def _focus_skills(attempts):
    skill_stats = {}
    topic_stats = {}

    for rank, attempt in enumerate(attempts):
        performance = _json_value(attempt.get("performance_json")) or {}
        results = performance.get("question_results", [])
        if not isinstance(results, list):
            continue

        for result in results:
            if not isinstance(result, dict):
                continue
            subject = attempt.get("subject") or "Mathematics"
            topic = attempt.get("topic") or "Ulang Kaji"
            skill = str(result.get("skill") or "umum").strip()
            key = (subject, topic, skill)
            stats = skill_stats.setdefault(key, {
                "errors": 0, "questions": 0, "weighted_errors": 0.0,
                "attempt_id": None
            })
            stats["questions"] += 1
            if not result.get("is_correct"):
                stats["errors"] += 1
                stats["weighted_errors"] += 1 / (1 + rank * 0.15)
                if stats["attempt_id"] is None:
                    stats["attempt_id"] = attempt.get("attempt_id")

            topic_key = (subject, topic)
            topic_stats.setdefault(topic_key, {
                "subject": subject,
                "topic": topic,
                "year": attempt.get("year_level", 4),
                "attempt_id": attempt.get("attempt_id"),
                "score": float(attempt.get("score") or 0)
            })

    weak = []
    for (subject, topic, skill), stats in skill_stats.items():
        if not stats["errors"]:
            continue
        accuracy = (
            (stats["questions"] - stats["errors"]) / stats["questions"]
        )
        weak.append({
            "subject": subject,
            "topic": topic,
            "skill": skill,
            "errors": stats["errors"],
            "accuracy": accuracy,
            "priority": stats["weighted_errors"] * (1.25 - accuracy),
            "attempt_id": stats["attempt_id"]
        })

    weak.sort(
        key=lambda item: (
            -item["priority"], -item["errors"], item["subject"], item["topic"]
        )
    )
    if weak:
        return weak[:3], "weakness"

    if topic_stats:
        latest = next(iter(topic_stats.values()))
        return [{
            "subject": latest["subject"],
            "topic": latest["topic"],
            "skill": "Ulang kaji campuran",
            "errors": 0,
            "accuracy": latest["score"] / 100,
            "priority": 0,
            "attempt_id": latest["attempt_id"]
        }], "maintenance"

    return [{
        "subject": "Mathematics",
        "topic": "Topik pilihan",
        "skill": "Kuiz diagnostik",
        "errors": 0,
        "accuracy": 0,
        "priority": 0,
        "attempt_id": None
    }], "starter"


def build_weekly_plan(preferences, attempts, start_date=None):
    start_date = start_date or date.today()
    minutes = preferences["minutes_per_day"]
    free_days = set(preferences["free_days"])
    exam_date = preferences.get("exam_date") or None
    focus, mode = _focus_skills(attempts)

    if minutes == 10:
        task_slots = [("notes", 5), ("adaptive", 5)]
    elif minutes == 20:
        task_slots = [("notes", 5), ("adaptive", 10), ("quiz", 5)]
    else:
        task_slots = [
            ("notes", 5), ("adaptive", 10), ("quiz", 10), ("notes", 5)
        ]

    days = []
    active_offsets = [
        offset for offset in range(7)
        if (start_date + timedelta(days=offset)).weekday() in free_days
    ]
    first_active_offset = active_offsets[0]
    spacing_days = {}
    for day_number, requested_offset in ((1, 0), (3, 2), (7, 6)):
        due_offset = first_active_offset + requested_offset
        scheduled_offset = next(
            (offset for offset in active_offsets if offset >= due_offset),
            None
        )
        if scheduled_offset is not None:
            spacing_days[scheduled_offset] = f"Hari {day_number}"

    weighted_focus = [0, 0, 1, 0, 2]
    for offset in range(7):
        current_date = start_date + timedelta(days=offset)
        is_free = current_date.weekday() in free_days
        tasks = []

        if is_free:
            for task_index, (task_type, duration) in enumerate(task_slots):
                spacing = spacing_days.get(offset)
                focus_index = (
                    task_index
                    if spacing
                    else weighted_focus[(offset * len(task_slots) + task_index) % len(weighted_focus)]
                )
                skill = focus[focus_index % len(focus)]
                topic_name = skill["topic"]
                skill_name = skill["skill"].replace("_", " ").title()
                if mode == "starter":
                    title = (
                        "Misi diagnostik " + topic_name
                        if task_type == "quiz"
                        else "Kenali gaya belajar kamu"
                    )
                    why = "Ejen perlukan satu kuiz pertama untuk kenal pasti fokus."
                elif mode == "maintenance":
                    title = f"Kekalkan ingatan: {topic_name}"
                    why = "Prestasi terkini stabil; latihan campuran bantu kekalkan ingatan."
                elif spacing:
                    title = f"{spacing}: {skill_name}"
                    why = (
                        f"Ulang kemahiran ini pada sela {spacing.lower()} "
                        "untuk kuatkan ingatan jangka panjang."
                    )
                else:
                    title = f"{topic_name}: {skill_name}"
                    why = (
                        f"Rekod kuiz menunjukkan {skill['errors']} jawapan "
                        "salah untuk kemahiran ini."
                    )

                if task_type == "adaptive":
                    action = "adaptive"
                    href = (
                        f"/learning?attempt_id={skill['attempt_id']}&tab=adaptive"
                        if skill["attempt_id"] else "/quiz"
                    )
                    label = f"Latihan adaptif {topic_name}"
                elif task_type == "notes":
                    action = "notes"
                    href = (
                        f"/learning?attempt_id={skill['attempt_id']}&tab=notes"
                        if skill["attempt_id"] else "/learning"
                    )
                    label = f"Baca nota {topic_name}"
                else:
                    action = "quiz"
                    href = "/quiz"
                    label = f"Kuiz ringkas {topic_name}"

                tasks.append({
                    "task_id": f"d{offset}-t{task_index}",
                    "type": action,
                    "title": title,
                    "label": label,
                    "minutes": duration,
                    "href": href,
                    "why": why,
                    "skill": skill_name,
                    "topic": topic_name
                })

        days.append({
            "day_number": offset + 1,
            "weekday": DAYS[current_date.weekday()],
            "date": current_date.isoformat(),
            "is_free": is_free,
            "tasks": tasks
        })

    total_sessions = sum(1 for day in days if day["is_free"])
    priority_skill = focus[0]
    if mode == "starter":
        insight = (
            "Mulakan dengan satu kuiz diagnostik. Selepas itu, AquaPlan akan "
            "gunakan jawapan sebenar untuk bina pelan yang lebih peribadi."
        )
    elif mode == "maintenance":
        insight = (
            f"Prestasi kamu semakin kukuh! Minggu ini ejen kekalkan "
            f"{priority_skill['topic']} dengan latihan campuran."
        )
    else:
        insight = (
            f"Minggu ini kita fokus {priority_skill['topic']} — "
            f"{priority_skill['skill'].replace('_', ' ').title()} paling "
            "perlukan latihan berdasarkan jawapan kuiz kamu."
        )

    exam_countdown = None
    if exam_date:
        parsed_exam_date = date.fromisoformat(exam_date)
        exam_countdown = (parsed_exam_date - start_date).days
        if exam_countdown <= 7:
            insight += (
                f" Peperiksaan dalam {exam_countdown} hari, jadi sesi pendek "
                "ini mengutamakan ingatan aktif."
            )

    plan = {
        "insight": insight,
        "mode": mode,
        "focus": focus,
        "minutes_per_day": minutes,
        "free_days": sorted(free_days),
        "exam_date": exam_date,
        "exam_countdown": exam_countdown,
        "session_count": total_sessions,
        "source_attempt_id": (
            int(attempts[0]["attempt_id"]) if attempts else 0
        ),
        "days": days
    }
    plan["bonus_task_count"] = len(_plan_task_ids(plan))
    return plan


def get_latest_plan(student_id):
    connection = _get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        ensure_plan_tables(cursor)
        cursor.execute("""
            SELECT ap.plan_id, ap.plan_json, ap.created_at
            FROM aqua_plans ap
            WHERE ap.student_id = %s
            ORDER BY ap.plan_id DESC
            LIMIT 1
        """, (student_id,))
        row = cursor.fetchone()
        if not row:
            return None

        plan = _json_value(row["plan_json"])
        cursor.execute("""
            SELECT task_id FROM aqua_plan_completions
            WHERE plan_id = %s AND student_id = %s
        """, (row["plan_id"], student_id))
        all_task_ids = {
            task["task_id"]
            for day in plan["days"]
            for task in day["tasks"]
        }
        completed = {
            item["task_id"] for item in cursor.fetchall()
            if item["task_id"] in all_task_ids
        }
        cursor.execute("""
            SELECT reward_key, pearls_earned, reward_label
            FROM aqua_plan_rewards
            WHERE plan_id = %s AND student_id = %s
        """, (row["plan_id"], student_id))
        rewards = cursor.fetchall()

        plan["plan_id"] = row["plan_id"]
        plan["created_at"] = (
            row["created_at"].isoformat()
            if isinstance(row["created_at"], datetime)
            else str(row["created_at"])
        )
        plan["completed_task_ids"] = sorted(completed)
        plan["completed_count"] = len(completed)
        plan["task_count"] = sum(len(day["tasks"]) for day in plan["days"])
        plan["rewards"] = rewards
        plan["week_complete"] = _is_week_complete(completed, plan)
        return plan
    finally:
        cursor.close()
        connection.close()


def create_plan(student_id, preferences):
    connection = _get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        ensure_plan_tables(cursor)
        connection.start_transaction()
        cursor.execute("""
            SELECT student_id FROM students
            WHERE student_id = %s FOR UPDATE
        """, (student_id,))
        if not cursor.fetchone():
            raise ValueError("Akaun pelajar tidak ditemui.")

        cursor.execute("""
            SELECT plan_id, plan_json, source_attempt_id,
                   CASE
                       WHEN created_at >= DATE_SUB(
                           CURRENT_TIMESTAMP, INTERVAL 7 DAY
                       )
                       THEN TRUE ELSE FALSE
                   END AS is_active
            FROM aqua_plans
            WHERE student_id = %s
            ORDER BY plan_id DESC
            LIMIT 1
            FOR UPDATE
        """, (student_id,))
        existing_plan = cursor.fetchone()

        cursor.execute("""
            SELECT attempt_id, year_level, subject, topic, score,
                   performance_json, created_at
            FROM quiz_attempts
            WHERE student_id = %s AND quiz_type = 'default'
            ORDER BY created_at DESC, attempt_id DESC
            LIMIT 50
        """, (student_id,))
        attempts = cursor.fetchall()
        plan = build_weekly_plan(preferences, attempts)
        if existing_plan and existing_plan["is_active"]:
            old_plan = _json_value(existing_plan["plan_json"])
            plan["bonus_task_count"] = int(old_plan.get(
                "bonus_task_count",
                len(_plan_task_ids(old_plan))
            ))
            cursor.execute("""
                SELECT task_id FROM aqua_plan_completions
                WHERE plan_id = %s AND student_id = %s
            """, (existing_plan["plan_id"], student_id))
            completed_ids = {
                row["task_id"] for row in cursor.fetchall()
            }
            completed_tasks = {
                task["task_id"]: task
                for day in old_plan["days"]
                for task in day["tasks"]
                if task["task_id"] in completed_ids
            }
            old_days_by_date = {
                item["date"]: item for item in old_plan["days"]
                if not item.get("is_catch_up")
            }
            for day in plan["days"]:
                day["tasks"] = [
                    completed_tasks.get(task["task_id"], task)
                    for task in day["tasks"]
                ]
                old_day = old_days_by_date.get(day["date"])
                if old_day:
                    day["events"] = old_day.get("events", [])
                    if old_day.get("is_busy"):
                        _set_day_busy(plan, day, True, completed_ids)

            cursor.execute("""
                UPDATE aqua_plans
                SET preferences_json = %s, plan_json = %s,
                    source_attempt_id = %s
                WHERE plan_id = %s AND student_id = %s
            """, (
                json.dumps(preferences, ensure_ascii=False),
                json.dumps(plan, ensure_ascii=False),
                plan["source_attempt_id"],
                existing_plan["plan_id"],
                student_id
            ))
        else:
            cursor.execute("""
                INSERT INTO aqua_plans
                    (student_id, preferences_json, plan_json, source_attempt_id)
                VALUES (%s, %s, %s, %s)
            """, (
                student_id,
                json.dumps(preferences, ensure_ascii=False),
                json.dumps(plan, ensure_ascii=False),
                plan["source_attempt_id"]
            ))
        connection.commit()
        return get_latest_plan(student_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def complete_task(student_id, plan_id, task_id):
    connection = _get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        ensure_plan_tables(cursor)
        connection.start_transaction()
        cursor.execute("""
            SELECT student_id FROM students
            WHERE student_id = %s FOR UPDATE
        """, (student_id,))
        if not cursor.fetchone():
            return None

        cursor.execute("""
            SELECT plan_json FROM aqua_plans
            WHERE plan_id = %s AND student_id = %s
            FOR UPDATE
        """, (plan_id, student_id))
        row = cursor.fetchone()
        if not row:
            return None
        plan = _json_value(row["plan_json"])
        all_tasks = [
            task for day in plan["days"] for task in day["tasks"]
        ]
        if not any(task["task_id"] == task_id for task in all_tasks):
            raise ValueError("Tugasan ini tiada dalam pelan AquaPlan.")

        cursor.execute("""
            SELECT task_id FROM aqua_plan_completions
            WHERE plan_id = %s AND task_id = %s
        """, (plan_id, task_id))
        if cursor.fetchone():
            connection.commit()
            return {"already_completed": True, "pearls_earned": 0}

        cursor.execute("""
            INSERT INTO aqua_plan_completions (plan_id, student_id, task_id)
            VALUES (%s, %s, %s)
        """, (plan_id, student_id, task_id))
        cursor.execute("""
            INSERT INTO aqua_plan_rewards
                (plan_id, student_id, reward_key, pearls_earned, reward_label)
            VALUES (%s, %s, %s, 5, 'Mutiara tugasan')
        """, (plan_id, student_id, f"task:{task_id}"))

        cursor.execute("""
            SELECT task_id FROM aqua_plan_completions
            WHERE plan_id = %s AND student_id = %s
        """, (plan_id, student_id))
        completed_ids = {row["task_id"] for row in cursor.fetchall()}
        current_task_ids = {task["task_id"] for task in all_tasks}
        active_completed_ids = completed_ids & current_task_ids
        completed_count = len(active_completed_ids)
        bonus = None
        if _is_week_complete(completed_ids, plan):
            cursor.execute("""
                SELECT reward_id FROM aqua_plan_rewards
                WHERE plan_id = %s AND reward_key = 'weekly-bonus'
            """, (plan_id,))
            if not cursor.fetchone():
                cursor.execute("""
                    SELECT item_id, item_name
                    FROM shop_items
                    WHERE is_active = TRUE
                    ORDER BY price ASC, item_id ASC
                    LIMIT 1
                """)
                item = cursor.fetchone()
                inventory_id = None
                reward_label = "Lencana Penjelajah Konsisten"
                if item:
                    cursor.execute("""
                        INSERT INTO student_inventory
                            (student_id, item_id, is_placed, is_unboxed)
                        VALUES (%s, %s, FALSE, FALSE)
                    """, (student_id, item["item_id"]))
                    inventory_id = cursor.lastrowid
                    reward_label = item["item_name"]
                cursor.execute("""
                    INSERT INTO aqua_plan_rewards
                        (plan_id, student_id, reward_key, pearls_earned,
                         reward_label, inventory_id)
                    VALUES (%s, %s, 'weekly-bonus', 25, %s, %s)
                """, (plan_id, student_id, reward_label, inventory_id))
                bonus = {
                    "pearls_earned": 25,
                    "reward_label": reward_label,
                    "inventory_id": inventory_id
                }

        connection.commit()
        return {
            "already_completed": False,
            "pearls_earned": 5,
            "bonus": bonus,
            "completed_count": completed_count,
            "task_count": len(all_tasks)
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def update_schedule(student_id, plan_id, day_date, action, data):
    connection = _get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        ensure_plan_tables(cursor)
        connection.start_transaction()
        cursor.execute("""
            SELECT student_id FROM students
            WHERE student_id = %s FOR UPDATE
        """, (student_id,))
        if not cursor.fetchone():
            return None

        cursor.execute("""
            SELECT plan_json FROM aqua_plans
            WHERE plan_id = %s AND student_id = %s
            FOR UPDATE
        """, (plan_id, student_id))
        row = cursor.fetchone()
        if not row:
            return None

        plan = _json_value(row["plan_json"])
        day = next(
            (item for item in plan["days"] if item["date"] == day_date),
            None
        )
        if not day:
            raise ValueError("Hari ini tiada dalam jadual AquaPlan.")
        if day.get("is_catch_up"):
            raise ValueError("Hari ganti diuruskan secara automatik.")

        cursor.execute("""
            SELECT task_id FROM aqua_plan_completions
            WHERE plan_id = %s AND student_id = %s
        """, (plan_id, student_id))
        completed_ids = {item["task_id"] for item in cursor.fetchall()}

        if action == "add_event":
            raw_title = data.get("title", "")
            if not isinstance(raw_title, str):
                raise ValueError("Nama acara mestilah teks.")
            title = raw_title.strip()
            event_time = data.get("time", "")
            if not title or len(title) > 80:
                raise ValueError("Nama acara mestilah antara 1 hingga 80 aksara.")
            if event_time:
                if not isinstance(event_time, str):
                    raise ValueError("Masa acara tidak sah.")
                try:
                    datetime.strptime(event_time, "%H:%M")
                except ValueError as error:
                    raise ValueError("Masa acara tidak sah.") from error
            day.setdefault("events", []).append({
                "event_id": uuid4().hex,
                "title": title,
                "time": event_time
            })
        elif action == "remove_event":
            event_id = data.get("event_id")
            events = day.setdefault("events", [])
            original_count = len(events)
            day["events"] = [
                event for event in events
                if event.get("event_id") != event_id
            ]
            if len(day["events"]) == original_count:
                raise ValueError("Acara ini tidak ditemui dalam jadual.")
        elif action == "set_busy":
            is_busy = data.get("is_busy")
            if type(is_busy) is not bool:
                raise ValueError("Status sibuk tidak sah.")
            _set_day_busy(plan, day, is_busy, completed_ids)
        else:
            raise ValueError("Tindakan jadual tidak dikenali.")

        plan["task_count"] = sum(
            len(item["tasks"]) for item in plan["days"]
        )
        plan["completed_task_ids"] = sorted(completed_ids)
        plan["completed_count"] = len(completed_ids & _plan_task_ids(plan))
        plan["week_complete"] = _is_week_complete(completed_ids, plan)
        cursor.execute("""
            UPDATE aqua_plans
            SET plan_json = %s
            WHERE plan_id = %s AND student_id = %s
        """, (
            json.dumps(plan, ensure_ascii=False),
            plan_id,
            student_id
        ))
        connection.commit()
        return get_latest_plan(student_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()
