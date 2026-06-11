"""
Segmentation service — builds dynamic SQLAlchemy queries from rule_json.

Used by /segments/preview, POST /segments, and campaign send to resolve audience.
"""
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.order import Order


def build_segment_query(rule_json: dict[str, Any]):
    """
    Accepts a rule_json dict and returns a SQLAlchemy Select statement
    that filters the customers table.  Callers can further paginate or count.

    Supported keys:
        last_order_days_gt   – last order more than N days ago
        last_order_days_lt   – last order less than N days ago
        total_spend_gt       – spend above threshold
        total_spend_lt       – spend below threshold
        order_count_gte      – at least N orders
        order_count_lte      – at most N orders
        cities               – list of city names
        preferred_channels   – list of channel names
        category             – customer has ≥1 order in this category
    """
    filters = []
    now = datetime.utcnow()

    if "last_order_days_gt" in rule_json and rule_json["last_order_days_gt"] is not None:
        cutoff = now - timedelta(days=int(rule_json["last_order_days_gt"]))
        filters.append(Customer.last_order_at < cutoff)

    if "last_order_days_lt" in rule_json and rule_json["last_order_days_lt"] is not None:
        cutoff = now - timedelta(days=int(rule_json["last_order_days_lt"]))
        filters.append(Customer.last_order_at > cutoff)

    if "total_spend_gt" in rule_json and rule_json["total_spend_gt"] is not None:
        filters.append(Customer.total_spend > float(rule_json["total_spend_gt"]))

    if "total_spend_lt" in rule_json and rule_json["total_spend_lt"] is not None:
        filters.append(Customer.total_spend < float(rule_json["total_spend_lt"]))

    if "order_count_gte" in rule_json and rule_json["order_count_gte"] is not None:
        filters.append(Customer.order_count >= int(rule_json["order_count_gte"]))

    if "order_count_lte" in rule_json and rule_json["order_count_lte"] is not None:
        filters.append(Customer.order_count <= int(rule_json["order_count_lte"]))

    if "cities" in rule_json and rule_json["cities"]:
        filters.append(Customer.city.in_(rule_json["cities"]))

    if "preferred_channels" in rule_json and rule_json["preferred_channels"]:
        filters.append(Customer.preferred_channel.in_(rule_json["preferred_channels"]))

    # Category filter: customer must have at least one order in this category
    if "category" in rule_json and rule_json["category"]:
        category_subquery = (
            select(Order.customer_id)
            .where(Order.category == rule_json["category"])
            .distinct()
            .correlate(Customer)
            .scalar_subquery()
        )
        filters.append(Customer.id.in_(
            select(Order.customer_id)
            .where(Order.category == rule_json["category"])
            .distinct()
        ))

    stmt = select(Customer)
    if filters:
        stmt = stmt.where(and_(*filters))

    return stmt


async def preview_segment(
    db: AsyncSession,
    rule_json: dict[str, Any],
) -> dict:
    """Run segment rules and return count + first 5 sample customers."""
    base_stmt = build_segment_query(rule_json)

    # Count
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    count_result = await db.execute(count_stmt)
    count = count_result.scalar_one()

    # Sample (first 5)
    sample_stmt = base_stmt.limit(5)
    sample_result = await db.execute(sample_stmt)
    sample_customers = sample_result.scalars().all()

    return {
        "count": count,
        "sample_customers": [
            {
                "id": str(c.id),
                "first_name": c.first_name,
                "last_name": c.last_name,
                "email": c.email,
                "city": c.city,
                "total_spend": float(c.total_spend),
                "order_count": c.order_count,
                "preferred_channel": c.preferred_channel,
            }
            for c in sample_customers
        ],
    }


async def get_segment_customers(
    db: AsyncSession,
    rule_json: dict[str, Any],
) -> list[Customer]:
    """Return *all* customers matching segment rules (used for campaign send)."""
    stmt = build_segment_query(rule_json)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_segment_count(rule_json: dict, db: AsyncSession) -> int:
    """Return count of customers matching segment rules."""
    base_stmt = build_segment_query(rule_json)
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    count_result = await db.execute(count_stmt)
    return count_result.scalar_one()
