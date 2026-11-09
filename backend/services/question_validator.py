
import re

def verify_math_answer(question_text, answer):
    """
    Verify supported arithmetic questions independently.
    Returns True if correct, False if incorrect,
    or None if the question format is unsupported.
    """

    pattern = r"^\s*What is\s+(\d+)\s*([+\-×*])\s*(\d+)\s*\?\s*$"

    match = re.fullmatch(
        pattern,
        question_text,
        flags=re.IGNORECASE
    )

    if not match:
        return None

    num1 = int(match.group(1))
    operator = match.group(2)
    num2 = int(match.group(3))

    if operator == "+":
        expected = num1 + num2
    elif operator == "-":
        expected = num1 - num2
    else:
        expected = num1 * num2

    try:
        return int(answer.strip()) == expected
    except (ValueError, AttributeError):
        return False


def validate_adaptive_questions(
    questions,
    subject,
    target_skills=None,
    source_questions=None,
    exclude_questions=None
):
    if not isinstance(questions, list) or not questions:
        raise ValueError("AI must generate at least one question.")

    target_skills = set(target_skills or [])
    excluded = {
        question.strip().casefold()
        for question in (exclude_questions or [])
        if isinstance(question, str)
    }
    sources_by_id = {
        source["id"]: source
        for source in (source_questions or [])
    }
    seen_questions = set()

    for question in questions:
        if not isinstance(question, dict):
            raise ValueError("Invalid question structure.")

        question_text = question.get("question")
        options = question.get("options")
        answer = question.get("answer")
        skill = question.get("skill")

        if not isinstance(question_text, str) or not question_text.strip():
            raise ValueError("Question text is missing.")
        normalized_question = question_text.strip().casefold()
        if normalized_question in seen_questions:
            raise ValueError("AI questions must be different from each other.")
        if normalized_question in excluded:
            raise ValueError("AI repeated a question from an earlier set.")
        seen_questions.add(normalized_question)

        if not isinstance(skill, str) or not skill.strip():
            raise ValueError("Question skill is missing.")

        if target_skills and skill not in target_skills:
            raise ValueError("AI generated a question outside the weak skills.")

        if (
            not isinstance(options, list)
            or len(options) != 4
            or not all(isinstance(o, str) for o in options)
            or len(set(options)) != 4
        ):
            raise ValueError("Each question must have 4 unique options.")

        if not isinstance(answer, str) or answer not in options:
            raise ValueError("Answer must match one of the options.")

        source = sources_by_id.get(question.get("source_question_id"))
        if subject == "Science" and not source:
            raise ValueError("Question must reference a verified topic question.")
        if question.get("source_question_id") and not source:
            raise ValueError("Unknown verified topic reference.")
        if source and question_text.strip() == source["question"].strip():
            raise ValueError(
                "Adaptive questions must be newly generated, not copied."
            )

        if subject == "Mathematics":
            verified = verify_math_answer(question_text, answer)

            if verified is False:
                raise ValueError(
                    f"Incorrect AI answer detected: {question_text}"
                )

            if verified is None:
                raise ValueError(
                    f"Unsupported mathematics format: {question_text}"
                )

        elif subject == "Science":
            if not source or answer != source["correct_answer"]:
                raise ValueError(
                    "Science answers must match a verified topic reference."
                )

        else:
            raise ValueError("Unsupported subject.")

    return True
