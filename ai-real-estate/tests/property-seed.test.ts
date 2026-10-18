import { describe, expect, it } from "vitest";
import { comparableSales, properties } from "../lib/property-data";

describe("Auckland snapshot seed", () => {
  it("provides the 50 verified addresses with a sourced indicative value", () => {
    expect(properties).toHaveLength(50);
    expect(new Set(properties.map((property) => property.id)).size).toBe(50);

    const israel = properties.find((property) => property.address === "59 Israel Avenue");
    expect(israel).toMatchObject({
      suburb: "Clover Park",
      city: "Auckland",
      bedrooms: 3,
      bathrooms: 1,
      landArea: 601,
      price: 768000,
    });
    expect(israel?.sources?.some((source) =>
      source.publisher === "RealEstate" && source.fields.includes("price")
    )).toBe(true);
    expect(properties.every((property) => property.price > 0 && property.latitude && property.longitude)).toBe(true);
  });

  it("does not present invented comparable sales as records", () => {
    expect(comparableSales).toEqual([]);
  });
});
