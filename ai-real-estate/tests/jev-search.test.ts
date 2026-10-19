import { describe, expect, it } from "vitest";
import {
  interpretPropertyQuery,
  interpretPropertyQueryWithJev,
  parseBedroomsFromQuery,
  parsePriceFromQuery,
} from "../lib/jev-search";
import type { Property } from "../lib/property-types";

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
    orientation: "North",
    sunlightHours: 7.5,
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
    orientation: "North",
    sunlightHours: 7.2,
    latitude: -36.905,
    longitude: 174.901,
    image: "/properties/test2.jpg",
    imageAlt: "Contemporary townhouse",
  },
];

describe("TypeSafe Jev search interpreter", () => {
  it("extracts price numbers with various units accurately", () => {
    expect(parsePriceFromQuery("under 1.5M")).toEqual({ amount: 1500000, isMax: true, isMin: false });
    expect(parsePriceFromQuery("budget $900k")).toEqual({ amount: 900000, isMax: true, isMin: false });
    expect(parsePriceFromQuery("up to $750,000")).toEqual({ amount: 750000, isMax: true, isMin: false });
    expect(parsePriceFromQuery("over 1.2 million")).toEqual({ amount: 1200000, isMax: false, isMin: true });
    expect(parsePriceFromQuery("no price mentioned")).toBeNull();
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
      if (previousTypesafeKey) process.env.TYPESAFE_API_KEY = previousTypesafeKey;
    }
  });

  it("evaluates query against full property schema using TypeSafe Jev System One questions", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://api.typesafe.ai/v1/systemone");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-jev-secret");
      expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");

      const body = JSON.parse(String(init?.body)) as {
        model: string;
        state: {
          user_query: string;
          catalog: {
            available_property_types: Array<{ type: string }>;
            available_architectural_styles: Array<{ style: string }>;
            available_flood_risks: Array<{ risk: string }>;
            known_locations: string[];
            property_fields: Record<string, string>;
          };
        };
        questions: Record<string, { type: string; instructions: string }>;
      };

      // Verify request structure sent to Jev
      expect(body.model).toBe("jev-latest");
      expect(body.state.user_query).toBe("sunny 3-bedroom character villa in Ponsonby under 2.6M");
      expect(body.state.catalog.known_locations).toContain("Ponsonby");
      expect(body.state.catalog.known_locations).toContain("Auckland");
      expect(body.state.catalog.property_fields).toHaveProperty("price");
      expect(body.state.catalog.property_fields).toHaveProperty("bedrooms");
      expect(body.state.catalog.property_fields).toHaveProperty("orientation");

      expect(body.questions).toHaveProperty("property_type");
      expect(body.questions).toHaveProperty("architectural_style");
      expect(body.questions).toHaveProperty("location");
      expect(body.questions).toHaveProperty("is_sunny_or_north_facing");
      expect(body.questions).toHaveProperty("price_intent");

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
          is_sunny_or_north_facing: {
            type: "noul",
            noul: 0.94,
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
      "sunny 3-bedroom character villa in Ponsonby under 2.6M",
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
      northFacingOnly: true,
      yearBuiltTo: 1940,
    });
    expect(result.message).toContain("villa");
  });

  it("handles queries needing clarification", async () => {
    const fakeFetch: typeof fetch = async () => {
      return Response.json({
        model: "jev-1.13.0",
        answers: {
          property_type: { type: "choice", choice: "none", confidence: 1 },
          architectural_style: { type: "choice", choice: "none", confidence: 1 },
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
          property_type: { type: "choice", choice: "Townhouse", confidence: 0.95 },
          architectural_style: { type: "choice", choice: "none", confidence: 1 },
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
