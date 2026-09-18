import { describe, expect, it } from "vitest";

import {
  calculateMonthlyMortgage,
  findComparableSales,
  filterProperties,
  parseNaturalLanguageSearch,
} from "../lib/property-engine";
import type { Property } from "../lib/property-types";

const listings: Property[] = [
  {
    id: "modern-townhouse",
    address: "2/30 Hardington Street",
    suburb: "Onehunga",
    city: "Auckland",
    region: "Auckland",
    price: 740_000,
    bedrooms: 3,
    bathrooms: 2,
    landArea: 165,
    floorArea: 132,
    yearBuilt: 2021,
    propertyType: "Townhouse",
    architecturalStyle: "Modernist",
    floodRisk: "Low",
    orientation: "North",
    sunlightHours: 7.8,
    latitude: -36.913,
    longitude: 174.787,
    image: "/properties/test.jpg",
    imageAlt: "Modern townhouse",
  },
  {
    id: "character-villa",
    address: "54 Kelmarna Avenue",
    suburb: "Ponsonby",
    city: "Auckland",
    region: "Auckland",
    price: 2_525_000,
    bedrooms: 3,
    bathrooms: 1,
    landArea: 531,
    floorArea: 148,
    yearBuilt: 1912,
    propertyType: "Villa",
    architecturalStyle: "Character",
    floodRisk: "Moderate",
    orientation: "East",
    sunlightHours: 5.4,
    latitude: -36.849,
    longitude: 174.734,
    image: "/properties/test.jpg",
    imageAlt: "Character villa",
  },
  {
    id: "wellington-townhouse",
    address: "8 Sample Terrace",
    suburb: "Mount Victoria",
    city: "Wellington",
    region: "Wellington",
    price: 895_000,
    bedrooms: 2,
    bathrooms: 1,
    landArea: 120,
    floorArea: 98,
    yearBuilt: 2018,
    propertyType: "Townhouse",
    architecturalStyle: "Contemporary",
    floodRisk: "Low",
    orientation: "South",
    sunlightHours: 4.6,
    latitude: -41.296,
    longitude: 174.789,
    image: "/properties/test.jpg",
    imageAlt: "Wellington townhouse",
  },
];

describe("natural-language property search", () => {
  it("extracts property type, location, price and bedroom requirements", () => {
    const result = parseNaturalLanguageSearch(
      "A modern three-bedroom townhouse in Auckland under $900,000",
      listings,
    );

    expect(result.status).toBe("ready");
    expect(result.filters).toEqual({
      architecturalStyles: ["Modernist"],
      propertyTypes: ["Townhouse"],
      location: "Auckland",
      maxPrice: 900_000,
      bedrooms: 3,
    });
  });

  it("combines character style, villa type and Auckland location", () => {
    const parsed = parseNaturalLanguageSearch(
      "Find character villas in Auckland",
      listings,
    );

    expect(filterProperties(listings, parsed.filters).map(({ id }) => id)).toEqual([
      "character-villa",
    ]);
  });

  it("asks the buyer to refine an unclear request", () => {
    const result = parseNaturalLanguageSearch("show me something nice", listings);

    expect(result.status).toBe("needs-clarification");
    expect(result.message).toContain("Try adding");
  });

  it("returns an empty collection when no listing matches", () => {
    const parsed = parseNaturalLanguageSearch(
      "four-bedroom apartments in Wellington under $500k",
      listings,
    );

    expect(filterProperties(listings, parsed.filters)).toEqual([]);
  });
});

describe("specialist filters", () => {
  it("filters by type, style, flood risk, age and north-facing orientation", () => {
    const result = filterProperties(listings, {
      propertyTypes: ["Townhouse"],
      architecturalStyles: ["Modernist"],
      floodRisks: ["Low"],
      yearBuiltFrom: 2010,
      yearBuiltTo: 2025,
      northFacingOnly: true,
    });

    expect(result.map(({ id }) => id)).toEqual(["modern-townhouse"]);
  });

  it("restores every listing when filters are empty", () => {
    expect(filterProperties(listings, {})).toHaveLength(3);
  });
});

describe("comparable sales", () => {
  const target = listings[0];
  const sales: Property[] = [
    {
      ...target,
      id: "near-recent",
      address: "31 Hardington Street",
      price: 760_000,
      latitude: -36.912,
      longitude: 174.788,
      soldDate: "2026-07-10",
    },
    {
      ...target,
      id: "near-older",
      address: "45 Hardington Street",
      price: 710_000,
      latitude: -36.914,
      longitude: 174.789,
      soldDate: "2026-02-01",
    },
    {
      ...target,
      id: "far-recent",
      address: "9 Distant Road",
      price: 810_000,
      latitude: -36.95,
      longitude: 174.82,
      soldDate: "2026-08-05",
    },
  ];

  it("keeps only nearby similar sales inside the selected timeframe", () => {
    const result = findComparableSales(target, sales, {
      radiusKm: 2,
      months: 6,
      asOf: new Date("2026-09-18T00:00:00Z"),
    });

    expect(result.comps.map(({ property }) => property.id)).toEqual(["near-recent"]);
    expect(result.averagePrice).toBe(760_000);
  });

  it("recalculates the average when the timeframe expands", () => {
    const result = findComparableSales(target, sales, {
      radiusKm: 2,
      months: 12,
      asOf: new Date("2026-09-18T00:00:00Z"),
    });

    expect(result.comps).toHaveLength(2);
    expect(result.averagePrice).toBe(735_000);
  });
});

describe("mortgage repayment", () => {
  it("calculates the default monthly payment for an $800k property", () => {
    expect(calculateMonthlyMortgage(800_000, 20, 6.49, 30)).toBe(4_041);
  });

  it("updates the payment when the deposit or rate changes", () => {
    expect(calculateMonthlyMortgage(800_000, 30, 5.5, 30)).toBe(3_180);
  });
});
