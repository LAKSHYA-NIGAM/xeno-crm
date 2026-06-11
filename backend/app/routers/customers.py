"""
Customers router — list, stats, and detail endpoints.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Customer
from app.models.order import Order

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/stats")
async def get_customer_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns aggregate customer statistics:
    total_customers, total_revenue, avg_order_value, active_last_30_days
    """
    # Total customers
    total_q = await db.execute(select(func.count(Customer.id)))
    total_customers = total_q.scalar_one()

    # Total revenue (sum of all order amounts)
    rev_q = await db.execute(select(func.coalesce(func.sum(Order.amount), 0)))
    total_revenue = float(rev_q.scalar_one())

    # Average order value
    avg_q = await db.execute(select(func.coalesce(func.avg(Order.amount), 0)))
    avg_order_value = round(float(avg_q.scalar_one()), 2)

    # Active in last 30 days
    cutoff = datetime.utcnow() - timedelta(days=30)
    active_q = await db.execute(
        select(func.count(Customer.id)).where(Customer.last_order_at >= cutoff)
    )
    active_last_30_days = active_q.scalar_one()

    return {
        "total_customers": total_customers,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order_value,
        "active_last_30_days": active_last_30_days,
    }


@router.get("")
async def get_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    city: Optional[str] = None,
    preferred_channel: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List customers with optional filtering and search.
    """
    stmt = select(Customer)

    if city:
        stmt = stmt.where(Customer.city == city)

    if preferred_channel:
        stmt = stmt.where(Customer.preferred_channel == preferred_channel)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )

    stmt = stmt.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    customers = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "first_name": c.first_name,
            "last_name": c.last_name,
            "email": c.email,
            "phone": c.phone,
            "city": c.city,
            "signup_date": c.signup_date.isoformat() if c.signup_date else None,
            "preferred_channel": c.preferred_channel,
            "total_spend": float(c.total_spend),
            "last_order_at": c.last_order_at.isoformat() if c.last_order_at else None,
            "order_count": c.order_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in customers
    ]


@router.get("/{customer_id}")
async def get_customer(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Return a single customer with their last 10 orders.
    """
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalars().first()

    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")

    # Fetch last 10 orders
    orders_stmt = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.order_date.desc())
        .limit(10)
    )
    orders_result = await db.execute(orders_stmt)
    orders = orders_result.scalars().all()

    return {
        "id": str(customer.id),
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "email": customer.email,
        "phone": customer.phone,
        "city": customer.city,
        "signup_date": customer.signup_date.isoformat() if customer.signup_date else None,
        "preferred_channel": customer.preferred_channel,
        "total_spend": float(customer.total_spend),
        "last_order_at": customer.last_order_at.isoformat() if customer.last_order_at else None,
        "order_count": customer.order_count,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "recent_orders": [
            {
                "id": str(o.id),
                "order_date": o.order_date.isoformat(),
                "amount": float(o.amount),
                "status": o.status,
                "category": o.category,
                "channel": o.channel,
            }
            for o in orders
        ],
    }
