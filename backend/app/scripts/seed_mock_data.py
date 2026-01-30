"""
Seed mock data: marketplaces, products, order_items, ad_spend_daily, inventory_snapshots.
Run from backend dir: python -m app.scripts.seed_mock_data --days 120
"""
from __future__ import annotations

import argparse
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ad_spend_daily import AdSpendDaily
from app.models.inventory_snapshot import InventorySnapshot
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product

BATCH_SIZE = 500
STARTING_STOCK = 100
RESTOCK_THRESHOLD = 20
RESTOCK_TO = 100


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed mock Amazon dashboard data")
    p.add_argument("--days", type=int, default=120, help="Number of days of data to generate")
    p.add_argument("--marketplaces", type=str, default="US,UK,DE", help="Comma-separated marketplace codes")
    p.add_argument("--products", type=int, default=30, help="Target number of products")
    p.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    return p.parse_args()


def ensure_marketplaces(db, codes: list[str]) -> dict[str, Marketplace]:
    code_to_mk = {}
    defaults = {
        "US": ("United States", "USD"),
        "UK": ("United Kingdom", "GBP"),
        "DE": ("Germany", "EUR"),
    }
    for code in codes:
        code = code.strip()
        if not code:
            continue
        row = db.scalar(select(Marketplace).where(Marketplace.code == code))
        if row is None:
            name, currency = defaults.get(code, (code, "USD"))
            mk = Marketplace(code=code, name=name, currency=currency)
            db.add(mk)
            db.flush()
            code_to_mk[code] = mk
        else:
            code_to_mk[code] = row
    db.commit()
    return code_to_mk


def ensure_products(db, target: int, rng: random.Random) -> tuple[list[Product], dict[str, float]]:
    existing = db.scalars(select(Product)).all()
    sku_to_price: dict[str, float] = {}
    for p in existing:
        sku_to_price[p.sku] = float(rng.uniform(10, 80))  # deterministic per run for existing
    products = list(existing)
    next_id = max((p.id for p in products), default=0) + 1
    next_sku = 1
    while len(products) < target:
        sku = f"SKU-{next_sku:04d}"
        next_sku += 1
        if db.scalar(select(Product).where(Product.sku == sku)):
            continue
        price = round(rng.uniform(10, 80), 2)
        sku_to_price[sku] = price
        prod = Product(
            id=next_id,
            sku=sku,
            asin=f"B0{rng.randint(1000000, 9999999)}",
            title=f"Mock Product {next_id}",
            created_at=datetime.now(timezone.utc),
        )
        db.add(prod)
        db.flush()
        products.append(prod)
        next_id += 1
    db.commit()
    # Reassign prices for all products so we have a consistent dict for order revenue
    for p in products:
        if p.sku not in sku_to_price:
            sku_to_price[p.sku] = round(rng.uniform(10, 80), 2)
    return products, sku_to_price


def generate_orders(
    db,
    marketplaces: dict[str, Marketplace],
    products: list[Product],
    sku_to_price: dict[str, float],
    start_date: date,
    end_date: date,
    rng: random.Random,
) -> tuple[dict[tuple[date, int], float], dict[tuple[date, str], int]]:
    """Generate order_items. Return daily_revenue[(date, marketplace_id)] and units_sold[(date, sku)]."""
    daily_revenue: dict[tuple[date, int], float] = {}
    units_sold: dict[tuple[date, str], int] = {}
    # Biased weights: earlier products (lower index) get higher weight
    weights = [len(products) - i for i in range(len(products))]
    batch: list[OrderItem] = []
    order_idx = 0
    current = start_date
    while current <= end_date:
        weekday = current.weekday()  # 0 Mon .. 6 Sun; 5,6 = weekend
        is_weekend = weekday >= 5
        for code, mk in marketplaces.items():
            n_orders = rng.randint(2, 8) if is_weekend else rng.randint(5, 25)
            for _ in range(n_orders):
                order_id = f"{current.isoformat()}_{code}_{order_idx}"
                order_idx += 1
                n_lines = rng.randint(1, 4)
                chosen = rng.choices(products, weights=weights, k=n_lines)
                for prod in chosen:
                    units = rng.randint(1, 4)
                    rev = round(units * sku_to_price[prod.sku], 2)
                    batch.append(
                        OrderItem(
                            order_id=order_id,
                            order_date=current,
                            marketplace_id=mk.id,
                            sku=prod.sku,
                            units=units,
                            revenue=Decimal(str(rev)),
                        )
                    )
                    key_dr = (current, mk.id)
                    daily_revenue[key_dr] = daily_revenue.get(key_dr, 0) + rev
                    key_us = (current, prod.sku)
                    units_sold[key_us] = units_sold.get(key_us, 0) + units
                if len(batch) >= BATCH_SIZE:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []
        current += timedelta(days=1)
    if batch:
        db.bulk_save_objects(batch)
        db.commit()
    return daily_revenue, units_sold


def generate_ad_spend(
    db,
    marketplaces: dict[str, Marketplace],
    daily_revenue: dict[tuple[date, int], float],
    start_date: date,
    end_date: date,
    rng: random.Random,
) -> None:
    batch: list[AdSpendDaily] = []
    current = start_date
    while current <= end_date:
        for mk in marketplaces.values():
            rev = daily_revenue.get((current, mk.id), 0)
            pct = rng.uniform(0.03, 0.15)
            noise = rng.uniform(0.9, 1.1)
            spend = round(rev * pct * noise, 2)
            if spend < 0:
                spend = 0
            batch.append(
                AdSpendDaily(
                    date=current,
                    marketplace_id=mk.id,
                    spend=Decimal(str(spend)),
                )
            )
        if len(batch) >= BATCH_SIZE:
            db.bulk_save_objects(batch)
            db.commit()
            batch = []
        current += timedelta(days=1)
    if batch:
        db.bulk_save_objects(batch)
        db.commit()


def generate_inventory(
    db,
    products: list[Product],
    units_sold: dict[tuple[date, str], int],
    start_date: date,
    end_date: date,
    rng: random.Random,
) -> None:
    stock: dict[str, int] = {p.sku: STARTING_STOCK for p in products}
    batch: list[InventorySnapshot] = []
    current = start_date
    while current <= end_date:
        for prod in products:
            sold = units_sold.get((current, prod.sku), 0)
            stock[prod.sku] = max(0, stock[prod.sku] - sold)
            if stock[prod.sku] <= RESTOCK_THRESHOLD and rng.random() < 0.3:
                stock[prod.sku] = RESTOCK_TO
            batch.append(
                InventorySnapshot(
                    date=current,
                    sku=prod.sku,
                    on_hand=stock[prod.sku],
                )
            )
        if len(batch) >= BATCH_SIZE:
            db.bulk_save_objects(batch)
            db.commit()
            batch = []
        current += timedelta(days=1)
    if batch:
        db.bulk_save_objects(batch)
        db.commit()


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)
    codes = [c.strip() for c in args.marketplaces.split(",") if c.strip()]
    if not codes:
        codes = ["US", "UK", "DE"]

    end_date = date.today()
    start_date = end_date - timedelta(days=args.days - 1)

    db = SessionLocal()
    try:
        marketplaces = ensure_marketplaces(db, codes)
        products, sku_to_price = ensure_products(db, args.products, rng)
        daily_revenue, units_sold = generate_orders(
            db, marketplaces, products, sku_to_price, start_date, end_date, rng
        )
        generate_ad_spend(db, marketplaces, daily_revenue, start_date, end_date, rng)
        generate_inventory(db, products, units_sold, start_date, end_date, rng)
        print(
            f"Seeded: {len(marketplaces)} marketplaces, {len(products)} products, "
            f"orders from {start_date} to {end_date}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
