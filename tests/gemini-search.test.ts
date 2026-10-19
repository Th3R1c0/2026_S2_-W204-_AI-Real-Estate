import { describe, expect, it } from "vitest";

import { interpretPropertyQuery } from "../lib/gemini-search";
import type { Property } from "../lib/property-types";

const properties: Property[] = [
  {
    id: "one",
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
];

describe("Gemini search interpretation", () => {
  it("uses the local interpreter when GEMINI_API_KEY is unavailable", async () => {
    const result = await interpretPropertyQuery(
      "Find character villas in Auckland",
      properties,
      { apiKey: "" },
    );

    expect(result.source).toBe("local");
    expect(result.filters).toEqual({
      architecturalStyles: ["Character"],
      propertyTypes: ["Villa"],
      location: "Auckland",
    });
  });

  it("uses Gemini 3.5 Flash-Lite structured output without exposing the key", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      expect(String(input)).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      );
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("test-secret");
      expect(String(init?.body)).not.toContain("test-secret");

      const requestBody = JSON.parse(String(init?.body)) as {
        generationConfig: {
          temperature?: number;
          responseSchema: {
            additionalProperties?: boolean;
            properties: Record<string, { nullable?: boolean; type: string }>;
          };
          thinkingConfig: { thinkingLevel?: string };
        };
      };
      expect(requestBody.generationConfig).not.toHaveProperty("temperature");
      expect(requestBody.generationConfig.thinkingConfig).toEqual({
        thinkingLevel: "MINIMAL",
      });
      const schema = requestBody.generationConfig.responseSchema;
      expect(schema).not.toHaveProperty("additionalProperties");
      expect(schema.properties.location).toMatchObject({
        type: "string",
        nullable: true,
      });
      expect(schema.properties.maxPrice).toMatchObject({
        type: "number",
        nullable: true,
      });

      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    propertyTypes: ["Townhouse"],
                    architecturalStyles: ["Modernist"],
                    floodRisks: [],
                    location: "Auckland",
                    maxPrice: 900000,
                    minPrice: null,
                    bedrooms: 3,
                    yearBuiltFrom: null,
                    yearBuiltTo: null,
                    northFacingOnly: false,
                    needsClarification: false,
                    message: "I applied five details from your search.",
                  }),
                },
              ],
            },
          },
        ],
      });
    };

    const result = await interpretPropertyQuery(
      "Modern three-bedroom townhouses in Auckland under $900k",
      properties,
      { apiKey: "test-secret", fetchImpl: fakeFetch },
    );

    expect(result).toEqual({
      status: "ready",
      filters: {
        propertyTypes: ["Townhouse"],
        architecturalStyles: ["Modernist"],
        location: "Auckland",
        maxPrice: 900000,
        bedrooms: 3,
      },
      message: "I applied five details from your search.",
      source: "gemini",
    });
  });

  it("falls back locally when the Gemini request fails", async () => {
    const result = await interpretPropertyQuery("character villas", properties, {
      apiKey: "test-secret",
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    });

    expect(result.source).toBe("local");
    expect(result.filters).toEqual({
      architecturalStyles: ["Character"],
      propertyTypes: ["Villa"],
    });
  });
});
