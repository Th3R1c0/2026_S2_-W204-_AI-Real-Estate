import { describe, expect, it } from "vitest";

import {
  calculateMonthlyMortgage,
  findComparableSales,
  filterProperties,
  generateValuationHistory,
  generateSampleNotifications,
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
    floodHazards: [
      {
        type: "flood_plains",
        sourceFeatureId: "1",
        sourceUrl: "https://council.example/flood-plains",
      },
    ],
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
    floodHazards: [
      {
        type: "flood_prone_areas",
        sourceFeatureId: "2",
        sourceUrl: "https://council.example/flood-prone",
      },
    ],
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
    floodHazards: [],
    orientation: "South",
    sunlightHours: 4.6,
    latitude: -41.296,
    longitude: 174.789,
    image: "/properties/test.jpg",
    imageAlt: "Wellington townhouse",
  },
];

describe("natural-language property search", () => {
  it("keeps every constraint in a combined house search", () => {
    const houses: Property[] = [
      { ...listings[0], id: "match", propertyType: "House", price: 650_000, bathrooms: 1, parkingSpaces: 2, landArea: 520 },
      { ...listings[0], id: "wrong-bath", propertyType: "House", price: 650_000, bathrooms: 2, parkingSpaces: 2, landArea: 520 },
      { ...listings[0], id: "wrong-parking", propertyType: "House", price: 650_000, bathrooms: 1, parkingSpaces: 1, landArea: 520 },
      { ...listings[0], id: "wrong-land", propertyType: "House", price: 650_000, bathrooms: 1, parkingSpaces: 2, landArea: 350 },
      { ...listings[0], id: "wrong-price", propertyType: "House", price: 450_000, bathrooms: 1, parkingSpaces: 2, landArea: 520 },
    ];
    const result = parseNaturalLanguageSearch(
      "houses over $500k with one bathroom, at least 2 parking spaces and at least 400 m² of land",
      houses,
    );

    expect(result.filters).toMatchObject({
      propertyTypes: ["House"],
      minPrice: 500_000,
      numericCriteria: {
        bathrooms: { min: 1, max: 1 },
        parkingSpaces: { min: 2 },
        landArea: { min: 400 },
      },
    });
    expect(filterProperties(houses, result.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("handles price ranges, bedroom minimums, floor area, aspect and ownership together", () => {
    const homes: Property[] = [
      { ...listings[0], id: "match", propertyType: "House", price: 750_000, bedrooms: 4, floorArea: 140, orientation: "East", ownershipType: "Freehold" },
      { ...listings[0], id: "outside-price", propertyType: "House", price: 950_000, bedrooms: 4, floorArea: 140, orientation: "East", ownershipType: "Freehold" },
      { ...listings[0], id: "too-few-beds", propertyType: "House", price: 750_000, bedrooms: 2, floorArea: 140, orientation: "East", ownershipType: "Freehold" },
      { ...listings[0], id: "too-large", propertyType: "House", price: 750_000, bedrooms: 4, floorArea: 160, orientation: "East", ownershipType: "Freehold" },
      { ...listings[0], id: "wrong-aspect", propertyType: "House", price: 750_000, bedrooms: 4, floorArea: 140, orientation: "West", ownershipType: "Freehold" },
      { ...listings[0], id: "wrong-title", propertyType: "House", price: 750_000, bedrooms: 4, floorArea: 140, orientation: "East", ownershipType: "Cross Lease" },
    ];
    const result = parseNaturalLanguageSearch(
      "houses between $500k and $900k with at least 3 bedrooms, floor area under 150 m2, east-facing and freehold",
      homes,
    );

    expect(result.filters).toMatchObject({
      minPrice: 500_000,
      maxPrice: 900_000,
      numericCriteria: { bedrooms: { min: 3 }, floorArea: { max: 150 } },
      orientations: ["East"],
      ownershipTypes: ["Freehold"],
    });
    expect(filterProperties(homes, result.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("matches a named address and a named in-zone school from listing data", () => {
    const homes: Property[] = [
      { ...listings[0], id: "match", address: "54 Kelmarna Avenue", schoolZones: [{ name: "Auckland Grammar School", type: "Secondary", distanceKm: 1, isInZone: true }] },
      { ...listings[0], id: "out-of-zone", address: "56 Kelmarna Avenue", schoolZones: [{ name: "Auckland Grammar School", type: "Secondary", distanceKm: 1, isInZone: false }] },
    ];
    const parsed = parseNaturalLanguageSearch("54 Kelmarna Avenue in Auckland Grammar School zone", homes);

    expect(parsed.filters).toMatchObject({ location: "54 Kelmarna Avenue", schoolZoneName: "Auckland Grammar School" });
    expect(filterProperties(homes, parsed.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("matches a stated commute destination and mode only when travel data exists", () => {
    const homes: Property[] = [
      { ...listings[0], id: "match", commuteOptions: [{ destinationName: "Auckland CBD", mode: "transit", travelTimes: { transit: 25 } }] },
      { ...listings[0], id: "too-slow", commuteOptions: [{ destinationName: "Auckland CBD", mode: "transit", travelTimes: { transit: 40 } }] },
      { ...listings[0], id: "unknown", commuteOptions: undefined },
    ];
    const parsed = parseNaturalLanguageSearch("within 30 minutes to Auckland CBD by transit", homes);

    expect(parsed.filters).toMatchObject({ maxCommuteTimeMinutes: 30, commuteMode: "transit", commuteDestination: "Auckland CBD" });
    expect(filterProperties(homes, parsed.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("keeps weekly rent and capital value separate from asking price", () => {
    const homes: Property[] = [
      { ...listings[0], id: "match", estimatedWeeklyRent: 750, capitalValue: 850_000 },
      { ...listings[0], id: "low-rent", estimatedWeeklyRent: 550, capitalValue: 850_000 },
      { ...listings[0], id: "high-value", estimatedWeeklyRent: 750, capitalValue: 1_200_000 },
    ];
    const result = parseNaturalLanguageSearch(
      "weekly rent over $600 and capital value under $1m",
      homes,
    );

    expect(result.filters).toEqual({
      numericCriteria: {
        estimatedWeeklyRent: { min: 600 },
        capitalValue: { max: 1_000_000 },
      },
    });
    expect(filterProperties(homes, result.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("treats sunny and east-facing as compatible conditions", () => {
    const homes: Property[] = [
      { ...listings[0], id: "match", orientation: "East", sunlightHours: 7.5 },
      { ...listings[0], id: "not-sunny", orientation: "East", sunlightHours: 4.5 },
      { ...listings[0], id: "not-east", orientation: "West", sunlightHours: 7.5 },
    ];
    const result = parseNaturalLanguageSearch("sunny east-facing", homes);

    expect(result.filters).toMatchObject({
      orientations: ["East"],
      numericCriteria: { sunlightHours: { min: 6 } },
    });
    expect(filterProperties(homes, result.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("supports a maximum walk score and an exact construction year", () => {
    const homes: Property[] = [
      { ...listings[0], id: "match", yearBuilt: 2020, walkability: { score: 60 } },
      { ...listings[0], id: "too-walkable", yearBuilt: 2020, walkability: { score: 80 } },
      { ...listings[0], id: "wrong-year", yearBuilt: 2018, walkability: { score: 60 } },
    ];
    const result = parseNaturalLanguageSearch("built in 2020 with walk score under 70", homes);

    expect(result.filters).toMatchObject({ yearBuiltFrom: 2020, yearBuiltTo: 2020, maxWalkScore: 70 });
    expect(filterProperties(homes, result.filters).map(({ id }) => id)).toEqual(["match"]);
  });

  it("does not treat a driving time as a transit time", () => {
    const homes: Property[] = [
      { ...listings[0], id: "transit", commuteOptions: [{ destinationName: "Auckland CBD", mode: "transit", timeMinutes: 25 }] },
      { ...listings[0], id: "driving", commuteOptions: [{ destinationName: "Auckland CBD", mode: "driving", timeMinutes: 20 }] },
    ];
    const result = parseNaturalLanguageSearch("within 30 minutes to Auckland CBD by transit", homes);

    expect(filterProperties(homes, result.filters).map(({ id }) => id)).toEqual(["transit"]);
  });

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

  it("parses specific and generic mapped-flood search requests", () => {
    expect(
      parseNaturalLanguageSearch("properties in flood plains", listings).filters
        .floodHazardTypes,
    ).toEqual(["flood_plains"]);
    expect(
      parseNaturalLanguageSearch("properties with flood risk", listings).filters
        .floodHazardTypes,
    ).toEqual([
      "flood_plains",
      "flood_prone_areas",
      "overland_flow_paths",
      "coastal_inundation",
    ]);
    expect(
      parseNaturalLanguageSearch("properties with no mapped flood hazard", listings).filters,
    ).toEqual({ noMappedFloodHazard: true });
  });

  it("does not turn a low flood risk request into a mapped hazard intersection", () => {
    const result = parseNaturalLanguageSearch("low flood risk", listings);
    expect(result.status).toBe("needs-clarification");
    expect(result.filters).toEqual({});
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
  it("filters by type, style, mapped flood hazard, age and north-facing orientation", () => {
    const result = filterProperties(listings, {
      propertyTypes: ["Townhouse"],
      architecturalStyles: ["Modernist"],
      floodHazardTypes: ["flood_plains"],
      yearBuiltFrom: 2010,
      yearBuiltTo: 2025,
      northFacingOnly: true,
    });

    expect(result.map(({ id }) => id)).toEqual(["modern-townhouse"]);
  });

  it("restores every listing when filters are empty", () => {
    expect(filterProperties(listings, {})).toHaveLength(3);
  });

  it("does not match listings with unknown optional demo metadata", () => {
    const listingWithUnknownMetadata: Property = {
      ...listings[0],
      architecturalStyle: undefined,
      floodRisk: undefined,
      floodHazards: undefined,
      orientation: undefined,
      sunlightHours: undefined,
    };

    expect(
      filterProperties([listingWithUnknownMetadata], {
        architecturalStyles: ["Modernist"],
        floodHazardTypes: ["flood_plains"],
        northFacingOnly: true,
      }),
    ).toEqual([]);
  });

  it("distinguishes no mapped hazards from flood data that has not been synced", () => {
    expect(
      filterProperties(listings, { noMappedFloodHazard: true }).map(({ id }) => id),
    ).toEqual(["wellington-townhouse"]);
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

describe("historical market valuation", () => {
  it("shows only supplied sale and valuation records", () => {
    const history = generateValuationHistory(listings[0]);
    expect(history).toEqual({ pastSales: [], valuationHistory: [] });
  });
});

describe("saved property notifications", () => {
  it("does not invent open homes or price changes for snapshot homes", () => {
    expect(generateSampleNotifications([listings[0]])).toEqual([]);
  });
});
