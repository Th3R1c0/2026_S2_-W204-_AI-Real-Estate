import { TypeSafeClient } from "@typesafe-ai/sdk";
import type {
  FloodHazardType,
  Property,
  PropertyFilters,
  PropertyType,
} from "./property-types";
import { parseNaturalLanguageSearch } from "./property-engine";
import {
  matchCatalogDetails,
  parseExplicitPropertyFilters,
  parsePriceFilters,
} from "./property-query";
import { interpretPropertyQuery as interpretWithGemini } from "./gemini-search";
import {
  applyFilterPlan,
  buildFilterPlanQuestions,
  describeFilters,
  numericCandidates,
  type JevAnswer,
} from "./jev-filter-plan";

export type InterpretedSearch = {
  status: "ready" | "needs-clarification";
  filters: PropertyFilters;
  message: string;
  source: "jev" | "gemini" | "local";
};

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_DEFAULT_MODEL = "jev-latest";

const wordNumbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

export function parsePriceFromQuery(
  query: string,
): { amount: number; isMax: boolean; isMin: boolean } | null {
  const { minPrice, maxPrice } = parsePriceFilters(query);
  if (maxPrice !== undefined)
    return { amount: maxPrice, isMax: true, isMin: false };
  if (minPrice !== undefined)
    return { amount: minPrice, isMax: false, isMin: true };
  return null;
}

export function parseBedroomsFromQuery(query: string): number | null {
  if (/\b(studio)\b/i.test(query)) return 1;
  const match =
    query.match(
      /\b(one|two|three|four|five|six|seven|eight|\d+)\s*[-_\s]?(?:bed(?:room)?s?|brm)\b/i,
    ) || query.match(/\b(\d+)\s*\+\s*beds?\b/i);
  if (!match) return null;
  const val = match[1].toLowerCase();
  return wordNumbers[val] ?? Number(val);
}

export function buildCatalogState(properties: Property[]) {
  const locations = Array.from(
    new Set(
      properties.flatMap(({ suburb, city, region }) =>
        [suburb, city, region].filter(Boolean),
      ),
    ),
  ).sort();

  const prices = properties.map((p) => p.price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : 400000;
  const maxPrice = prices.length ? Math.max(...prices) : 3500000;

  return {
    locations,
    state: {
      catalog: {
        total_properties: properties.length,
        price_range: { min_price: minPrice, max_price: maxPrice },
        available_property_types: [
          {
            type: "Villa",
            description:
              "Historic or character villa with high ceilings and heritage details",
          },
          {
            type: "Townhouse",
            description: "Modern multi-level attached home",
          },
          {
            type: "Apartment",
            description: "Single-level unit or apartment in a complex",
          },
          { type: "House", description: "Standalone residential home" },
          {
            type: "Lifestyle block",
            description: "Rural acreage or lifestyle property",
          },
          {
            type: "Section",
            description: "Vacant land parcel or building site",
          },
        ],
        available_flood_hazards: [
          {
            type: "flood_plains",
            description: "Auckland Council mapped flood plains",
          },
          {
            type: "flood_prone_areas",
            description: "Auckland Council mapped flood-prone areas",
          },
          {
            type: "overland_flow_paths",
            description: "Auckland Council mapped overland flow paths",
          },
          {
            type: "coastal_inundation",
            description: "Auckland Council mapped coastal inundation",
          },
        ],
        known_locations: locations,
        property_fields: {
          address: "Physical street address and locality",
          suburb: "Suburb name in New Zealand",
          city: "City or territorial authority (e.g. Auckland)",
          region: "Broader regional council area",
          price: "Indicative or asking price in NZD",
          bedrooms: "Number of bedrooms (1 to 8)",
          bathrooms: "Number of bathrooms",
          parkingSpaces: "Garages or dedicated parking spaces",
          landArea: "Land size in square meters",
          floorArea: "Internal floor size in square meters",
          yearBuilt: "Year or decade of construction",
          schoolZones: "School catchments with in-zone enrolment entitlements",
          floodHazards:
            "Auckland Council mapped hazard intersections, if data has been synced",
        },
      },
    },
  };
}

export function buildJevQuestions(
  locations: string[],
  query = "",
  properties: Property[] = [],
): ReturnType<typeof buildFilterPlanQuestions> {
  const locationCriteria: Record<string, string> = {
    none: "No specific location mentioned in query, or any location is acceptable",
    unknown:
      "The buyer requests a property location that is not in the available locations",
  };
  for (const loc of locations) {
    locationCriteria[loc] = `Property location in ${loc}, New Zealand`;
  }

  return {
    property_type: {
      type: "choice" as const,
      instructions:
        "What property type is the buyer requesting in `user_query`?",
      criteria: {
        Villa: "Villa or character villa",
        Townhouse: "Townhouse or terraced home",
        Apartment: "Apartment, flat, or unit",
        House: "Standalone house or family home",
        "Lifestyle block": "Lifestyle block, rural acreage, or farmlet",
        Section: "Bare land or building section",
        none: "No specific property type requested; any type is fine",
      },
    },
    flood_hazard: {
      type: "choice" as const,
      instructions:
        "Which mapped Auckland Council flood hazard does `user_query` request? Do not infer a low, moderate or high risk rating from mapped layers.",
      criteria: {
        flood_plains: "Homes intersecting mapped flood plains",
        flood_prone_areas: "Homes intersecting mapped flood-prone areas",
        overland_flow_paths: "Homes intersecting mapped overland flow paths",
        coastal_inundation: "Homes intersecting mapped coastal inundation",
        any_mapped: "Homes with any mapped flood hazard intersection",
        no_mapped:
          "Homes with no mapped flood hazard intersection; do not treat this as flood-free or safe",
        none: "No specific mapped hazard requirement, or only an unsupported risk rating",
      },
    },
    location: {
      type: "choice" as const,
      instructions:
        "Which known location from `catalog.known_locations` does `user_query` require the PROPERTY to be in? Select none if a place name appears only within a school name.",
      criteria: locationCriteria,
    },
    is_school_zone_requested: {
      type: "noul" as const,
      instructions:
        "Does `user_query` request properties in a good school zone or grammar zone?",
    },
    price_intent: {
      type: "choice" as const,
      instructions: "How is price or budget mentioned in `user_query`?",
      criteria: {
        max_budget:
          "Upper limit, budget, under, below, max, up to, or cheaper than",
        min_budget: "Lower limit, over, above, at least, minimum",
        exact: "Specific target price",
        none: "No price or budget mentioned",
      },
    },
    era_intent: {
      type: "choice" as const,
      instructions:
        "Does `user_query` explicitly specify a construction era or property age? Explicit numeric construction years are handled separately.",
      criteria: {
        character_heritage:
          "Pre-1940s, historic, character, colonial, or villa era",
        mid_century: "1940s to 1960s mid-century era",
        modernist: "1960s to 1990s modernist era",
        contemporary: "2000s onwards new build or modern era",
        none: "No specific construction era mentioned",
      },
    },
    needs_clarification: {
      type: "noul" as const,
      instructions:
        "Is `user_query` completely vague, meaningless, or devoid of any property search intent?",
    },
    ...buildFilterPlanQuestions(query, properties),
  };
}

export function cleanJevFilters(
  query: string,
  answers: Record<string, JevAnswer>,
  properties: Property[] = [],
): {
  filters: PropertyFilters;
  appliedDescriptions: string[];
  issues: string[];
} {
  const filters: PropertyFilters = parseExplicitPropertyFilters(query);

  // Property type
  const pType = answers.property_type?.choice;
  if (pType && pType !== "none") {
    filters.propertyTypes = [pType as PropertyType];
  }

  // Mapped flood hazards
  const flood = answers.flood_hazard?.choice;
  const hazardTypes: FloodHazardType[] = [
    "flood_plains",
    "flood_prone_areas",
    "overland_flow_paths",
    "coastal_inundation",
  ];
  if (flood === "no_mapped") {
    filters.noMappedFloodHazard = true;
  } else if (flood === "any_mapped") {
    filters.floodHazardTypes = hazardTypes;
  } else if (hazardTypes.includes(flood as FloodHazardType)) {
    filters.floodHazardTypes = [flood as FloodHazardType];
  }

  // Location
  const loc = answers.location?.choice;
  if (loc && loc !== "none") {
    const qLower = query.toLowerCase();
    const locLower = loc.toLowerCase();
    if (
      qLower.includes(locLower) ||
      locLower
        .split(/\s+/)
        .some((part) => part.length >= 4 && qLower.includes(part))
    ) {
      filters.location = loc;
    }
  }

  // School zone
  const schoolProb = answers.is_school_zone_requested?.noul ?? 0;
  const mentionsSchool =
    /\b(school\s*zone|grammar\s*zone|in\s*zone|schools?)\b/i.test(query);
  if (schoolProb >= 0.55 || mentionsSchool) {
    filters.inZoneOnly = true;
  }

  // Bedrooms
  const beds = parseBedroomsFromQuery(query);
  if (beds !== null && !filters.numericCriteria?.bedrooms) {
    filters.bedrooms = beds;
  }

  // Era / Year Built
  const era =
    filters.yearBuiltFrom === undefined && filters.yearBuiltTo === undefined
      ? answers.era_intent?.choice
      : undefined;
  if (era === "character_heritage") {
    filters.yearBuiltTo = 1940;
  } else if (era === "mid_century") {
    filters.yearBuiltFrom = 1940;
    filters.yearBuiltTo = 1965;
  } else if (era === "modernist") {
    filters.yearBuiltFrom = 1965;
    filters.yearBuiltTo = 1999;
  } else if (era === "contemporary") {
    filters.yearBuiltFrom = 2000;
  }

  const issues = applyFilterPlan(query, filters, answers, properties);
  return { filters, appliedDescriptions: describeFilters(filters), issues };
}

function formatSearchMessage(applied: string[]): string {
  if (applied.length === 0) {
    return "I applied the details from your search.";
  }
  return `Showing properties matching ${applied.join(", ")}.`;
}

function localResult(query: string, properties: Property[]): InterpretedSearch {
  const result = parseNaturalLanguageSearch(query, properties);
  return { ...result, source: "local" };
}

export async function interpretPropertyQueryWithJev(
  query: string,
  properties: Property[],
  options: {
    apiKey?: string;
    fetchImpl?: typeof fetch;
    model?: string;
  } = {},
): Promise<InterpretedSearch> {
  const apiKey =
    options.apiKey || process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY;

  if (!apiKey) {
    console.log(
      "[AI Search] No JEV_API_KEY provided; falling back to local interpreter.",
    );
    return localResult(query, properties);
  }

  const { locations, state: catalogState } = buildCatalogState(properties);
  const questions = buildJevQuestions(locations, query, properties);

  const requestPayload = {
    model: options.model || JEV_DEFAULT_MODEL,
    state: {
      user_query: query,
      numeric_candidates: numericCandidates(query),
      ...catalogState,
    },
    questions,
  };

  try {
    console.log(`[AI Search] Calling TypeSafe Jev for query: "${query}"`);

    let responseData: {
      answers: Record<string, JevAnswer>;
    };

    if (options.fetchImpl) {
      // Use custom fetch implementation (useful for tests and mocks)
      const res = await options.fetchImpl(JEV_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        throw new Error(`TypeSafe API error: HTTP ${res.status}`);
      }
      responseData = (await res.json()) as typeof responseData;
    } else {
      // Use TypeSafeClient from @typesafe-ai/sdk
      const client = new TypeSafeClient({ apiKey });
      responseData = await client.systemOne(requestPayload);
    }

    const { filters, issues } = cleanJevFilters(
      query,
      responseData.answers,
      properties,
    );
    Object.assign(filters, matchCatalogDetails(query, properties));
    const hasFilters = Object.keys(filters).length > 0;
    const isVague = !hasFilters;

    return {
      status: isVague || issues.length ? "needs-clarification" : "ready",
      filters,
      message: issues.length
        ? issues.join(" ")
        : isVague
          ? "Try adding a location, property type, flood risk, bedroom count or budget."
          : formatSearchMessage(describeFilters(filters)),
      source: "jev",
    };
  } catch (error) {
    console.error("[AI Search] TypeSafe Jev evaluation failed:", error);
    return localResult(query, properties);
  }
}

export async function interpretPropertyQuery(
  query: string,
  properties: Property[],
  options: {
    apiKey?: string;
    jevApiKey?: string;
    geminiApiKey?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<InterpretedSearch> {
  const jevKey =
    options.jevApiKey ||
    options.apiKey ||
    process.env.JEV_API_KEY ||
    process.env.TYPESAFE_API_KEY;

  if (jevKey) {
    const jevResult = await interpretPropertyQueryWithJev(query, properties, {
      apiKey: jevKey,
      fetchImpl: options.fetchImpl,
    });
    if (jevResult.source === "jev") {
      return jevResult;
    }
  }

  const geminiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const geminiResult = await interpretWithGemini(query, properties, {
        apiKey: geminiKey,
        fetchImpl: options.fetchImpl,
      });
      return geminiResult;
    } catch {
      // Fall through to local
    }
  }

  return localResult(query, properties);
}
