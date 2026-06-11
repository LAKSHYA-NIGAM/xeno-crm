import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

def get_gemini_model(temperature: float = 0.7) -> genai.GenerativeModel:
    return genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        generation_config=genai.GenerationConfig(
            max_output_tokens=1024,
            temperature=temperature,
        ),
    )
