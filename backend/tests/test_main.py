from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
import main
from main import _map_property


def property_row():
    return {
        "property_id": 23,
        "title": "Sunny home",
        "body": None,
        "listing_type": "rent",
        "status": "active",
        "listed_at": None,
        "pricing_method": "fixed",
        "sale_price": Decimal("900000"),
        "rent_price": Decimal("650"),
        "rent_period": "week",
        "lease_price": None,
        "currency": "NZD",
        "unit_number": "2",
        "street_number": "14",
        "street_name": "Example Road",
        "suburb": "Ponsonby",
        "city": "Auckland",
        "state": "Auckland",
        "post_code": "1011",
        "country": "New Zealand",
        "latitude": Decimal("-36.85"),
        "longitude": Decimal("174.73"),
        "property_type": "townhouse",
        "land_area": None,
        "floor_area": Decimal("120.5"),
        "bedrooms": 3,
        "bathrooms": 2,
        "year_built": None,
        "image_url": None,
        "image_caption": None,
    }


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeConnection:
    def __init__(self, rows):
        self.rows = rows
        self.statement = ""
        self.params = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def execute(self, statement, params):
        self.statement = str(statement)
        self.params = params
        return FakeResult(self.rows)


class FakeEngine:
    def __init__(self, rows):
        self.connection = FakeConnection(rows)

    def connect(self):
        return self.connection


def test_maps_database_listing_fields_without_inventing_demo_data():
    property_data = _map_property(
        property_row()
    )

    assert property_data["id"] == "23"
    assert property_data["address"] == "2/14 Example Road"
    assert property_data["propertyType"] == "Townhouse"
    assert property_data["price"] == 650
    assert property_data["rentPeriod"] == "week"
    assert property_data["landArea"] is None
    assert property_data["yearBuilt"] is None
    assert property_data["architecturalStyle"] is None
    assert property_data["floodRisk"] is None


def test_list_endpoint_binds_filters_and_returns_schema_records(monkeypatch):
    fake_engine = FakeEngine([property_row()])
    monkeypatch.setattr(main, "engine", fake_engine)

    response = TestClient(main.app).get(
        "/api/v1/properties?city=Auckland&listing_type=rent&max_price=700"
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["id"] == "23"
    assert item["price"] == 650
    assert item["listingType"] == "rent"
    assert fake_engine.connection.params["city"] == "%Auckland%"
    assert fake_engine.connection.params["max_price"] == 700
    assert ":city" in fake_engine.connection.statement


def test_price_search_requires_listing_type():
    response = TestClient(main.app).get(
        "/api/v1/properties?min_price=100"
    )

    assert response.status_code == 422


def test_sales_endpoint_maps_sale_history(monkeypatch):
    row = property_row()
    row.update(
        listing_type="sale",
        sold_price=Decimal("800000"),
        sold_date=date(2026, 7, 10),
    )
    fake_engine = FakeEngine([row])
    monkeypatch.setattr(main, "engine", fake_engine)

    response = TestClient(main.app).get("/api/v1/sales")

    assert response.status_code == 200
    assert response.json()["items"][0]["price"] == 800000
    assert response.json()["items"][0]["soldDate"] == "2026-07-10"
    assert "ps.sold_price AS sale_price" in fake_engine.connection.statement
    assert "ps.sold_date" in fake_engine.connection.statement
