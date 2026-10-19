import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getPropertiesByStatus: vi.fn(),
  getComparableSales: vi.fn(),
}));

vi.mock("../lib/db/properties", () => db);

import { loadPropertyCatalog } from "../lib/property-catalog";
import { comparableSales as localSales, properties as localProperties } from "../lib/property-data";

const previousDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  db.getPropertiesByStatus.mockReset();
  db.getComparableSales.mockReset();
});

afterEach(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

describe("property catalogue without a connected database", () => {
  it("serves bundled listings when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    const catalog = await loadPropertyCatalog(true);

    expect(catalog.properties).toBe(localProperties);
    expect(catalog.comparableSales).toBe(localSales);
    expect(catalog.properties.length).toBeGreaterThan(0);
    expect(db.getPropertiesByStatus).not.toHaveBeenCalled();
  });

  it("serves bundled listings when the database request fails", async () => {
    process.env.DATABASE_URL = "postgresql://unavailable";
    db.getPropertiesByStatus.mockRejectedValue(new Error("connection refused"));

    const catalog = await loadPropertyCatalog(true);

    expect(catalog.properties).toBe(localProperties);
    expect(catalog.comparableSales).toBe(localSales);
  });

  it("serves bundled listings when the database has not been seeded", async () => {
    process.env.DATABASE_URL = "postgresql://empty";
    db.getPropertiesByStatus.mockResolvedValue([]);

    const catalog = await loadPropertyCatalog(true);

    expect(catalog.properties).toBe(localProperties);
    expect(catalog.comparableSales).toBe(localSales);
  });

  it("uses database listings and comparable sales when available", async () => {
    process.env.DATABASE_URL = "postgresql://ready";
    const dbProperties = [{ ...localProperties[0], id: "database-property" }];
    const dbSales = [{ ...localProperties[0], id: "database-sale" }];
    db.getPropertiesByStatus.mockResolvedValue(dbProperties);
    db.getComparableSales.mockResolvedValue(dbSales);

    const catalog = await loadPropertyCatalog(true);

    expect(catalog.properties).toBe(dbProperties);
    expect(catalog.comparableSales).toBe(dbSales);
  });
});
