from typing import Dict, Any, Tuple, List

EMERGENCY_SIGNS = [
    "chest pain", "shortness of breath", "trouble breathing", "faint", "loss of consciousness",
    "stroke", "face drooping", "one side weakness", "severe bleeding",
    "severe allergic", "swelling of lips", "swelling of tongue"
]

def emergency_check(text: str) -> bool:
    t = text.lower()
    return any(s in t for s in EMERGENCY_SIGNS)

def medical_answer(message: str) -> Tuple[str, Dict[str, Any], float, List[str]]:
    """
    Returns: (answer, entities, confidence, suggestions)
    """
    msg = message.strip().lower()
    entities: Dict[str, Any] = {}

    if emergency_check(msg):
        return (
            "Some symptoms you mentioned can be urgent. Please seek immediate medical help or call local emergency services now. "
            "If you can, have someone stay with you and avoid driving yourself.",
            {"risk": "emergency_possible"},
            0.90,
            ["Call emergency services", "Contact your doctor now"]
        )

    # Common questions: fever
    if "fever" in msg:
        answer = (
            "For adults, a fever is usually considered ≥ 38°C. Most fevers from viral infections improve with rest and fluids.\n\n"
            "What you can do now:\n"
            "- Drink water/fluids and rest.\n"
            "- Consider paracetamol/acetaminophen if you can take it safely (follow label dosing).\n"
            "- Avoid combining multiple cold/flu meds that contain the same pain reliever.\n\n"
            "See a clinician urgently if:\n"
            "- Fever ≥ 39.4°C, lasts > 3 days, or you have severe headache/stiff neck, confusion, dehydration, rash, or breathing trouble.\n"
        )
        return (answer, entities, 0.74, ["What is your age?", "How high is the temperature?", "Any other symptoms?"])

    # Cough
    if "cough" in msg:
        answer = (
            "A cough is often caused by viral infections, allergies, or irritation. Most acute coughs improve within 1–3 weeks.\n\n"
            "Try:\n"
            "- Warm fluids, honey (not for children under 1 year), and rest.\n"
            "- If you have asthma, use your inhaler as prescribed.\n\n"
            "Get medical advice if:\n"
            "- Cough lasts > 3 weeks, you cough blood, have high fever, chest pain, wheezing, or shortness of breath.\n"
        )
        return (answer, entities, 0.72, ["How long have you been coughing?", "Do you have fever or shortness of breath?"])

    # Medication side effects (generic)
    if "side effect" in msg or "is it safe" in msg or "dose" in msg:
        answer = (
            "I can give general medication safety information, but I need the exact medicine name, dose, and your age/conditions.\n"
            "Please share:\n"
            "- Medicine name\n"
            "- Dose (e.g., 500 mg)\n"
            "- How often you take it\n"
            "- Any conditions (e.g., kidney disease, pregnancy)\n"
        )
        return (answer, entities, 0.70, ["Tell me the medicine name and dose"])

    # Default general medical guidance
    answer = (
        "I can help with general medical information (symptoms, treatments, medication safety), but I’m not a substitute for a clinician.\n\n"
        "To answer accurately, tell me:\n"
        "- Age and sex\n"
        "- Main symptom/question\n"
        "- How long it’s been happening\n"
        "- Any fever, severe pain, breathing issues, or chronic conditions\n"
    )
    return (answer, entities, 0.60, ["What’s your main symptom?", "How long has it been happening?", "Any chronic conditions?"])
