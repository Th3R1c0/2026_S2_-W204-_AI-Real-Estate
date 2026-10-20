import type {
  NumericCriterion,
  NumericSearchField,
  Property,
  PropertyFilters,
} from "./property-types";

const numberWords: Record<string, number> = {
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
};
const count =
  "(zero|one|two|three|four|five|six|seven|eight|nine|ten|\\d+(?:\\.\\d+)?)";
const comparison =
  "(at least|no less than|more than|over|above|minimum|min|up to|no more than|less than|under|below|maximum|max|exactly)";
const amount = "(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|m|million|mil)?(?![a-z\\d²])";

function toNumber(value: string): number {
  return numberWords[value.toLowerCase()] ?? Number(value.replaceAll(",", ""));
}

function toAmount(value: string, unit?: string): number {
  const multiplier =
    unit?.toLowerCase() === "k"
      ? 1_000
      : /^(m|million|mil)$/i.test(unit ?? "")
        ? 1_000_000
        : 1;
  return Number(value.replaceAll(",", "")) * multiplier;
}

function criterion(
  value: number,
  comparisonText?: string,
  plus?: string,
): NumericCriterion {
  const comparator = comparisonText?.toLowerCase() ?? "";
  if (
    plus ||
    /^(at least|no less than|more than|over|above|minimum|min)$/.test(
      comparator,
    )
  ) {
    return { min: value };
  }
  if (
    /^(up to|no more than|less than|under|below|maximum|max)$/.test(comparator)
  ) {
    return { max: value };
  }
  return { min: value, max: value };
}

function countCriterion(
  query: string,
  aliases: string,
): NumericCriterion | undefined {
  const after = new RegExp(
    `\\b(?:${comparison}\\s+)?${count}\\s*(\\+)?\\s*(?:${aliases})\\b`,
    "i",
  ).exec(query);
  if (after) return criterion(toNumber(after[2]), after[1], after[3]);
  const before = new RegExp(
    `\\b(?:${aliases})\\s*(?:${comparison}\\s+)?${count}\\b`,
    "i",
  ).exec(query);
  return before ? criterion(toNumber(before[2]), before[1]) : undefined;
}

function areaCriterion(
  query: string,
  aliases: string,
  trailing: string,
): NumericCriterion | undefined {
  const unit = "(?:m²|m2|sq\\.?\\s*m|sqm|square\\s+met(?:er|re)s?)";
  const after = new RegExp(
    `\\b(?:${comparison}\\s+)?${count}\\s*${unit}\\s*(?:of\\s+)?(?:${trailing})\\b`,
    "i",
  ).exec(query);
  if (after) return criterion(toNumber(after[2]), after[1]);
  const before = new RegExp(
    `\\b(?:${aliases})\\s*(?:${comparison}\\s+)?${count}\\s*${unit}`,
    "i",
  ).exec(query);
  return before ? criterion(toNumber(before[2]), before[1]) : undefined;
}

function moneyCriterion(
  query: string,
  aliases: string,
  unitAfter: string,
): NumericCriterion | undefined {
  const before = new RegExp(
    `\\b(?:${aliases})\\s*(?:${comparison}\\s+)?\\$?${amount}(?:\\s*${unitAfter})?`,
    "i",
  ).exec(query);
  if (before) return criterion(toAmount(before[2], before[3]), before[1]);
  const after = new RegExp(
    `\\b(?:${comparison}\\s+)?\\$?${amount}\\s*${unitAfter}`,
    "i",
  ).exec(query);
  return after ? criterion(toAmount(after[2], after[3]), after[1]) : undefined;
}

export function parsePriceFilters(
  query: string,
): Pick<PropertyFilters, "minPrice" | "maxPrice"> {
  const result: Pick<PropertyFilters, "minPrice" | "maxPrice"> = {};
  const refersToOtherMoney = (start: number, end: number) => {
    const before =
      query
        .slice(Math.max(0, start - 60), start)
        .split(/\b(?:and|with)\b|[,;]/i)
        .at(-1) ?? "";
    const after = query.slice(end, end + 30).split(/\b(?:and|with)\b|[,;]/i)[0];
    return /\b(?:weekly\s+rent|rental\s+estimate|rent\s+per\s+week|capital\s+value|council\s+valuation|CV)\b/i.test(
      `${before} ${after}`,
    );
  };
  const range =
    /\bbetween\s*(\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|mil)?(?![a-z\d²])\s*(?:and|to|-)\s*(\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|mil)?(?![a-z\d²])/i.exec(
      query,
    );
  if (
    range &&
    !refersToOtherMoney(range.index, range.index + range[0].length)
  ) {
    const first = toAmount(range[2], range[3] || range[6]);
    const second = toAmount(range[5], range[6] || range[3]);
    if (
      (range[1] || range[3] || first >= 10_000) &&
      (range[4] || range[6] || second >= 10_000)
    ) {
      result.minPrice = Math.min(first, second);
      result.maxPrice = Math.max(first, second);
      return result;
    }
  }

  const priceMatchers: Array<[RegExp, "minPrice" | "maxPrice"]> = [
    [
      /\b(?:over|above|at least|more than|minimum|min)\s*(\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|mil)?(?![a-z\d²])/gi,
      "minPrice",
    ],
    [
      /\b(?:under|below|up to|less than|cheaper than|maximum|max|budget)\s*(\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|mil)?(?![a-z\d²])/gi,
      "maxPrice",
    ],
  ];
  for (const [matcher, key] of priceMatchers) {
    for (const match of query.matchAll(matcher)) {
      if (refersToOtherMoney(match.index, match.index + match[0].length))
        continue;
      const value = toAmount(match[2], match[3]);
      if (match[1] || match[3] || value >= 10_000) result[key] = value;
    }
  }
  if (result.minPrice === undefined && result.maxPrice === undefined) {
    const standalone =
      /\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|mil)?(?![a-z\d²])/i.exec(query);
    if (
      standalone &&
      !refersToOtherMoney(
        standalone.index,
        standalone.index + standalone[0].length,
      )
    ) {
      result.maxPrice = toAmount(standalone[1], standalone[2]);
    }
  }
  return result;
}

export function parseExplicitPropertyFilters(query: string): PropertyFilters {
  const filters: PropertyFilters = { ...parsePriceFilters(query) };
  if (
    /\b(?:near|close to)\s+(?:a\s+|any\s+|the\s+)?schools?\b|\bnearby\s+schools?\b/i.test(
      query,
    )
  )
    filters.hasNearbySchool = true;
  const numericCriteria: NonNullable<PropertyFilters["numericCriteria"]> = {};
  const counts: Array<[NumericSearchField, string]> = [
    ["bedrooms", "bed(?:room)?s?|brm"],
    ["bathrooms", "bath(?:room)?s?"],
    [
      "parkingSpaces",
      "parking(?:\\s+spaces?)?|car\\s*parks?|car\\s+spaces?|garages?",
    ],
  ];
  for (const [field, aliases] of counts) {
    const value = countCriterion(query, aliases);
    if (!value) continue;
    if (field === "bedrooms" && value.min === value.max)
      filters.bedrooms = value.min;
    else numericCriteria[field] = value;
  }
  const carCapacity = new RegExp(
    `\\b(?:room|space|parking|capacity)\\s+(?:for\\s+)?${count}\\s+cars?\\b`,
    "i",
  ).exec(query);
  if (carCapacity)
    numericCriteria.parkingSpaces = { min: toNumber(carCapacity[1]) };
  const areas: Array<[NumericSearchField, string, string]> = [
    [
      "landArea",
      "land\\s+area|land\\s+size|section\\s+size|lot\\s+size",
      "land|section|lot",
    ],
    [
      "floorArea",
      "floor\\s+area|floor\\s+size|internal\\s+area|house\\s+size",
      "floor\\s+area|floor\\s+space|inside|internal\\s+area",
    ],
  ];
  for (const [field, aliases, trailing] of areas) {
    const value = areaCriterion(query, aliases, trailing);
    if (value) numericCriteria[field] = value;
  }

  const rent = moneyCriterion(
    query,
    "weekly\\s+rent|rent\\s+per\\s+week|rental\\s+estimate",
    "(?:per\\s+week|\\/\\s*week|pw)",
  );
  if (rent) numericCriteria.estimatedWeeklyRent = rent;
  const capitalValue = moneyCriterion(
    query,
    "capital\\s+value|council\\s+valuation|\\bCV\\b",
    "(?:capital\\s+value|CV)",
  );
  if (capitalValue) numericCriteria.capitalValue = capitalValue;
  if (Object.keys(numericCriteria).length)
    filters.numericCriteria = numericCriteria;

  const ownership = /\b(freehold|cross[-\s]+lease|unit[-\s]+title)\b/i.exec(
    query,
  );
  if (ownership)
    filters.ownershipTypes = [
      ownership[1]
        .replace(/[-\s]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    ];

  const yearFrom =
    /\b(?:built|constructed)\s*(?:after|since|from)\s*(\d{4})\b/i.exec(query);
  const yearTo =
    /\b(?:built|constructed)\s*(?:before|by|until)\s*(\d{4})\b/i.exec(query);
  if (yearFrom) filters.yearBuiltFrom = Number(yearFrom[1]);
  if (yearTo) filters.yearBuiltTo = Number(yearTo[1]);
  const exactYear = /\b(?:built|constructed)\s+(?:in|during)\s+(\d{4})\b/i.exec(
    query,
  );
  if (exactYear) {
    filters.yearBuiltFrom = Number(exactYear[1]);
    filters.yearBuiltTo = Number(exactYear[1]);
  }

  // Flood risk levels map onto the hazard-layer exclusions used by the engine.
  if (/\b(?:no|zero|without)\s+flood\s+risk\b/i.test(query))
    filters.floodRisk = "exclude_low";
  else if (/\b(?:exclude|avoid|no)\s+(?:high|high[-\s]risk)\s+flood/i.test(query))
    filters.floodRisk = "exclude_high";

  return filters;
}

export function matchCatalogDetails(
  query: string,
  properties: Property[],
): PropertyFilters {
  const lower = query.toLowerCase();
  const addresses = Array.from(
    new Set(properties.map(({ address }) => address).filter(Boolean)),
  ).sort((a, b) => b.length - a.length);
  const address = addresses.find((value) =>
    lower.includes(value.toLowerCase()),
  );
  const schoolNames = Array.from(
    new Set(
      properties.flatMap(
        ({ schoolZones }) =>
          schoolZones
            ?.map((z) => z.name ?? z.schoolName)
            .filter((n): n is string => Boolean(n)) ?? [],
      ),
    ),
  ).sort((a, b) => b.length - a.length);
  const wantsZone = /\b(?:zone|catchment|in-zone)\b/i.test(query);
  const schoolZoneName = wantsZone
    ? schoolNames.find((name) => lower.includes(name.toLowerCase()))
    : undefined;
  const mentionedSchool = schoolNames.find((name) =>
    lower.includes(name.toLowerCase()),
  );
  // A named school narrows results to that school, whether in zone or nearby.
  // An explicit address is the more precise filter, so it wins on its own.
  if (address) return { location: address };
  if (!mentionedSchool) return {};
  return {
    ...(wantsZone ? { inZoneOnly: true } : {}),
    ...(schoolZoneName ? { schoolZoneName } : {}),
    schoolNames: [mentionedSchool],
  };
}
