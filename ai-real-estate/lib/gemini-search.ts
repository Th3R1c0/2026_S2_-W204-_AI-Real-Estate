import type { Property, PropertyFilters } from "./property-types";
import { parseNaturalLanguageSearch } from "./property-engine";

export type InterpretedSearch = {
  status: "ready" | "needs-clarification";
  filters: PropertyFilters;
  message: string;
  source: "gemini" | "local";
};

type GeminiFilters = {
  propertyTypes?: string[];
  architecturalStyles?: string[];
  floodRisks?: string[];
  location?: string | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  bedrooms?: number | null;
  yearBuiltFrom?: number | null;
  yearBuiltTo?: number | null;
  northFacingOnly?: boolean;
  needsClarification?: boolean;
  message?: string;
};

const endpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

const responseSchema = {
  type: "object",
  properties: {
    propertyTypes: {
      type: "array",
      items: {
        type: "string",
        enum: ["Apartment", "House", "Lifestyle block", "Section", "Townhouse", "Villa"],
      },
    },
    architecturalStyles: {
      type: "array",
      items: {
        type: "string",
        enum: ["Character", "Contemporary", "Craftsman", "Mid-Century", "Modernist"],
      },
    },
    floodRisks: {
      type: "array",
      items: { type: "string", enum: ["Low", "Moderate", "High"] },
    },
    location: { type: "string", nullable: true },
    maxPrice: { type: "number", nullable: true },
    minPrice: { type: "number", nullable: true },
    bedrooms: { type: "integer", nullable: true },
    yearBuiltFrom: { type: "integer", nullable: true },
    yearBuiltTo: { type: "integer", nullable: true },
    northFacingOnly: { type: "boolean" },
    needsClarification: { type: "boolean" },
    message: { type: "string" },
  },
  required: [
    "propertyTypes",
    "architecturalStyles",
    "floodRisks",
    "location",
    "maxPrice",
    "minPrice",
    "bedrooms",
    "yearBuiltFrom",
    "yearBuiltTo",
    "northFacingOnly",
    "needsClarification",
    "message",
  ],
};

function localResult(query: string, properties: Property[]): InterpretedSearch {
  const result = parseNaturalLanguageSearch(query, properties);
  return { ...result, source: "local" };
}

function cleanGeminiFilters(result: GeminiFilters): PropertyFilters {
  const filters: PropertyFilters = {};

  if (result.propertyTypes?.length) {
    filters.propertyTypes = result.propertyTypes as PropertyFilters["propertyTypes"];
  }
  if (result.architecturalStyles?.length) {
    filters.architecturalStyles =
      result.architecturalStyles as PropertyFilters["architecturalStyles"];
  }
  if (result.floodRisks?.length) {
    filters.floodRisks = result.floodRisks as PropertyFilters["floodRisks"];
  }
  if (result.location) filters.location = result.location;
  if (result.maxPrice !== null && result.maxPrice !== undefined) {
    filters.maxPrice = result.maxPrice;
  }
  if (result.minPrice !== null && result.minPrice !== undefined) {
    filters.minPrice = result.minPrice;
  }
  if (result.bedrooms !== null && result.bedrooms !== undefined) {
    filters.bedrooms = result.bedrooms;
  }
  if (result.yearBuiltFrom !== null && result.yearBuiltFrom !== undefined) {
    filters.yearBuiltFrom = result.yearBuiltFrom;
  }
  if (result.yearBuiltTo !== null && result.yearBuiltTo !== undefined) {
    filters.yearBuiltTo = result.yearBuiltTo;
  }
  if (result.northFacingOnly) filters.northFacingOnly = true;

  return filters;
}

export async function interpretPropertyQuery(
  query: string,
  properties: Property[],
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<InterpretedSearch> {
  if (!options.apiKey) {
    console.log("[AI Search] No GEMINI_API_KEY provided; falling back to local interpreter.");
    return localResult(query, properties);
  }

  const locations = Array.from(
    new Set(properties.flatMap(({ suburb, city, region }) => [suburb, city, region])),
  );

  try {
    const requestPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Interpret this New Zealand property search into filters.",
                "Only include requirements the buyer explicitly stated or clearly implied.",
                "Treat villa as a property type; character villa means Character style plus Villa type.",
                `Known listing locations: ${locations.join(", ")}.`,
                `Buyer request: ${query}`,
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    };

    console.log("[AI Search] Request sent to Gemini:", JSON.stringify({ endpoint, payload: requestPayload }, null, 2));

    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      console.error(`[AI Search] Gemini returned error status: ${response.status}`);
      throw new Error(`Gemini returned ${response.status}`);
    }
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    console.log("[AI Search] Response received from Gemini:", JSON.stringify(body, null, 2));
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[AI Search] Gemini returned an empty response");
      throw new Error("Gemini returned an empty response");
    }
    const result = JSON.parse(text) as GeminiFilters;
    console.log("[AI Search] Parsed filter result from Gemini:", JSON.stringify(result, null, 2));

    return {
      status: result.needsClarification ? "needs-clarification" : "ready",
      filters: cleanGeminiFilters(result),
      message:
        result.message ||
        (result.needsClarification
          ? "Try adding a location, property type, style or budget."
          : "I applied the details from your search."),
      source: "gemini",
    };
  } catch (error) {
    console.error("[AI Search] Gemini request failed, using local fallback:", error);
    return localResult(query, properties);
  }
}
