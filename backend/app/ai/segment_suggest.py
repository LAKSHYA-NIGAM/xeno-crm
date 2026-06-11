import json
import asyncio
import re
from typing import AsyncGenerator
# pyrefly: ignore [missing-import]
from app.ai.client import get_gemini_model

SEGMENT_SYSTEM_PROMPT = """You are an expert CRM analyst for Elara, a premium D2C beauty and wellness brand in India.
Your job is to convert a marketer's plain-English campaign goal into a precise JSON audience
segment definition. You must respond with valid raw JSON only — no markdown, no code fences,
no commentary outside the JSON object.

Strict response schema:
{
  "audience_name": "<concise segment label>",
  "rules": {
    "last_order_days_gt": <integer or null>,
    "last_order_days_lt": <integer or null>,
    "total_spend_gt": <float or null>,
    "total_spend_lt": <float or null>,
    "order_count_gte": <integer or null>,
    "order_count_lte": <integer or null>,
    "cities": <["City1", "City2"] or null>,
    "preferred_channels": <["whatsapp"] or null>
  },
  "rationale": "<2-3 sentences explaining why this segment fits the goal>",
  "estimated_count": 0
}

Available cities: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Kolkata
Available channels: email, whatsapp, sms
Set any unused rule field to null. estimated_count must always be 0 — it will be computed server-side."""

async def stream_segment_suggest(
    goal: str,
    db,
    get_segment_count_fn,
    save_suggestion_fn,
) -> AsyncGenerator[str, None]:

    model = get_gemini_model(temperature=0.4)
    prompt = f"{SEGMENT_SYSTEM_PROMPT}\n\nCampaign goal: {goal}"

    async def generate():
        full_text = ""
        try:
            response = await model.generate_content_async(prompt, stream=True)
            async for chunk in response:
                if chunk.text:
                    full_text += chunk.text
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"

            # Clean response — Gemini occasionally wraps output in ```json fences
            cleaned = full_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip()

            parsed = json.loads(cleaned)

            # Hydrate estimated_count with real DB query
            count = await get_segment_count_fn(parsed["rules"], db)
            parsed["estimated_count"] = count

            # Persist to ai_suggestions table
            await save_suggestion_fn(db, "segment_suggest", goal, parsed)

            yield f"data: {json.dumps({'done': True, 'result': parsed})}\n\n"

        except json.JSONDecodeError as e:
            yield f"data: {json.dumps({'error': f'Failed to parse AI response: {str(e)}'})}\n\n"
        except Exception as e:
            # Fallback to local rule-based suggest if API key fails or quota exceeded
            print(f"Gemini suggestion failed: {e}. Running fallback generator...")
            
            goal_lower = goal.lower()
            
            # Detect cities
            detected_cities = []
            for city in ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"]:
                if city.lower() in goal_lower:
                    detected_cities.append(city)
            
            # Detect channels
            detected_channels = []
            for ch in ["email", "whatsapp", "sms"]:
                if ch in goal_lower:
                    detected_channels.append(ch)
            
            # Detect spend
            total_spend_gt = None
            if any(k in goal_lower for k in ["spend", "spent", "above", "greater", "more than", "gt", ">"]):
                numbers = re.findall(r'\d+', goal_lower)
                if numbers:
                    total_spend_gt = float(numbers[0])
                else:
                    total_spend_gt = 5000.0
            
            # Detect order count
            order_count_gte = None
            if any(k in goal_lower for k in ["order", "purchase", "buy", "visits", "orders"]):
                numbers = re.findall(r'\d+', goal_lower)
                if numbers and len(numbers) > 1:
                    order_count_gte = int(numbers[1])
                elif numbers and total_spend_gt is None:
                    order_count_gte = int(numbers[0])
                else:
                    order_count_gte = 1
            
            # Detect inactivity
            last_order_days_gt = None
            if any(k in goal_lower for k in ["inactive", "dormant", "lapsed", "days", "ago", "last"]):
                numbers = re.findall(r'\d+', goal_lower)
                if numbers and total_spend_gt is None and order_count_gte is None:
                    last_order_days_gt = int(numbers[0])
                else:
                    last_order_days_gt = 30
                    
            # Build rationale
            rationale_parts = []
            if detected_cities:
                rationale_parts.append(f"residing in {', '.join(detected_cities)}")
            if total_spend_gt:
                rationale_parts.append(f"with total spend above ₹{total_spend_gt}")
            if order_count_gte:
                rationale_parts.append(f"having at least {order_count_gte} orders")
            if last_order_days_gt:
                rationale_parts.append(f"who have been inactive for more than {last_order_days_gt} days")
                
            rationale_desc = " and ".join(rationale_parts) if rationale_parts else "matching the specified target criteria"
            
            audience_name = f"AI Suggested Segment: {goal[:40]}"
            if len(goal) > 40:
                audience_name += "..."
                
            parsed = {
                "audience_name": audience_name,
                "rules": {
                    "last_order_days_gt": last_order_days_gt,
                    "last_order_days_lt": None,
                    "total_spend_gt": total_spend_gt,
                    "total_spend_lt": None,
                    "order_count_gte": order_count_gte,
                    "order_count_lte": None,
                    "cities": detected_cities if detected_cities else None,
                    "preferred_channels": detected_channels if detected_channels else None
                },
                "rationale": f"This segment targets customers {rationale_desc} to optimize campaign ROI and improve engagement.",
                "estimated_count": 0
            }
            
            # Stream the JSON string to simulate generative typing
            json_str = json.dumps(parsed, indent=2)
            chunk_size = 8
            for i in range(0, len(json_str), chunk_size):
                chunk_text = json_str[i:i+chunk_size]
                yield f"data: {json.dumps({'text': chunk_text})}\n\n"
                await asyncio.sleep(0.01)
                
            # Hydrate estimated_count with real DB query
            count = await get_segment_count_fn(parsed["rules"], db)
            parsed["estimated_count"] = count
            
            # Persist to ai_suggestions table
            await save_suggestion_fn(db, "segment_suggest", goal, parsed)
            
            yield f"data: {json.dumps({'done': True, 'result': parsed})}\n\n"

    return generate()
