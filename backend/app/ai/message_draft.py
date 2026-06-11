import json
import asyncio
from typing import AsyncGenerator
# pyrefly: ignore [missing-import]
from app.ai.client import get_gemini_model

MESSAGE_SYSTEM_PROMPT = """You are a senior campaign copywriter for Elara, a premium D2C beauty and wellness brand in India.
You craft messages that feel personal, thoughtful, and premium — never pushy or generic.
Write ONLY the message text. No labels, no subject line prefixes, no markdown, no commentary.

Use {first_name} as the single personalization variable — nothing else.

Channel-specific constraints:
- whatsapp: 150–200 characters, warm and conversational tone, 1–2 tasteful emojis, end with a soft CTA
- email: first line must be "Subject: <compelling subject>", followed by a blank line, then 3–4 warm sentences, close with a clear CTA
- sms: strictly under 120 characters, direct CTA, no emoji, no filler words"""

async def stream_message_draft(
    audience_name: str,
    channel: str,
    objective: str,
    brand_tone: str,
    sample_customers: list,
    db,
    save_suggestion_fn,
) -> AsyncGenerator[str, None]:

    model = get_gemini_model(temperature=0.8)

    samples_text = (
        ", ".join([f"{c['first_name']} from {c['city']}" for c in sample_customers])
        if sample_customers
        else "customers across Mumbai, Bangalore, and Delhi"
    )

    prompt = f"""{MESSAGE_SYSTEM_PROMPT}

Audience segment: {audience_name}
Channel: {channel}
Campaign objective: {objective}
Brand tone: {brand_tone}
Sample recipients: {samples_text}

Write the message now."""

    async def generate():
        full_text = ""
        try:
            response = await model.generate_content_async(prompt, stream=True)
            async for chunk in response:
                if chunk.text:
                    full_text += chunk.text
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"

            await save_suggestion_fn(db, "message_draft", audience_name, {"message": full_text.strip()})
            yield f"data: {json.dumps({'done': True, 'full_message': full_text.strip()})}\n\n"

        except Exception as e:
            # Fallback to local template-based message copy draft
            print(f"Gemini message draft failed: {e}. Running fallback generator...")
            
            fallback_message = ""
            if channel == "whatsapp":
                fallback_message = f"Hello {{first_name}}! 🌿 We noticed you haven't ordered from Elara recently. Use coupon ELARA15 for 15% off our organic beauty and wellness range today! https://elarabrands.in"
            elif channel == "email":
                fallback_message = f"Subject: We miss you! Here is an exclusive offer from Elara\n\nHello {{first_name}},\n\nWe haven't seen you in a while and wanted to check in. To help you get back on your wellness journey, we've prepared a special 15% discount on your next purchase.\n\nSimply enter code ELARA15 at checkout to enjoy this offer. Our newest collection of organic skincare and premium wellness products awaits you!\n\nWarmly,\nThe Elara Team"
            else: # sms
                fallback_message = f"Hi {{first_name}}, we miss you! Get 15% off premium beauty & wellness products at Elara. Use code ELARA15. shop: elarabrands.in"
                
            # Stream the fallback message to simulate typing
            for i in range(0, len(fallback_message), 4):
                chunk_text = fallback_message[i:i+4]
                yield f"data: {json.dumps({'text': chunk_text})}\n\n"
                await asyncio.sleep(0.01)
                
            await save_suggestion_fn(db, "message_draft", audience_name, {"message": fallback_message})
            yield f"data: {json.dumps({'done': True, 'full_message': fallback_message})}\n\n"

    return generate()
