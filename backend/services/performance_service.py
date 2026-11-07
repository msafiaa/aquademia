
def analyze_performance(questions, answers):
    total = len(questions)
    correct = 0
    question_results = []
    weak_skills = {}

    for question in questions:
        question_id = str(question["id"])
        student_answer = answers.get(question_id)
        correct_answer = question["answer"]
        is_correct = student_answer == correct_answer

        if is_correct:
            correct += 1
        else:
            skill = question.get("skill", "general")
            weak_skills[skill] = weak_skills.get(skill, 0) + 1

        question_results.append({
            "question_id": question["id"],
            "question": question["question"],
            "student_answer": student_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "skill": question.get("skill", "general")
        })

    score = round((correct / total) * 100, 2) if total else 0

    return {
        "quiz_type": "default",
        "score": score,
        "correct": correct,
        "total": total,
        "weak_skills": weak_skills,
        "question_results": question_results
    }
