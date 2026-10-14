from __future__ import annotations

import os
import logging
from collections.abc import Mapping
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


load_dotenv(Path(__file__).with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
logger = logging.getLogger(__name__)

app = FastAPI(title="Haven Real Estate API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

engine: AsyncEngine | None = (
    create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
    if DATABASE_URL
    else None
)

PROPERTY_SELECT = """
SELECT
    p.property_id, p.title, p.body, p.listing_type, p.status, p.listed_at,
    pp.pricing_method, pp.sale_price, pp.rent_price, pp.rent_period,
    pp.lease_price, pp.currency,
    a.unit_number, a.street_number, a.street_name, a.suburb, a.city, a.state,
    a.post_code, a.country, a.latitude, a.longitude,
    pd.property_type, pd.land_area, pd.floor_area, pd.bedrooms, pd.bathrooms,
    pd.year_built,
    pi.url AS image_url, pi.caption AS image_caption
FROM properties AS p
LEFT JOIN property_price AS pp ON pp.property_id = p.property_id
LEFT JOIN address AS a ON a.property_id = p.property_id
LEFT JOIN property_details AS pd ON pd.property_id = p.property_id
LEFT JOIN property_images AS pi ON pi.image_id = (
    SELECT image_id
    FROM property_images
    WHERE property_id = p.property_id
    ORDER BY is_cover DESC, sort_order ASC, image_id ASC
    LIMIT 1
)
"""


def database_engine() -> AsyncEngine:
    if engine is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not configured. Set DATABASE_URL for the FastAPI service.",
        )
    return engine


def _number(value: Any) -> float | None:
    if value is None:
        return None
    return float(value) if isinstance(value, Decimal) else float(value)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, (date, datetime, time)) else None


def _property_type(value: str | None) -> str | None:
    if value is None:
        return None
    return {
        "lifestyle": "Lifestyle block",
        "townhouse": "Townhouse",
    }.get(value, value.title())


def _map_property(row: Mapping[str, Any]) -> dict[str, Any]:
    street = " ".join(
        part for part in (row.get("street_number"), row.get("street_name")) if part
    )
    unit = row.get("unit_number")
    address = f"{unit}/{street}" if unit else street
    listing_type = row.get("listing_type")
    price_column = {
        "sale": "sale_price",
        "rent": "rent_price",
        "lease": "lease_price",
    }.get(listing_type)
    price = _number(row.get(price_column)) if price_column else None

    return {
        "id": str(row["property_id"]),
        "title": row.get("title"),
        "description": row.get("body"),
        "address": address or row.get("title", "Address unavailable"),
        "suburb": row.get("suburb"),
        "city": row.get("city") or "",
        "region": row.get("state") or "",
        "postCode": row.get("post_code"),
        "country": row.get("country"),
        "price": price,
        "currency": row.get("currency") or "NZD",
        "listingType": listing_type,
        "rentPeriod": row.get("rent_period"),
        "pricingMethod": row.get("pricing_method"),
        "status": row.get("status"),
        "listedAt": _iso(row.get("listed_at")),
        "bedrooms": row.get("bedrooms"),
        "bathrooms": row.get("bathrooms"),
        "landArea": _number(row.get("land_area")),
        "floorArea": _number(row.get("floor_area")),
        "yearBuilt": row.get("year_built"),
        "propertyType": _property_type(row.get("property_type")),
        "architecturalStyle": None,
        "floodRisk": None,
        "orientation": None,
        "sunlightHours": None,
        "latitude": _number(row.get("latitude")),
        "longitude": _number(row.get("longitude")),
        "image": row.get("image_url"),
        "imageAlt": row.get("image_caption") or row.get("title") or "Property image",
    }


def _database_error(error: SQLAlchemyError) -> HTTPException:
    logger.error(
        "Property database request failed.",
        exc_info=(type(error), error, error.__traceback__),
    )
    return HTTPException(
        status_code=503,
        detail="The property database is temporarily unavailable.",
    )


@app.get("/healthz")
async def health_check() -> dict[str, str]:
    try:
        async with database_engine().connect() as connection:
            await connection.execute(text("SELECT 1"))
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_error(error) from error
    return {"status": "ok", "database": "connected"}


@app.get("/api/v1/properties")
async def list_properties(
    q: str | None = Query(default=None, max_length=200),
    status: str = Query(default="active", pattern="^(draft|active|under_offer|sold|rented|withdrawn)$"),
    listing_type: str | None = Query(default=None, pattern="^(sale|rent|lease)$"),
    property_type: str | None = Query(
        default=None,
        pattern="^(house|apartment|townhouse|unit|section|lifestyle|commercial|other)$",
    ),
    city: str | None = Query(default=None, max_length=100),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    bedrooms: int | None = Query(default=None, ge=0, le=255),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="min_price cannot exceed max_price.")

    conditions = ["p.status = :status"]
    params: dict[str, Any] = {
        "status": status,
        "limit": limit,
        "offset": offset,
    }
    if listing_type:
        conditions.append("p.listing_type = :listing_type")
        params["listing_type"] = listing_type
    if property_type:
        conditions.append("pd.property_type = :property_type")
        params["property_type"] = property_type
    if city:
        conditions.append("a.city LIKE :city")
        escaped_city = city.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["city"] = f"%{escaped_city}%"
    if q:
        conditions.append(
            "(p.title LIKE :search OR a.street_name LIKE :search "
            "OR a.street_number LIKE :search OR a.suburb LIKE :search OR a.city LIKE :search)"
        )
        search = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{search}%"
    price_column = {
        "sale": "pp.sale_price",
        "rent": "pp.rent_price",
        "lease": "pp.lease_price",
    }.get(listing_type or "")
    if min_price is not None or max_price is not None:
        if price_column is None:
            raise HTTPException(
                status_code=422,
                detail="Choose listing_type when filtering by price.",
            )
        if min_price is not None:
            conditions.append(f"{price_column} >= :min_price")
            params["min_price"] = min_price
        if max_price is not None:
            conditions.append(f"{price_column} <= :max_price")
            params["max_price"] = max_price
    if bedrooms is not None:
        conditions.append("pd.bedrooms = :bedrooms")
        params["bedrooms"] = bedrooms

    statement = text(
        PROPERTY_SELECT
        + " WHERE "
        + " AND ".join(conditions)
        + " ORDER BY p.listed_at DESC, p.property_id DESC"
        + " LIMIT :limit OFFSET :offset"
    )
    try:
        async with database_engine().connect() as connection:
            result = await connection.execute(statement, params)
            items = [_map_property(row) for row in result.mappings()]
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_error(error) from error
    return {"items": items, "limit": limit, "offset": offset}


@app.get("/api/v1/properties/{property_id}")
async def get_property(property_id: int) -> dict[str, Any]:
    try:
        async with database_engine().connect() as connection:
            result = await connection.execute(
                text(PROPERTY_SELECT + " WHERE p.property_id = :property_id"),
                {"property_id": property_id},
            )
            row = result.mappings().first()
    except SQLAlchemyError as error:
        raise _database_error(error) from error
    if row is None:
        raise HTTPException(status_code=404, detail="Property not found.")
    return _map_property(row)


@app.get("/api/v1/sales")
async def list_sales(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    sales_select = PROPERTY_SELECT.replace(
        "pp.sale_price, pp.rent_price, pp.rent_period,",
        "ps.sold_price AS sale_price, pp.rent_price, pp.rent_period,",
    ).replace("p.listed_at,", "ps.sold_date, p.listed_at,")
    statement = text(
        sales_select
        + """
        JOIN property_sales AS ps ON ps.property_id = p.property_id
        ORDER BY ps.sold_date DESC, ps.sale_id DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        async with database_engine().connect() as connection:
            result = await connection.execute(
                statement, {"limit": limit, "offset": offset}
            )
            items = []
            for row in result.mappings():
                item = _map_property(row)
                item["price"] = _number(row["sold_price"])
                item["soldDate"] = _iso(row["sold_date"])
                item["listingType"] = "sale"
                items.append(item)
    except SQLAlchemyError as error:
        raise _database_error(error) from error
    return {"items": items, "limit": limit, "offset": offset}
