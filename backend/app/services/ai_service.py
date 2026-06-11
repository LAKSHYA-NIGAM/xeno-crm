from app.models.ai_suggestion import AISuggestion

async def save_suggestion(db, type: str, input_prompt: str, output_json: dict):
    """Persists every AI call to ai_suggestions for auditability."""
    suggestion = AISuggestion(
        type=type,
        input_prompt=input_prompt,
        output_json=output_json,
    )
    db.add(suggestion)
    await db.commit()

async def get_sample_customers(rules: dict, db) -> list[dict]:
    """Returns 3 sample customers matching the segment rules for AI context."""
    from app.services.segmentation import build_segment_query
    query = build_segment_query(rules).limit(3)
    result = await db.execute(query)
    customers = result.scalars().all()
    return [
        {
            "first_name": c.first_name,
            "city": c.city,
            "last_order_at": c.last_order_at.strftime("%d %b %Y") if c.last_order_at else "N/A",
        }
        for c in customers
    ]
