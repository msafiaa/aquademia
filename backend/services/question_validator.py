
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


def validate_adaptive_questions(questions, subject):
    if not isinstance(questions, list) or len(questions) != 3:
        raise ValueError("AI must generate exactly 3 questions.")

    for question in questions:
        if not isinstance(question, dict):
            raise ValueError("Invalid question structure.")

        question_text = question.get("question")
        options = question.get("options")
        answer = question.get("answer")
        skill = question.get("skill")

        if not isinstance(question_text, str) or not question_text.strip():
            raise ValueError("Question text is missing.")

        if not isinstance(skill, str) or not skill.strip():
            raise ValueError("Question skill is missing.")

        if (
            not isinstance(options, list)
            or len(options) != 4
            or not all(isinstance(o, str) for o in options)
            or len(set(options)) != 4
        ):
            raise ValueError("Each question must have 4 unique options.")

        if not isinstance(answer, str) or answer not in options:
            raise ValueError("Answer must match one of the options.")

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
            raise ValueError(
                "Science questions require verified answer keys."
            )

        else:
            raise ValueError("Unsupported subject.")

    return True
