import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getPropertiesByStatus: vi.fn(),
  getComparableSales: vi.fn(),
  getAucklandSchoolOptions: vi.fn(),
}));

vi.mock("../lib/db/properties", () => db);

import { loadPropertyCatalog } from "../lib/property-catalog";
import { comparableSales as localSales, properties as localProperties } from "../lib/property-data";

const previousDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  db.getPropertiesByStatus.mockReset();
  db.getComparableSales.mockReset();
  db.getAucklandSchoolOptions.mockReset();
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

  it("adds source-captured agent details to matching database listings", async () => {
    process.env.DATABASE_URL = "postgresql://ready";
    const databaseProperty = { ...localProperties[0], listingAgent: undefined };
    db.getPropertiesByStatus.mockResolvedValue([databaseProperty]);

    const catalog = await loadPropertyCatalog();

    expect(catalog.properties[0].listingAgent).toEqual(localProperties[0].listingAgent);
  });

  it("does not attribute a bundled agent to an unrelated database listing", async () => {
    process.env.DATABASE_URL = "postgresql://ready";
    const databaseProperty = { ...localProperties[0], listingAgent: undefined };
    db.getPropertiesByStatus.mockResolvedValue([{ ...databaseProperty, id: "unrelated-listing" }]);

    const catalog = await loadPropertyCatalog();

    expect(catalog.properties[0].listingAgent).toBeUndefined();
  });

  it("does not attach an agent when the database listing source has changed", async () => {
    process.env.DATABASE_URL = "postgresql://ready";
    const databaseProperty = { ...localProperties[0], listingAgent: undefined };
    db.getPropertiesByStatus.mockResolvedValue([{
      ...databaseProperty,
      sources: databaseProperty.sources?.map(source => source.publisher === "OneRoof"
        ? { ...source, url: "https://www.oneroof.co.nz/a-different-listing" }
        : source),
    }]);

    const catalog = await loadPropertyCatalog();

    expect(catalog.properties[0].listingAgent).toBeUndefined();
  });
});
