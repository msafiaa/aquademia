import json
import unittest
from datetime import date

from services.aqua_plan_service import (
    _is_week_complete,
    _set_day_busy,
    build_weekly_plan
)


class AquaPlanServiceTests(unittest.TestCase):
    def setUp(self):
        self.attempts = [{
            "attempt_id": 12,
            "year_level": 5,
            "subject": "Mathematics",
            "topic": "Pecahan",
            "score": 50,
            "performance_json": json.dumps({
                "question_results": [
                    {"skill": "tambah pecahan", "is_correct": False},
                    {"skill": "tambah pecahan", "is_correct": False},
                    {"skill": "banding pecahan", "is_correct": True}
                ]
            })
        }]

    def make_preferences(self, minutes=20, free_days=None, exam_date=None):
        return {
            "free_days": free_days if free_days is not None else [0, 2, 6],
            "minutes_per_day": minutes,
            "exam_date": exam_date
        }

    def test_week_has_seven_days_and_only_schedules_selected_weekdays(self):
        plan = build_weekly_plan(
            self.make_preferences(), self.attempts, date(2026, 11, 9)
        )
        self.assertEqual(len(plan["days"]), 7)
        active_days = [day for day in plan["days"] if day["is_free"]]
        self.assertEqual(
            [day["weekday"] for day in active_days],
            ["Isnin", "Rabu", "Ahad"]
        )
        self.assertTrue(all(2 <= len(day["tasks"]) <= 4 for day in active_days))
        self.assertTrue(all(not day["tasks"] for day in plan["days"] if not day["is_free"]))

    def test_daily_minutes_never_exceed_selected_limit(self):
        for minutes in (10, 20, 30):
            with self.subTest(minutes=minutes):
                plan = build_weekly_plan(
                    self.make_preferences(minutes=minutes),
                    self.attempts,
                    date(2026, 11, 9)
                )
                for day in plan["days"]:
                    self.assertLessEqual(
                        sum(task["minutes"] for task in day["tasks"]),
                        minutes
                    )

    def test_top_weak_skill_is_first_and_spaced_on_days_one_three_seven(self):
        plan = build_weekly_plan(
            self.make_preferences(minutes=10), self.attempts, date(2026, 11, 9)
        )
        first_tasks = [plan["days"][index]["tasks"][0] for index in (0, 2, 6)]
        self.assertEqual([task["title"] for task in first_tasks], [
            "Hari 1: Tambah Pecahan",
            "Hari 3: Tambah Pecahan",
            "Hari 7: Tambah Pecahan"
        ])
        self.assertEqual(plan["focus"][0]["skill"], "tambah pecahan")

    def test_spacing_starts_on_first_free_day_not_before_it(self):
        plan = build_weekly_plan(
            self.make_preferences(minutes=10, free_days=[1, 3]),
            self.attempts,
            date(2026, 11, 9)
        )
        active_days = [day for day in plan["days"] if day["is_free"]]
        self.assertEqual(active_days[0]["tasks"][0]["title"], "Hari 1: Tambah Pecahan")
        self.assertEqual(active_days[1]["tasks"][0]["title"], "Hari 3: Tambah Pecahan")
        self.assertFalse(any(
            task["title"].startswith("Hari 7:")
            for day in plan["days"]
            for task in day["tasks"]
        ))

    def test_exam_countdown_is_included_in_plan_insight(self):
        plan = build_weekly_plan(
            self.make_preferences(exam_date="2026-11-13"),
            self.attempts,
            date(2026, 11, 9)
        )
        self.assertEqual(plan["exam_countdown"], 4)
        self.assertIn("4 hari", plan["insight"])

    def test_newest_errors_can_move_another_skill_to_the_top_priority(self):
        latest_attempt = {
            "attempt_id": 13,
            "year_level": 5,
            "subject": "Mathematics",
            "topic": "Bahagi",
            "score": 0,
            "performance_json": {
                "question_results": [
                    {"skill": "bahagi", "is_correct": False},
                    {"skill": "bahagi", "is_correct": False},
                    {"skill": "bahagi", "is_correct": False}
                ]
            }
        }
        plan = build_weekly_plan(
            self.make_preferences(),
            [latest_attempt] + self.attempts,
            date(2026, 11, 9)
        )
        self.assertEqual(plan["focus"][0]["skill"], "bahagi")
        self.assertEqual(plan["source_attempt_id"], 13)

    def test_first_plan_guides_student_to_take_diagnostic_quiz(self):
        plan = build_weekly_plan(
            self.make_preferences(), [], date(2026, 11, 9)
        )
        self.assertEqual(plan["mode"], "starter")
        self.assertIn("diagnostik", plan["insight"])
        self.assertTrue(all(
            task["href"] == "/quiz"
            for day in plan["days"]
            for task in day["tasks"]
            if task["type"] == "adaptive"
        ))

    def test_schedule_edit_cannot_reduce_weekly_bonus_requirement(self):
        edited_plan = {
            "bonus_task_count": 6,
            "days": [{
                "tasks": [
                    {"task_id": "d0-t0"},
                    {"task_id": "d0-t1"}
                ]
            }]
        }
        self.assertFalse(_is_week_complete({"d0-t0", "d0-t1"}, edited_plan))

    def test_weekly_bonus_requires_every_task_in_the_current_schedule(self):
        edited_plan = {
            "bonus_task_count": 2,
            "days": [{
                "tasks": [
                    {"task_id": "d0-t0"},
                    {"task_id": "d0-t1"},
                    {"task_id": "d0-t2"}
                ]
            }]
        }
        self.assertFalse(_is_week_complete({"d0-t0", "d0-t1"}, edited_plan))
        self.assertTrue(_is_week_complete(
            {"d0-t0", "d0-t1", "d0-t2"}, edited_plan
        ))

    def test_busy_day_moves_only_unfinished_missions_to_catch_up_day(self):
        plan = build_weekly_plan(
            self.make_preferences(minutes=20),
            self.attempts,
            date(2026, 11, 9)
        )
        monday = plan["days"][0]
        original_task_ids = {task["task_id"] for task in monday["tasks"]}
        completed_id = monday["tasks"][0]["task_id"]

        _set_day_busy(plan, monday, True, {completed_id})

        catch_up = next(day for day in plan["days"] if day.get("is_catch_up"))
        self.assertEqual(
            {task["task_id"] for task in monday["tasks"]},
            {completed_id}
        )
        self.assertEqual(
            {task["task_id"] for task in catch_up["tasks"]},
            original_task_ids - {completed_id}
        )
        self.assertEqual(sum(task["minutes"] for task in catch_up["tasks"]), 15)

    def test_unmarking_busy_day_returns_unfinished_tasks(self):
        plan = build_weekly_plan(
            self.make_preferences(minutes=20),
            self.attempts,
            date(2026, 11, 9)
        )
        monday = plan["days"][0]
        original_task_ids = {task["task_id"] for task in monday["tasks"]}

        _set_day_busy(plan, monday, True, set())
        _set_day_busy(plan, monday, False, set())

        self.assertEqual(
            {task["task_id"] for task in monday["tasks"]},
            original_task_ids
        )
        self.assertFalse(any(day.get("is_catch_up") for day in plan["days"]))


if __name__ == "__main__":
    unittest.main()
