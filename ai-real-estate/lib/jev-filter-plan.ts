import type {
  NumericCriterion,
  NumericSearchField,
  Property,
  PropertyFilters,
} from "./property-types";
import { parseExplicitPropertyFilters } from "./property-query";

export type JevAnswer = {
  choice?: string;
  noul?: number;
  confidence?: number | null;
  probabilities?: Record<string, number>;
};
type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string };

const words: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};
const numericFields = {
  price: "purchase price / budget in NZD (NOT capital value or rent)",
  bedrooms: "number of bedrooms",
  bathrooms: "number of bathrooms",
  parkingSpaces:
    "number of cars that can park (room/space for cars means a minimum capacity)",
  landArea: "land / section / lot area in square metres",
  floorArea: "internal floor area in square metres",
  yearBuilt: "year of construction (NOT a price or area)",
  estimatedWeeklyRent:
    "estimated weekly rental income in NZD (NOT purchase price)",
  capitalValue:
    "capital value / CV / council valuation in NZD (NOT purchase price)",
};

// Over-find source values, then let Jev assign each to its role. Values never come from model text.
export function numericCandidates(query: string) {
  const pattern =
    /\b(?:\d[\d,]*(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|twelve)(?:\s*(?:million\b|mil\b|k\b|m\b(?![²2])))?(?!\w|\.\d)/gi;
  return Array.from(query.matchAll(pattern), (match) => {
    const raw = match[0];
    const number = /^(\d[\d,]*(?:\.\d+)?|[a-z]+)/i.exec(raw)![1].toLowerCase();
    const unit = raw.slice(number.length).trim().toLowerCase();
    const value =
      (words[number] ?? Number(number.replaceAll(",", ""))) *
      (unit === "k" ? 1_000 : /^(m|million|mil)$/.test(unit) ? 1_000_000 : 1);
    return { raw, value, position: match.index };
  }).filter(
    (candidate, index, all) =>
      all.findIndex((other) => other.value === candidate.value) === index,
  );
}

const propertyTypes = [
  "Villa",
  "Townhouse",
  "Apartment",
  "House",
  "Lifestyle block",
  "Section",
] as const;
const hazardTypes = [
  "flood_plains",
  "flood_prone_areas",
  "overland_flow_paths",
  "coastal_inundation",
] as const;

export function buildFilterPlanQuestions(
  query: string,
  properties: Property[],
): Record<string, Question> {
  const questions: Record<string, Question> = {};
  const candidates = numericCandidates(query);
  if (candidates.length) {
    for (const [field, meaning] of Object.entries(numericFields)) {
      for (const bound of ["min", "max"] as const) {
        const criteria: Record<string, string> = {
          none: `No ${bound === "min" ? "lower" : "upper"} bound for ${meaning} is stated`,
        };
        candidates.forEach((candidate, i) => {
          criteria[`inclusive_${i}`] =
            `${bound === "min" ? "At least" : "At most"} ${candidate.raw} (source offset ${candidate.position}); includes the boundary`;
          criteria[`exclusive_${i}`] =
            `${bound === "min" ? "Strictly more than / after" : "Strictly less than / before"} ${candidate.raw} (source offset ${candidate.position}); excludes the boundary`;
        });
        questions[`number_${field}_${bound}`] = {
          type: "choice",
          instructions:
            `In \`user_query\`, select the ${bound === "min" ? "lower" : "upper"} bound for ${meaning}, using ONLY a source value that refers to this field. Select none when this boundary is absent. ` +
            "Interpret each requirement separately: 'at least 3 bedrooms and 2 bathrooms' means minimum 3 bedrooms and exactly 2 bathrooms. An exact or unqualified bedroom/bathroom count sets BOTH inclusive bounds. Capacity for N cars is a minimum only. " +
            "Unqualified land/floor area is a minimum. 'At least', 'or more', '+' set only a lower bound; 'up to', 'no more than' set only an upper bound. " +
            "'Between A and B', 'A to B' set inclusive lower A and upper B. 'Under', 'over', 'before', 'after' exclude the boundary.",
          criteria,
        };
      }
    }
  }
  for (const [prefix, values, meaning] of [
    ["type", propertyTypes, "property type"],
    [
      "ownership",
      ["Freehold", "Cross Lease", "Unit Title"],
      "ownership / title type",
    ],
    ["hazard", hazardTypes, "mapped hazard intersection"],
  ] as const) {
    for (const value of values) {
      questions[`${prefix}_${value}`] = {
        type: "noul",
        instructions:
          `Does user_query explicitly request or accept ${value.replaceAll("_", " ")} as a ${meaning}? ` +
          "Alternatives joined by OR can each be accepted. Answer no for excluded values or an unspecified field. " +
          "Generic 'home/property' does not specify a type. " +
          "A request for no hazards does not request any hazard intersection.",
      };
    }
  }
  questions.open_home = {
    type: "noul",
    instructions:
      "Does user_query require a scheduled open home / open viewing? Answer no if not requested or excluded.",
  };
  questions.no_mapped_hazard = {
    type: "choice",
    instructions:
      "Classify ONLY the buyer's explicit flood exclusion requirement in `user_query`. Ignore catalog facts and general buyer preferences.",
    criteria: {
      requested:
        "The buyer explicitly asks to exclude mapped flood hazards / avoid flood areas",
      none: "The query never mentions excluding flood hazards, or asks for properties intersecting a hazard",
    },
  };
  questions.school_mode = {
    type: "choice",
    instructions:
      "What school requirement does user_query express? Distinguish enrolment zone from merely nearby.",
    criteria: {
      none: "No school requirement",
      zone: "Inside the enrolment zone / catchment",
      nearby: "Nearby / close to a school",
    },
  };
  const schoolTypes = [
    ...new Set(
      properties.flatMap((p) => p.nearbySchools?.map((s) => s.orgType) ?? []),
    ),
  ];
  if (schoolTypes.length)
    questions.school_type = {
      type: "choice",
      instructions:
        "What nearby school TYPE does `user_query` explicitly name, e.g. primary or secondary? Select none if only a school NAME is mentioned, even if you know its type. Do not infer from catalog facts.",
      criteria: {
        none: "No school type requested",
        ...Object.fromEntries(schoolTypes.map((t) => [t, t])),
      },
    };
  questions.unsupported_requirement = {
    type: "noul",
    instructions:
      "Does user_query include a concrete requirement that cannot be represented by these filters: property type, location, purchase price, bedrooms, bathrooms, parking capacity, land/floor area, construction year, ownership, weekly rent, capital value, nearby school/type or a general enrolment-zone match, flood risk, open home? " +
      "Also answer yes for OR between different groups of constraints (e.g. either a cheap apartment or a large expensive house), excluded categories ('not an apartment'), or unsupported numeric disjunctions. Ordinary AND across fields and OR within a category are supported. 'Enough room for 4 cars' is supported parking capacity. Do not treat an empty result set as unsupported.",
  };
  return questions;
}

export function applyFilterPlan(
  query: string,
  filters: PropertyFilters,
  answers: Record<string, JevAnswer>,
  properties: Property[],
) {
  const issues: string[] = [];
  if (answers.location?.choice === "unknown")
    issues.push(
      "Please choose a location from the available property filters.",
    );
  const candidates = numericCandidates(query);
  const explicit = parseExplicitPropertyFilters(query);
  const chosen = (id: string) => {
    const answer = answers[id];
    if (!answer?.choice || answer.choice === "none") return undefined;
    if (answer.confidence != null && answer.confidence < 0.6) {
      issues.push(`Please clarify ${id.replaceAll("_", " ")}.`);
      return undefined;
    }
    return answer.choice;
  };
  for (const field of Object.keys(numericFields)) {
    // Missing answers preserve the local parser during API degradation; explicit 'none' removes guesses.
    if (!answers[`number_${field}_min`] && !answers[`number_${field}_max`])
      continue;
    // Exact syntax belongs to code. Do not let a comparison in an earlier clause leak into an exact count.
    const explicitCount =
      field === "bedrooms" && explicit.bedrooms !== undefined
        ? { min: explicit.bedrooms, max: explicit.bedrooms }
        : field === "bathrooms"
          ? explicit.numericCriteria?.bathrooms
          : undefined;
    const hasRangeOrSuffix =
      /\b\d+\s*(?:to|or more|or fewer|[-–])\s*\d*\s*(?:bed|bath)|\b(?:bedrooms?|bathrooms?)\s+(?:minimum|maximum|or more|or fewer)\b/i.test(
        query,
      );
    if (
      explicitCount?.min !== undefined &&
      explicitCount.min === explicitCount.max &&
      !hasRangeOrSuffix
    ) {
      if (field === "bedrooms") {
        filters.bedrooms = explicitCount.min;
        if (filters.numericCriteria) delete filters.numericCriteria.bedrooms;
      } else
        filters.numericCriteria = {
          ...filters.numericCriteria,
          bathrooms: explicitCount,
        };
      continue;
    }
    const range: NumericCriterion = {};
    for (const bound of ["min", "max"] as const) {
      const choice = chosen(`number_${field}_${bound}`);
      if (!choice) continue;
      const match = /^(inclusive|exclusive)_(\d+)$/.exec(choice);
      const candidate = match ? candidates[Number(match[2])] : undefined;
      if (
        !candidate ||
        !Number.isFinite(candidate.value) ||
        candidate.value < 0
      ) {
        issues.push(
          `Please clarify ${field}: no valid source value was selected.`,
        );
        continue;
      }
      range[bound] = candidate.value;
      if (match![1] === "exclusive") range[`${bound}Exclusive`] = true;
    }
    if (
      range.min !== undefined &&
      range.max !== undefined &&
      (range.min > range.max ||
        (range.min === range.max && (range.minExclusive || range.maxExclusive)))
    ) {
      issues.push(
        `Please clarify ${field}: the minimum conflicts with the maximum.`,
      );
    }
    const discrete = [
      "yearBuilt",
      "bedrooms",
      "bathrooms",
      "parkingSpaces",
    ].includes(field);
    if (discrete) {
      if (range.minExclusive) {
        range.min! += 1;
        delete range.minExclusive;
      }
      if (range.maxExclusive) {
        range.max! -= 1;
        delete range.maxExclusive;
      }
    }
    if (field === "price") {
      filters.minPrice =
        range.min === undefined
          ? undefined
          : range.min + (range.minExclusive ? 0.01 : 0);
      filters.maxPrice =
        range.max === undefined
          ? undefined
          : range.max - (range.maxExclusive ? 0.01 : 0);
    } else if (field === "yearBuilt") {
      filters.yearBuiltFrom = range.min;
      filters.yearBuiltTo = range.max;
    } else {
      const numericField = field as NumericSearchField;
      if (field === "bedrooms") delete filters.bedrooms;
      filters.numericCriteria = { ...filters.numericCriteria };
      delete filters.numericCriteria[numericField];
      if (Object.keys(range).length) {
        if (
          field === "bedrooms" &&
          range.min === range.max &&
          range.min !== undefined
        )
          filters.bedrooms = range.min;
        else filters.numericCriteria[numericField] = range;
      }
    }
  }
  for (const [prefix, values, key] of [
    ["type", propertyTypes, "propertyTypes"],
    ["ownership", ["Freehold", "Cross Lease", "Unit Title"], "ownershipTypes"],
    ["hazard", hazardTypes, "floodHazardTypes"],
  ] as const) {
    if (!values.some((v) => answers[`${prefix}_${v}`])) continue;
    const selected = values.filter(
      (v) => (answers[`${prefix}_${v}`]?.noul ?? 0) >= 0.75,
    );
    // The category sets above are the only allowed values.
    Object.assign(filters, { [key]: selected.length ? selected : undefined });
    if (
      values.some((v) => {
        const p = answers[`${prefix}_${v}`]?.noul;
        return p !== undefined && p > 0.4 && p < 0.75;
      })
    ) {
      issues.push(`Please clarify the requested ${key}.`);
    }
  }
  if (answers.open_home)
    filters.hasOpenHome = (answers.open_home.noul ?? 0) >= 0.75 || undefined;
  if (answers.no_mapped_hazard)
    filters.noMappedFloodHazard =
      chosen("no_mapped_hazard") === "requested" || undefined;
  if (filters.noMappedFloodHazard && filters.floodHazardTypes?.length)
    issues.push(
      "Please clarify whether mapped flood hazards should be included or excluded.",
    );
  if (filters.noMappedFloodHazard) {
    delete filters.floodHazardTypes;
    filters.floodRisk = "exclude_low";
  }
  const schoolMode = chosen("school_mode");
  if (schoolMode === "zone") {
    filters.inZoneOnly = true;
    filters.schoolSearchMode = "zone";
  }
  if (schoolMode === "nearby") {
    delete filters.inZoneOnly;
    filters.hasNearbySchool = true;
  }
  const schoolType = chosen("school_type");
  if (
    schoolType &&
    properties.some((p) =>
      p.nearbySchools?.some((s) => s.orgType === schoolType),
    )
  )
    filters.nearbySchoolType = schoolType;
  if ((answers.unsupported_requirement?.noul ?? 0) >= 0.6)
    issues.push(
      "Part of this request needs clarification. Use the available filters or split alternatives into separate searches.",
    );
  if (filters.numericCriteria && !Object.keys(filters.numericCriteria).length)
    delete filters.numericCriteria;
  for (const key of Object.keys(filters) as Array<keyof PropertyFilters>)
    if (filters[key] === undefined) delete filters[key];
  return issues;
}

export function describeFilters(filters: PropertyFilters): string[] {
  const parts: string[] = [];
  if (filters.propertyTypes?.length)
    parts.push(filters.propertyTypes.join(" or ").toLowerCase());
  if (filters.locations?.length) parts.push(`in ${filters.locations.join(" or ")}`);
  else if (filters.location) parts.push(`in ${filters.location}`);
  if (filters.minPrice !== undefined)
    parts.push(`from $${filters.minPrice.toLocaleString("en-NZ")}`);
  if (filters.maxPrice !== undefined)
    parts.push(`up to $${filters.maxPrice.toLocaleString("en-NZ")}`);
  if (filters.bedrooms !== undefined) parts.push(`${filters.bedrooms}-bedroom`);
  const labels: Record<NumericSearchField, string> = {
    bedrooms: "bedrooms",
    bathrooms: "bathroom",
    parkingSpaces: "parking spaces",
    landArea: "m² land",
    floorArea: "m² floor area",
    estimatedWeeklyRent: "weekly rent",
    capitalValue: "capital value",
  };
  for (const [field, range] of Object.entries(filters.numericCriteria ?? {})) {
    const label = labels[field as NumericSearchField];
    if (range.min !== undefined && range.min === range.max)
      parts.push(`${range.min} ${label}`);
    else if (range.min !== undefined && range.max !== undefined)
      parts.push(
        `${range.minExclusive ? ">" : ""}${range.min}–${range.maxExclusive ? "<" : ""}${range.max} ${label}`,
      );
    else if (range.min !== undefined)
      parts.push(
        `${range.minExclusive ? "> " + range.min : range.min + "+"} ${label}`,
      );
    else if (range.max !== undefined)
      parts.push(`${range.maxExclusive ? "<" : "up to"} ${range.max} ${label}`);
  }
  if (filters.yearBuiltFrom !== undefined)
    parts.push(`built from ${filters.yearBuiltFrom}`);
  if (filters.yearBuiltTo !== undefined)
    parts.push(`built by ${filters.yearBuiltTo}`);
  if (filters.ownershipTypes?.length)
    parts.push(filters.ownershipTypes.join(" or ").toLowerCase());
  if (filters.hasOpenHome) parts.push("an open home");
  if (filters.noMappedFloodHazard)
    parts.push("no mapped flood hazard intersection");
  if (filters.floodHazardTypes?.length)
    parts.push(
      `mapped ${filters.floodHazardTypes.join(" or ").replaceAll("_", " ")}`,
    );
  if (filters.hasNearbySchool) parts.push("near a school (within 2.5 km)");
  if (filters.schoolNames?.length)
    parts.push(`near ${filters.schoolNames.join(" or ")}`);
  if (filters.schoolZoneName) parts.push(`in ${filters.schoolZoneName} zone`);
  else if (filters.schoolId !== undefined)
    parts.push(
      `${filters.schoolSearchMode === "zone" ? "in zone for" : "near"} school ${filters.schoolId}`,
    );
  else if (filters.inZoneOnly) parts.push("in school zone");
  if (filters.nearbySchoolType)
    parts.push(`near ${filters.nearbySchoolType} schools`);
  if (filters.floodRisk === "exclude_low")
    parts.push("excluding low flood risk areas");
  else if (filters.floodRisk === "exclude_high")
    parts.push("excluding high flood risk areas");
  return parts;
}
