import { describe, expect, it } from "vitest";
import {
  cleanJevFilters,
  buildJevQuestions,
  interpretPropertyQuery,
  interpretPropertyQueryWithJev,
  parseBedroomsFromQuery,
  parsePriceFromQuery,
} from "../lib/jev-search";
import type { Property } from "../lib/property-types";
import { numericCandidates } from "../lib/jev-filter-plan";

const sampleProperties: Property[] = [
  {
    id: "sample-villa",
    address: "54 Kelmarna Avenue",
    suburb: "Ponsonby",
    city: "Auckland",
    region: "Auckland",
    price: 2_525_000,
    bedrooms: 4,
    bathrooms: 2,
    landArea: 531,
    floorArea: 180,
    yearBuilt: 1912,
    propertyType: "Villa",
    architecturalStyle: "Character",
    floodRisk: "Low",
    latitude: -36.849,
    longitude: 174.734,
    image: "/properties/test.jpg",
    imageAlt: "Character villa",
  },
  {
    id: "sample-townhouse",
    address: "10 Wanaka Place",
    suburb: "Pakuranga Heights",
    city: "Manukau City",
    region: "Auckland",
    price: 890_000,
    bedrooms: 3,
    bathrooms: 2,
    landArea: 250,
    floorArea: 125,
    yearBuilt: 2022,
    propertyType: "Townhouse",
    architecturalStyle: "Contemporary",
    floodRisk: "Low",
    latitude: -36.905,
    longitude: 174.901,
    image: "/properties/test2.jpg",
    imageAlt: "Contemporary townhouse",
  },
];

describe("TypeSafe Jev search interpreter", () => {
  it("offers complete compact money values and does not treat square metres as millions", () => {
    expect(
      numericCandidates("under $1.5m or $850k with 200 m² land").map(
        (c) => c.value,
      ),
    ).toEqual([1_500_000, 850_000, 200]);
    expect(numericCandidates("under $1.2m.").map((c) => c.value)).toEqual([
      1_200_000,
    ]);
  });
  it("requires an explicit flood exclusion and consolidates repeated numeric values", () => {
    expect(
      cleanJevFilters("house", {
        flood_hazard: { choice: "no_mapped" },
        no_mapped_hazard: { choice: "none" },
      }).filters.noMappedFloodHazard,
    ).toBeUndefined();
    expect(
      numericCandidates("1 bathroom and 1 parking space").map((c) => c.value),
    ).toEqual([1]);
  });
  it("keeps exact counts and inclusive commute limits when semantics bleed across clauses", () => {
    const result = cleanJevFilters(
      "capital value at least $1m, 3 bedrooms and within 30 minutes commute",
      {
        number_bedrooms_min: { choice: "inclusive_1", confidence: 0.99 },
        number_bedrooms_max: { choice: "none", confidence: 0.99 },
        number_commuteTime_max: { choice: "inclusive_2", confidence: 0.54 },
      },
    );
    expect(result.filters.bedrooms).toBe(3);
    expect(result.filters.maxCommuteTimeMinutes).toBe(30);
    expect(result.issues).toEqual([]);
  });

  it("asks for clarification instead of ignoring an unavailable requested location", () => {
    const result = cleanJevFilters("house in an unavailable location", {
      property_type: { choice: "House" },
      location: { choice: "unknown" },
    });
    expect(result.issues.join(" ")).toMatch(/location/i);
  });

  it("asks Jev to select numeric source values and compose independent categories", () => {
    const questions = buildJevQuestions(
      ["Auckland"],
      "enough room for 4 cars and built after 1990",
      sampleProperties,
    );
    expect(questions).toHaveProperty("number_parkingSpaces_min");
    expect(questions).toHaveProperty("number_yearBuilt_min");
    expect(questions).toHaveProperty("type_House");
    expect(questions).toHaveProperty("type_Townhouse");
  });

  it("applies semantic numeric bounds without inventing values or overwriting explicit years with an era", async () => {
    const result = await interpretPropertyQueryWithJev(
      "a contemporary house with enough room for four cars, built after 1990",
      sampleProperties,
      {
        apiKey: "test-key",
        fetchImpl: async () =>
          Response.json({
            answers: {
              property_type: { choice: "House" },
              era_intent: { choice: "contemporary" },
              number_parkingSpaces_min: {
                choice: "inclusive_0",
                confidence: 0.99,
              },
              number_yearBuilt_min: { choice: "exclusive_1", confidence: 0.99 },
            },
          }),
      },
    );
    expect(result.filters.numericCriteria?.parkingSpaces).toEqual({ min: 4 });
    expect(result.filters.yearBuiltFrom).toBe(1991);
    expect(result.message).toContain("4+ parking spaces");
    expect(result.message).toContain("1991");
  });

  it("retains alternatives within property types and applies all other constraints", async () => {
    const result = await interpretPropertyQueryWithJev(
      "house or townhouse with 2 bathrooms",
      sampleProperties,
      {
        apiKey: "test-key",
        fetchImpl: async () =>
          Response.json({
            answers: {
              type_House: { noul: 0.99 },
              type_Townhouse: { noul: 0.99 },
            },
          }),
      },
    );
    expect(result.filters.propertyTypes).toEqual(["Townhouse", "House"]);
    expect(result.filters.numericCriteria?.bathrooms).toEqual({
      min: 2,
      max: 2,
    });
  });

  it("asks for clarification on contradictory numeric bounds", async () => {
    const result = await interpretPropertyQueryWithJev(
      "house with at least 4 bathrooms and no more than 2 bathrooms",
      sampleProperties,
      {
        apiKey: "test-key",
        fetchImpl: async () =>
          Response.json({
            answers: {
              property_type: { choice: "House" },
              number_bathrooms_min: { choice: "inclusive_0", confidence: 0.99 },
              number_bathrooms_max: { choice: "inclusive_1", confidence: 0.99 },
            },
          }),
      },
    );
    expect(result.status).toBe("needs-clarification");
    expect(result.message).toMatch(/bathroom.*minimum.*maximum/i);
  });
  it("keeps the buyer's capacity requirement for four cars", () => {
    const result = cleanJevFilters("a house with enough room for 4 cars", {
      property_type: { choice: "House" },
    });
    expect(result.filters.numericCriteria?.parkingSpaces).toEqual({ min: 4 });
    expect(result.appliedDescriptions).toContain("4+ parking spaces");
  });
  it("extracts price numbers with various units accurately", () => {
    expect(parsePriceFromQuery("under 1.5M")).toEqual({
      amount: 1500000,
      isMax: true,
      isMin: false,
    });
    expect(parsePriceFromQuery("budget $900k")).toEqual({
      amount: 900000,
      isMax: true,
      isMin: false,
    });
    expect(parsePriceFromQuery("up to $750,000")).toEqual({
      amount: 750000,
      isMax: true,
      isMin: false,
    });
    expect(parsePriceFromQuery("over 1.2 million")).toEqual({
      amount: 1200000,
      isMax: false,
      isMin: true,
    });
    expect(parsePriceFromQuery("no price mentioned")).toBeNull();
    expect(parsePriceFromQuery("floor area under 150 m²")).toBeNull();
  });

  it("extracts bedroom numbers from numerals and words", () => {
    expect(parseBedroomsFromQuery("3 bedroom villa")).toBe(3);
    expect(parseBedroomsFromQuery("four beds in Auckland")).toBe(4);
    expect(parseBedroomsFromQuery("modern studio apartment")).toBe(1);
    expect(parseBedroomsFromQuery("2 brm flat")).toBe(2);
    expect(parseBedroomsFromQuery("5+ beds")).toBe(5);
    expect(parseBedroomsFromQuery("villa in Mount Eden")).toBeNull();
  });

  it("falls back to local interpreter when no JEV_API_KEY is provided", async () => {
    const previousJevKey = process.env.JEV_API_KEY;
    const previousTypesafeKey = process.env.TYPESAFE_API_KEY;
    delete process.env.JEV_API_KEY;
    delete process.env.TYPESAFE_API_KEY;

    try {
      const result = await interpretPropertyQueryWithJev(
        "character villas in Auckland",
        sampleProperties,
        { apiKey: "" },
      );

      expect(result.source).toBe("local");
      expect(result.filters).toEqual({
        architecturalStyles: ["Character"],
        propertyTypes: ["Villa"],
        location: "Auckland",
      });
    } finally {
      if (previousJevKey) process.env.JEV_API_KEY = previousJevKey;
      if (previousTypesafeKey)
        process.env.TYPESAFE_API_KEY = previousTypesafeKey;
    }
  });

  it("evaluates query against full property schema using TypeSafe Jev System One questions", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://api.typesafe.ai/v1/systemone");
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer test-jev-secret",
      );
      expect(new Headers(init?.headers).get("Content-Type")).toBe(
        "application/json",
      );

      const body = JSON.parse(String(init?.body)) as {
        model: string;
        state: {
          user_query: string;
          catalog: {
            available_property_types: Array<{ type: string }>;
            available_architectural_styles: Array<{ style: string }>;
            available_flood_hazards: Array<{ type: string }>;
            known_locations: string[];
            property_fields: Record<string, string>;
          };
        };
        questions: Record<string, { type: string; instructions: string }>;
      };

      // Verify request structure sent to Jev
      expect(body.model).toBe("jev-latest");
      expect(body.state.user_query).toBe(
        "3-bedroom character villa in Ponsonby under 2.6M",
      );
      expect(body.state.catalog.known_locations).toContain("Ponsonby");
      expect(body.state.catalog.known_locations).toContain("Auckland");
      expect(body.state.catalog.property_fields).toHaveProperty("price");
      expect(body.state.catalog.property_fields).toHaveProperty("bedrooms");
      expect(body.state.catalog.property_fields).toHaveProperty(
        "parkingSpaces",
      );
      expect(body.state.catalog.available_flood_hazards).toContainEqual(
        expect.objectContaining({ type: "flood_plains" }),
      );

      expect(body.questions).toHaveProperty("property_type");
      expect(body.questions).toHaveProperty("architectural_style");
      expect(body.questions).toHaveProperty("location");
      expect(body.questions).not.toHaveProperty("is_sunny_requested");
      expect(body.questions).not.toHaveProperty("is_north_facing_requested");
      expect(body.questions).toHaveProperty("price_intent");
      expect(body.questions).toHaveProperty("flood_hazard");

      return Response.json({
        model: "jev-1.13.0",
        answers: {
          property_type: {
            type: "choice",
            choice: "Villa",
            confidence: 0.99,
            probabilities: { Villa: 0.99, House: 0.01 },
          },
          architectural_style: {
            type: "choice",
            choice: "Character",
            confidence: 0.98,
            probabilities: { Character: 0.98, Modernist: 0.02 },
          },
          flood_risk: {
            type: "choice",
            choice: "none",
            confidence: 1,
            probabilities: { none: 1 },
          },
          location: {
            type: "choice",
            choice: "Ponsonby",
            confidence: 0.97,
            probabilities: { Ponsonby: 0.97 },
          },
          is_walkable_requested: {
            type: "noul",
            noul: 0.1,
          },
          is_school_zone_requested: {
            type: "noul",
            noul: 0.05,
          },
          price_intent: {
            type: "choice",
            choice: "max_budget",
            confidence: 0.99,
            probabilities: { max_budget: 0.99 },
          },
          era_intent: {
            type: "choice",
            choice: "character_heritage",
            confidence: 0.95,
            probabilities: { character_heritage: 0.95 },
          },
          needs_clarification: {
            type: "noul",
            noul: 0.02,
          },
        },
      });
    };

    const result = await interpretPropertyQueryWithJev(
      "3-bedroom character villa in Ponsonby under 2.6M",
      sampleProperties,
      { apiKey: "test-jev-secret", fetchImpl: fakeFetch },
    );

    expect(result.source).toBe("jev");
    expect(result.status).toBe("ready");
    expect(result.filters).toMatchObject({
      propertyTypes: ["Villa"],
      architecturalStyles: ["Character"],
      location: "Ponsonby",
      bedrooms: 3,
      maxPrice: 2600000,
      yearBuiltTo: 1940,
    });
    expect(result.message).toContain("villa");
  });

  it("turns Jev flood answers into mapped hazard filters", () => {
    expect(
      cleanJevFilters("homes in flood plains", {
        flood_hazard: { choice: "flood_plains" },
      }).filters,
    ).toEqual({ floodHazardTypes: ["flood_plains"] });
    expect(
      cleanJevFilters("homes with no mapped flood hazard", {
        flood_hazard: { choice: "no_mapped" },
      }).filters,
    ).toEqual({ noMappedFloodHazard: true });
  });

  it("preserves explicit property details alongside Jev judgments", () => {
    const result = cleanJevFilters(
      "houses over $500k with one bathroom and at least 2 parking spaces",
      {
        property_type: { choice: "House" },
        price_intent: { choice: "min_budget" },
      },
    );

    expect(result.filters).toMatchObject({
      propertyTypes: ["House"],
      minPrice: 500_000,
      numericCriteria: {
        bathrooms: { min: 1, max: 1 },
        parkingSpaces: { min: 2 },
      },
    });
    expect(result.appliedDescriptions).toContain("1 bathroom");
    expect(result.appliedDescriptions).toContain("2+ parking spaces");
  });

  it("handles queries needing clarification", async () => {
    const fakeFetch: typeof fetch = async () => {
      return Response.json({
        model: "jev-1.13.0",
        answers: {
          property_type: { type: "choice", choice: "none", confidence: 1 },
          architectural_style: {
            type: "choice",
            choice: "none",
            confidence: 1,
          },
          flood_risk: { type: "choice", choice: "none", confidence: 1 },
          location: { type: "choice", choice: "none", confidence: 1 },
          is_sunny_or_north_facing: { type: "noul", noul: 0.01 },
          is_walkable_requested: { type: "noul", noul: 0.01 },
          is_school_zone_requested: { type: "noul", noul: 0.01 },
          price_intent: { type: "choice", choice: "none", confidence: 1 },
          era_intent: { type: "choice", choice: "none", confidence: 1 },
          needs_clarification: { type: "noul", noul: 0.98 },
        },
      });
    };

    const result = await interpretPropertyQueryWithJev(
      "hello something random",
      sampleProperties,
      { apiKey: "test-jev-secret", fetchImpl: fakeFetch },
    );

    expect(result.status).toBe("needs-clarification");
    expect(result.message).toContain("Try adding a location, property type");
  });

  it("asks for clarification when Jev finds no searchable fields", async () => {
    const result = await interpretPropertyQueryWithJev(
      "sea view",
      sampleProperties,
      {
        apiKey: "test-jev-secret",
        fetchImpl: async () =>
          Response.json({
            answers: {
              property_type: { choice: "none" },
              architectural_style: { choice: "none" },
              flood_hazard: { choice: "none" },
              location: { choice: "none" },
              price_intent: { choice: "none" },
              era_intent: { choice: "none" },
              needs_clarification: { noul: 0.01 },
            },
          }),
      },
    );

    expect(result.status).toBe("needs-clarification");
    expect(result.filters).toEqual({});
  });

  it("falls back locally when Jev API returns an error", async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response("Overloaded", { status: 529 });
    };

    const result = await interpretPropertyQueryWithJev(
      "character villas in Auckland",
      sampleProperties,
      { apiKey: "test-jev-secret", fetchImpl: fakeFetch },
    );

    expect(result.source).toBe("local");
    expect(result.filters.propertyTypes).toEqual(["Villa"]);
  });

  it("unified interpretPropertyQuery prefers Jev when available", async () => {
    const fakeFetch: typeof fetch = async () => {
      return Response.json({
        model: "jev-1.13.0",
        answers: {
          property_type: {
            type: "choice",
            choice: "Townhouse",
            confidence: 0.95,
          },
          architectural_style: {
            type: "choice",
            choice: "none",
            confidence: 1,
          },
          flood_risk: { type: "choice", choice: "none", confidence: 1 },
          location: { type: "choice", choice: "none", confidence: 1 },
          is_sunny_or_north_facing: { type: "noul", noul: 0.02 },
          is_walkable_requested: { type: "noul", noul: 0.02 },
          is_school_zone_requested: { type: "noul", noul: 0.02 },
          price_intent: { type: "choice", choice: "none", confidence: 1 },
          era_intent: { type: "choice", choice: "none", confidence: 1 },
          needs_clarification: { type: "noul", noul: 0.05 },
        },
      });
    };

    const result = await interpretPropertyQuery(
      "townhouses",
      sampleProperties,
      { jevApiKey: "test-jev-key", fetchImpl: fakeFetch },
    );

    expect(result.source).toBe("jev");
    expect(result.filters.propertyTypes).toEqual(["Townhouse"]);
  });
});
