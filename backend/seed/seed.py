import asyncio
import os
import sys
import random
from datetime import datetime, date, timedelta
from faker import Faker
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import AsyncSessionLocal, engine
from app.models import Base, Customer, Order

fake = Faker('en_IN')

# Seed profiles configuration
# (min_orders, max_orders, min_spend, max_spend, min_days_ago, max_days_ago)
PROFILES = {
    "high_value_lapsed": (5, 15, 8000.0, 25000.0, 50, 120),
    "frequent_recent": (10, 30, 2000.0, 8000.0, 1, 20),
    "new_one_time": (1, 2, 300.0, 1200.0, 5, 40),
    "mid_value_dormant": (3, 7, 2000.0, 6000.0, 90, 200)
}

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"]
CATEGORIES = ["Coffee", "Skincare", "Apparel", "Electronics", "Food"]
CHANNELS = ["online", "in-store"]

def generate_order_amounts(total_amount, count):
    if count == 1:
        return [round(total_amount, 2)]
    # Create count - 1 cut points to split total_amount
    cuts = sorted([random.uniform(0.0, total_amount) for _ in range(count - 1)])
    amounts = []
    prev = 0.0
    for c in cuts:
        amounts.append(round(c - prev, 2))
        prev = c
    amounts.append(round(total_amount - prev, 2))
    
    # Adjust for rounding difference
    diff = round(total_amount - sum(amounts), 2)
    amounts[0] = round(amounts[0] + diff, 2)
    return amounts

def generate_order_dates(last_order_date, count):
    dates = [last_order_date]
    current = last_order_date
    for _ in range(count - 1):
        gap = random.randint(3, 25)
        current = current - timedelta(days=gap)
        dates.append(current)
    # Sort from oldest to newest
    return sorted(dates)

async def seed_data():
    # Ensure all tables exist in the database first
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        print("Clearing existing database tables...")
        # Clear child tables first
        from app.models import (
            CommunicationEvent, CampaignRecipient, Campaign, Segment, AISuggestion
        )
        await session.execute(delete(CommunicationEvent))
        await session.execute(delete(CampaignRecipient))
        await session.execute(delete(Campaign))
        await session.execute(delete(Segment))
        await session.execute(delete(Order))
        await session.execute(delete(Customer))
        await session.execute(delete(AISuggestion))
        await session.commit()
        print("Existing data cleared.")

        # Total customers count: 800
        # 200 of each profile
        profile_allocation = []
        for _ in range(200): profile_allocation.append("high_value_lapsed")
        for _ in range(200): profile_allocation.append("frequent_recent")
        for _ in range(200): profile_allocation.append("new_one_time")
        for _ in range(200): profile_allocation.append("mid_value_dormant")

        # Base allocation of orders that gets us close to 3000
        # high_value_lapsed: 4 orders
        # frequent_recent: 8 orders
        # new_one_time: 1 order
        # mid_value_dormant: 2 orders
        # Sum = 200*4 + 200*8 + 200*1 + 200*2 = 800 + 1600 + 200 + 400 = 3000 orders exactly!
        # If we use exactly these fixed counts, the sum is exactly 3000.
        # Let's add slight variations and adjust to exactly 3000.
        order_counts = []
        for prof in profile_allocation:
            if prof == "high_value_lapsed":
                order_counts.append(random.randint(4, 6))
            elif prof == "frequent_recent":
                order_counts.append(random.randint(8, 10))
            elif prof == "new_one_time":
                order_counts.append(1)
            else: # mid_value_dormant
                order_counts.append(random.randint(2, 3))
        
        diff = sum(order_counts) - 3000
        print(f"Initial generated orders sum: {sum(order_counts)}. Adjusting to exactly 3000...")
        
        # Adjust difference to get exactly 3000 orders
        while diff != 0:
            idx = random.randint(0, 799)
            prof = profile_allocation[idx]
            if diff > 0:
                # We need to reduce orders
                min_val = 3 if prof == "high_value_lapsed" else (6 if prof == "frequent_recent" else (1 if prof == "new_one_time" else 1))
                if order_counts[idx] > min_val:
                    order_counts[idx] -= 1
                    diff -= 1
            else:
                # We need to increase orders
                max_val = 8 if prof == "high_value_lapsed" else (12 if prof == "frequent_recent" else (2 if prof == "new_one_time" else 4))
                if order_counts[idx] < max_val:
                    order_counts[idx] += 1
                    diff += 1

        print(f"Adjusted orders sum: {sum(order_counts)}")

        # Create customers and orders
        customers_to_insert = []
        orders_to_insert = []
        
        current_time = datetime.now()

        for idx, profile in enumerate(profile_allocation):
            # Generate customer profile details
            first_name = fake.first_name()
            last_name = fake.last_name()
            # Clean emails
            email = f"{first_name.lower()}.{last_name.lower()}.{random.randint(10,999)}@elarabrands.in"
            phone = f"+91{random.randint(7000000000, 9999999999)}"
            city = random.choice(CITIES)
            
            # Weighted preferred channel: 40% whatsapp, 35% email, 25% sms
            preferred_channel = random.choices(["whatsapp", "email", "sms"], weights=[0.40, 0.35, 0.25])[0]

            # Generate target spend
            min_spend, max_spend = PROFILES[profile][2], PROFILES[profile][3]
            target_spend = random.uniform(min_spend, max_spend)

            # Generate last order date
            min_days, max_days = PROFILES[profile][4], PROFILES[profile][5]
            last_order_days_ago = random.randint(min_days, max_days)
            last_order_date = current_time - timedelta(days=last_order_days_ago)

            count = order_counts[idx]
            order_amounts = generate_order_amounts(target_spend, count)
            order_dates = generate_order_dates(last_order_date, count)

            # Customer signup date should be slightly before first order
            first_order_date = order_dates[0]
            signup_date = (first_order_date - timedelta(days=random.randint(5, 30))).date()

            # Instantiate Customer
            customer = Customer(
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                city=city,
                signup_date=signup_date,
                preferred_channel=preferred_channel,
                total_spend=0.0,      # Will update from orders aggregate
                last_order_at=None,   # Will update from orders aggregate
                order_count=0         # Will update from orders aggregate
            )
            customers_to_insert.append(customer)

            # Instantiate Orders for this customer
            for o_idx in range(count):
                order = Order(
                    customer=customer,
                    order_date=order_dates[o_idx],
                    amount=order_amounts[o_idx],
                    status="completed",
                    category=random.choice(CATEGORIES),
                    channel=random.choice(CHANNELS)
                )
                orders_to_insert.append(order)

        # Batch insert customers
        print(f"Inserting {len(customers_to_insert)} customers...")
        session.add_all(customers_to_insert)
        await session.flush()  # Populates customer IDs

        # Batch insert orders
        print(f"Inserting {len(orders_to_insert)} orders...")
        session.add_all(orders_to_insert)
        await session.flush()

        # Update each customer's fields from aggregated order data
        print("Updating customer aggregates from order data...")
        await session.execute(
            text("""
                UPDATE customers
                SET total_spend = COALESCE((
                        SELECT SUM(amount) FROM orders 
                        WHERE orders.customer_id = customers.id
                    ), 0),
                    order_count = (
                        SELECT COUNT(*) FROM orders 
                        WHERE orders.customer_id = customers.id
                    ),
                    last_order_at = (
                        SELECT MAX(order_date) FROM orders 
                        WHERE orders.customer_id = customers.id
                    )
            """)
        )
        await session.commit()
        print("Data seeding completed successfully!")

async def main():
    try:
        await seed_data()
    except Exception as e:
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
