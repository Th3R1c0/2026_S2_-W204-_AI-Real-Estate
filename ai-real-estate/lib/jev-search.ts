import { TypeSafeClient } from "@typesafe-ai/sdk";
import type {
  ArchitecturalStyle,
  FloodRisk,
  Property,
  PropertyFilters,
  PropertyType,
} from "./property-types";
import { parseNaturalLanguageSearch } from "./property-engine";
import { interpretPropertyQuery as interpretWithGemini } from "./gemini-search";

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
  // Check range e.g. "between 800k and 1.2m"
  const rangeMatch = query.match(
    /between\s*\$?([\d,.]+)\s*([km]|million|mil)?\s*(?:and|-)\s*\$?([\d,.]+)\s*([km]|million|mil)?/i,
  );
  if (rangeMatch) {
    const parse = (raw: string, unit?: string) => {
      const num = Number(raw.replaceAll(",", ""));
      const u = (unit || "").toLowerCase();
      if (u === "k") return num * 1_000;
      if (u === "m" || u === "million" || u === "mil") return num * 1_000_000;
      return num;
    };
    const maxVal = parse(rangeMatch[3], rangeMatch[4] || rangeMatch[2]);
    return { amount: maxVal, isMax: true, isMin: false };
  }

  // Max price e.g. "under 1.5M", "below 900k", "up to $1,000,000", "max 800k", "budget $1.2M", "cheaper than 1m"
  const maxMatch = query.match(
    /(?:under|below|up to|max(?:imum)?|budget|less than|cheaper than)\s*\$?([\d,.]+)\s*([km]|million|mil)?\b/i,
  );
  if (maxMatch) {
    const num = Number(maxMatch[1].replaceAll(",", ""));
    const unit = (maxMatch[2] || "").toLowerCase();
    const mult =
      unit === "k"
        ? 1_000
        : unit === "m" || unit === "million" || unit === "mil"
          ? 1_000_000
          : 1;
    return { amount: num * mult, isMax: true, isMin: false };
  }

  // Min price e.g. "over 1.5M", "above 900k", "at least $800k", "min 750k"
  const minMatch = query.match(
    /(?:over|above|at least|min(?:imum)?|more than)\s*\$?([\d,.]+)\s*([km]|million|mil)?\b/i,
  );
  if (minMatch) {
    const num = Number(minMatch[1].replaceAll(",", ""));
    const unit = (minMatch[2] || "").toLowerCase();
    const mult =
      unit === "k"
        ? 1_000
        : unit === "m" || unit === "million" || unit === "mil"
          ? 1_000_000
          : 1;
    return { amount: num * mult, isMax: false, isMin: true };
  }

  // Standalone price match e.g. "$1,500,000" or "$900k"
  const genericMatch = query.match(/\$([\d,.]+)\s*([km]|million|mil)?\b/i);
  if (genericMatch) {
    const num = Number(genericMatch[1].replaceAll(",", ""));
    const unit = (genericMatch[2] || "").toLowerCase();
    const mult =
      unit === "k"
        ? 1_000
        : unit === "m" || unit === "million" || unit === "mil"
          ? 1_000_000
          : 1;
    return { amount: num * mult, isMax: true, isMin: false };
  }

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
          { type: "Villa", description: "Historic or character villa with high ceilings and heritage details" },
          { type: "Townhouse", description: "Modern multi-level attached home" },
          { type: "Apartment", description: "Single-level unit or apartment in a complex" },
          { type: "House", description: "Standalone residential home" },
          { type: "Lifestyle block", description: "Rural acreage or lifestyle property" },
          { type: "Section", description: "Vacant land parcel or building site" },
        ],
        available_architectural_styles: [
          { style: "Character", description: "Colonial, period, or heritage character architecture" },
          { style: "Modernist", description: "Mid-to-late 20th century modernist design" },
          { style: "Contemporary", description: "Contemporary, brand-new, or modern build" },
          { style: "Craftsman", description: "Craftsman, bungalow, or artisan carpentry" },
          { style: "Mid-Century", description: "1940s to 1960s classic retro mid-century" },
        ],
        available_flood_risks: [
          { risk: "Low", description: "Safe from flooding hazards" },
          { risk: "Moderate", description: "Moderate overland flow or catchment" },
          { risk: "High", description: "High flood plain hazard" },
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
          orientation: "Orientation (North for optimal all-day sun in NZ)",
          sunlightHours: "Daily sunlight exposure",
          walkability: "Walk score out of 100 with nearby cafes, parks, supermarkets",
          schoolZones: "School catchments with in-zone enrolment entitlements",
        },
      },
    },
  };
}

export function buildJevQuestions(locations: string[]) {
  const locationCriteria: Record<string, string> = {
    none: "No specific location mentioned in query, or any location is acceptable",
  };
  for (const loc of locations) {
    locationCriteria[loc] = `Property location in ${loc}, New Zealand`;
  }

  return {
    property_type: {
      type: "choice" as const,
      instructions: "What property type is the buyer requesting in `user_query`?",
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
    architectural_style: {
      type: "choice" as const,
      instructions: "What architectural style is requested in `user_query`?",
      criteria: {
        Character: "Character, heritage, colonial, period, or vintage style",
        Modernist: "Modernist style",
        Contemporary: "Contemporary, modern, or new build",
        Craftsman: "Craftsman or bungalow style",
        "Mid-Century": "Mid-century style (1940s-1960s)",
        none: "No specific architectural style requested",
      },
    },
    flood_risk: {
      type: "choice" as const,
      instructions: "Does the buyer specify a flood risk requirement in `user_query`?",
      criteria: {
        Low: "Explicitly requested low flood risk, flood-free, or safe from flooding",
        Moderate: "Moderate flood risk acceptable",
        High: "High flood risk acceptable",
        none: "No flood risk requirement specified",
      },
    },
    location: {
      type: "choice" as const,
      instructions: "Which known location from `catalog.known_locations` is requested in `user_query`?",
      criteria: locationCriteria,
    },
    is_sunny_or_north_facing: {
      type: "noul" as const,
      instructions: "Does `user_query` request north-facing orientation, all-day sun, or sunny aspect?",
    },
    is_walkable_requested: {
      type: "noul" as const,
      instructions: "Does `user_query` request high walkability, walking to shops, cafes, or public transit?",
    },
    is_school_zone_requested: {
      type: "noul" as const,
      instructions: "Does `user_query` request properties in a good school zone or grammar zone?",
    },
    price_intent: {
      type: "choice" as const,
      instructions: "How is price or budget mentioned in `user_query`?",
      criteria: {
        max_budget: "Upper limit, budget, under, below, max, up to, or cheaper than",
        min_budget: "Lower limit, over, above, at least, minimum",
        exact: "Specific target price",
        none: "No price or budget mentioned",
      },
    },
    era_intent: {
      type: "choice" as const,
      instructions: "Does `user_query` specify a construction era or property age?",
      criteria: {
        character_heritage: "Pre-1940s, historic, character, colonial, or villa era",
        mid_century: "1940s to 1960s mid-century era",
        modernist: "1960s to 1990s modernist era",
        contemporary: "2000s onwards new build or modern era",
        none: "No specific construction era mentioned",
      },
    },
    needs_clarification: {
      type: "noul" as const,
      instructions: "Is `user_query` completely vague, meaningless, or devoid of any property search intent?",
    },
  };
}

export function cleanJevFilters(
  query: string,
  answers: Record<string, { choice?: string; noul?: number; confidence?: number }>,
): { filters: PropertyFilters; appliedDescriptions: string[] } {
  const filters: PropertyFilters = {};
  const applied: string[] = [];

  // Property type
  const pType = answers.property_type?.choice;
  if (pType && pType !== "none") {
    filters.propertyTypes = [pType as PropertyType];
    applied.push(pType.toLowerCase());
  }

  // Architectural style
  const style = answers.architectural_style?.choice;
  if (style && style !== "none") {
    filters.architecturalStyles = [style as ArchitecturalStyle];
    applied.push(`${style.toLowerCase()} style`);
  }

  // Flood risk
  const flood = answers.flood_risk?.choice;
  if (flood && flood !== "none") {
    filters.floodRisks = [flood as FloodRisk];
    applied.push(`${flood.toLowerCase()} flood risk`);
  }

  // Location
  const loc = answers.location?.choice;
  if (loc && loc !== "none") {
    const qLower = query.toLowerCase();
    const locLower = loc.toLowerCase();
    if (
      qLower.includes(locLower) ||
      locLower.split(/\s+/).some((part) => part.length >= 4 && qLower.includes(part))
    ) {
      filters.location = loc;
      applied.push(`in ${loc}`);
    }
  }

  // Sun / North facing
  const sunnyProb = answers.is_sunny_or_north_facing?.noul ?? 0;
  const mentionsSun = /\b(north[- ]facing|sunny|sunlight|all[- ]day sun)\b/i.test(query);
  if (sunnyProb >= 0.55 || mentionsSun) {
    filters.northFacingOnly = true;
    applied.push("north-facing sun");
  }

  // Walkability
  const walkProb = answers.is_walkable_requested?.noul ?? 0;
  const mentionsWalk = /\b(walkable|walkability|walk to|close to cafes|near shops)\b/i.test(query);
  if (walkProb >= 0.55 || mentionsWalk) {
    filters.minWalkScore = 70;
    applied.push("high walkability");
  }

  // School zone
  const schoolProb = answers.is_school_zone_requested?.noul ?? 0;
  const mentionsSchool = /\b(school\s*zone|grammar\s*zone|in\s*zone|schools?)\b/i.test(query);
  if (schoolProb >= 0.55 || mentionsSchool) {
    filters.inZoneOnly = true;
    applied.push("in school zone");
  }

  // Commute
  const commuteMatch = query.match(
    /(?:within|under|less than|up to|max)?\s*(\d+)\s*(?:mins?|minutes?)\s*(?:to|from|commute)?/i,
  );
  const mentionsCbd = /\b(cbd|city|britomart|downtown|centre|center|work)\b/i.test(query);
  const mentionsCommute = /\b(commute|drive|transit|travel)\b/i.test(query);
  if (commuteMatch && (mentionsCbd || mentionsCommute)) {
    const mins = Number(commuteMatch[1]);
    filters.maxCommuteTimeMinutes = mins;
    applied.push(`under ${mins} mins commute`);
  }

  // Price
  const parsedPrice = parsePriceFromQuery(query);
  const priceIntent = answers.price_intent?.choice;
  if (parsedPrice) {
    if (parsedPrice.isMin || priceIntent === "min_budget") {
      filters.minPrice = parsedPrice.amount;
      applied.push(`over $${parsedPrice.amount.toLocaleString("en-NZ")}`);
    } else {
      filters.maxPrice = parsedPrice.amount;
      applied.push(`under $${parsedPrice.amount.toLocaleString("en-NZ")}`);
    }
  }

  // Bedrooms
  const beds = parseBedroomsFromQuery(query);
  if (beds !== null) {
    filters.bedrooms = beds;
    applied.push(`${beds}-bedroom`);
  }

  // Era / Year Built
  const era = answers.era_intent?.choice;
  if (era === "character_heritage") {
    filters.yearBuiltTo = 1940;
    applied.push("built pre-1940");
  } else if (era === "mid_century") {
    filters.yearBuiltFrom = 1940;
    filters.yearBuiltTo = 1965;
    applied.push("built 1940–1965");
  } else if (era === "modernist") {
    filters.yearBuiltFrom = 1965;
    filters.yearBuiltTo = 1999;
    applied.push("built 1965–1999");
  } else if (era === "contemporary") {
    filters.yearBuiltFrom = 2000;
    applied.push("built 2000+");
  }

  return { filters, appliedDescriptions: applied };
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
    options.apiKey ||
    process.env.JEV_API_KEY ||
    process.env.TYPESAFE_API_KEY;

  if (!apiKey) {
    console.log("[AI Search] No JEV_API_KEY provided; falling back to local interpreter.");
    return localResult(query, properties);
  }

  const { locations, state: catalogState } = buildCatalogState(properties);
  const questions = buildJevQuestions(locations);

  const requestPayload = {
    model: options.model || JEV_DEFAULT_MODEL,
    state: {
      user_query: query,
      ...catalogState,
    },
    questions,
  };

  try {
    console.log(`[AI Search] Calling TypeSafe Jev for query: "${query}"`);

    let responseData: {
      answers: Record<string, { choice?: string; noul?: number; confidence?: number }>;
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
      const systemOneResult = await client.systemOne(
        requestPayload as unknown as Parameters<TypeSafeClient["systemOne"]>[0],
      );
      responseData = systemOneResult as unknown as typeof responseData;
    }

    const { filters, appliedDescriptions } = cleanJevFilters(
      query,
      responseData.answers,
    );
    const needsClarificationProb =
      responseData.answers.needs_clarification?.noul ?? 0;
    const hasFilters = Object.keys(filters).length > 0;

    const isVague = needsClarificationProb >= 0.7 && !hasFilters;

    return {
      status: isVague ? "needs-clarification" : "ready",
      filters,
      message: isVague
        ? "Try adding a location, property type, architectural style, bedroom count or budget."
        : formatSearchMessage(appliedDescriptions),
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
