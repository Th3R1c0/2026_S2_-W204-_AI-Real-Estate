import type {
  FloodHazardType,
  PastSale,
  Property,
  PropertyFilters,
  PropertyNotification,
  PropertyType,
  ValuationRecord,
} from "./property-types";
import {
  matchCatalogDetails,
  parseExplicitPropertyFilters,
} from "./property-query";

/** Hazard layers that are excluded by each flood risk level. */
export const FLOOD_RISK_EXCLUDED_HAZARDS: Record<
  "exclude_low" | "exclude_high",
  FloodHazardType[]
> = {
  exclude_low: [
    "flood_plains",
    "coastal_inundation",
    "flood_prone_areas",
    "overland_flow_paths",
  ],
  exclude_high: ["flood_prone_areas", "overland_flow_paths"],
};

function matchesFloodFilter(property: Property, filters: PropertyFilters) {
  const hazards = property.floodHazards;
  const intersects = (types: FloodHazardType[]) =>
    hazards?.some((hazard) => types.includes(hazard.type)) === true;

  // The risk-level select takes precedence over the legacy hazard checkboxes.
  if (filters.floodRisk === "exclude_low") {
    return hazards !== undefined && !intersects(FLOOD_RISK_EXCLUDED_HAZARDS.exclude_low);
  }
  if (filters.floodRisk === "exclude_high") {
    return hazards !== undefined && !intersects(FLOOD_RISK_EXCLUDED_HAZARDS.exclude_high);
  }

  return (
    (!filters.floodHazardTypes?.length ||
      hazards?.some((hazard) =>
        filters.floodHazardTypes?.includes(hazard.type),
      ) === true) &&
    (!filters.noMappedFloodHazard ||
      (hazards !== undefined && hazards.length === 0))
  );
}

export function filterProperties(
  properties: Property[],
  filters: PropertyFilters,
): Property[] {
  const locations = [...(filters.locations ?? []), filters.location ?? ""]
    .map((location) => location.trim().toLocaleLowerCase())
    .filter(Boolean);
  // Compare against the full names only: "Auckland Grammar school zone"
  // should not match "Auckland Grammar School" plus "Auckland Grammar Zone".
  const schoolNames = [...(filters.schoolNames ?? [])]
    .map((name) => name.trim().toLocaleLowerCase())
    .filter(Boolean);

  return properties.filter((property) => {
    const propertyLocation = [
      property.address,
      property.suburb,
      property.city,
      property.region,
    ]
      .join(" ")
      .toLocaleLowerCase();
    // In-zone schools and schools that are merely nearby both count as "near".
    const propertySchoolNames = [
      ...(property.schoolZones ?? []).map((zone) => zone.name ?? zone.schoolName),
      ...(property.nearbySchools ?? []).map((school) => school.name),
    ]
      .filter((name): name is string => Boolean(name))
      .map((name) => name.toLocaleLowerCase());
    const inZoneSchoolNames = (property.schoolZones ?? [])
      .filter((zone) => zone.isInZone ?? true)
      .map((zone) => (zone.name ?? zone.schoolName ?? "").toLocaleLowerCase())
      .filter(Boolean);
    const matchesSchoolName = (name: string) => {
      const lowered = name.trim().toLocaleLowerCase();
      if (!lowered) return false;
      return filters.inZoneOnly
        ? inZoneSchoolNames.some((propertyName) => propertyName.includes(lowered))
        : propertySchoolNames.some((propertyName) => propertyName.includes(lowered));
    };

    const numericCriteriaMatch = Object.entries(
      filters.numericCriteria ?? {},
    ).every(([field, range]) => {
      const value =
        property[
          field as keyof NonNullable<PropertyFilters["numericCriteria"]>
        ];
      return (
        typeof value === "number" &&
        (range.min === undefined ||
          (range.minExclusive ? value > range.min : value >= range.min)) &&
        (range.max === undefined ||
          (range.maxExclusive ? value < range.max : value <= range.max))
      );
    });

    return (
      (!filters.propertyTypes?.length ||
        filters.propertyTypes.includes(property.propertyType)) &&
      matchesFloodFilter(property, filters) &&
      (!filters.hasOpenHome ||
        Boolean(property.openHomes && property.openHomes.length > 0)) &&
      (!locations.length ||
        locations.some((location) => propertyLocation.includes(location))) &&
      (!schoolNames.length || schoolNames.some(matchesSchoolName)) &&
      (filters.maxPrice === undefined || property.price <= filters.maxPrice) &&
      (filters.minPrice === undefined || property.price >= filters.minPrice) &&
      (filters.bedrooms === undefined ||
        property.bedrooms === filters.bedrooms) &&
      numericCriteriaMatch &&
      (!filters.ownershipTypes?.length ||
        (property.ownershipType !== undefined &&
          filters.ownershipTypes.some(
            (type) =>
              type.toLowerCase() === property.ownershipType?.toLowerCase(),
          ))) &&
      (filters.yearBuiltFrom === undefined ||
        property.yearBuilt >= filters.yearBuiltFrom) &&
      (filters.yearBuiltTo === undefined ||
        property.yearBuilt <= filters.yearBuiltTo) &&
      // In-zone school catchment filter
      (!filters.inZoneOnly || inZoneSchoolNames.length > 0) &&
      (!filters.hasNearbySchool || (property.nearbySchools?.length ?? 0) > 0) &&
      (!filters.nearbySchoolType ||
        property.nearbySchools?.some(
          (school) => school.orgType === filters.nearbySchoolType,
        ) === true) &&
      (filters.schoolId === undefined ||
        (filters.schoolSearchMode === "zone"
          ? property.schoolZones?.some(
              (zone) => zone.schoolId === filters.schoolId,
            ) === true
          : property.nearbySchools?.some(
              (school) => school.schoolId === filters.schoolId,
            ) === true)) &&
      true
    );
  });
}

const typeMatchers: Array<[RegExp, PropertyType]> = [
  [/\blifestyle\s+blocks?\b/i, "Lifestyle block"],
  [/\btownhouses?\b/i, "Townhouse"],
  [/\bapartments?\b/i, "Apartment"],
  [/\bsections?\b/i, "Section"],
  [/\bvillas?\b/i, "Villa"],
  [/\bhouses?|homes?\b/i, "House"],
];


const floodHazardMatchers: Array<[RegExp, FloodHazardType]> = [
  [/\bflood\s+plains?\b/i, "flood_plains"],
  [/\bflood[-\s]+prone\s+areas?\b/i, "flood_prone_areas"],
  [/\boverland\s+flow\s+paths?\b/i, "overland_flow_paths"],
  [/\bcoastal\s+inundation\b/i, "coastal_inundation"],
];

const wordNumbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

export function parseNaturalLanguageSearch(
  query: string,
  properties: Property[],
): {
  status: "ready" | "needs-clarification";
  filters: PropertyFilters;
  message: string;
} {
  const filters: PropertyFilters = parseExplicitPropertyFilters(query);
  const propertyType = typeMatchers.find(([matcher]) =>
    matcher.test(query),
  )?.[1];
  const floodHazards = floodHazardMatchers
    .filter(([matcher]) => matcher.test(query))
    .map(([, hazard]) => hazard);
  const noFloodHazard =
    /\bno\s+(?:mapped\s+)?flood\s+(?:hazards?|risks?)\b/i.test(query);
  const unsupportedFloodRating =
    /\b(?:low|moderate|high)\s+flood\s+risk\b/i.test(query);

  if (propertyType) filters.propertyTypes = [propertyType];
  if (floodHazards.length) filters.floodHazardTypes = floodHazards;
  else if (
    /\bflood\s+(?:risk|hazards?)\b/i.test(query) &&
    !noFloodHazard &&
    !unsupportedFloodRating
  ) {
    filters.floodHazardTypes = [
      "flood_plains",
      "flood_prone_areas",
      "overland_flow_paths",
      "coastal_inundation",
    ];
  }
  if (noFloodHazard) {
    filters.noMappedFloodHazard = true;
  }
  if (/\bopen\s+homes?\b/i.test(query)) {
    filters.hasOpenHome = true;
  }

  const places = Array.from(
    new Set(
      properties.flatMap(({ city, region, suburb }) => [city, region, suburb]),
    ),
  )
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const lowerQuery = query.toLocaleLowerCase();
  const matchedPlaces = places.filter((place) =>
    lowerQuery.includes(place.toLocaleLowerCase()),
  );
  // Drop places already contained in a longer matched place name.
  const locations = matchedPlaces.filter(
    (place) =>
      !matchedPlaces.some(
        (other) =>
          other !== place &&
          other.toLocaleLowerCase().includes(place.toLocaleLowerCase()),
      ),
  );
  if (locations.length) {
    filters.locations = locations;
    delete filters.location;
  }
  const catalogMatches = matchCatalogDetails(query, properties);
  Object.assign(filters, catalogMatches);
  if (catalogMatches.locations?.length || catalogMatches.location)
    delete filters.locations;
  if (filters.locations?.length) delete filters.location;

  const bedroomsMatch =
    filters.bedrooms === undefined &&
    !filters.numericCriteria?.bedrooms &&
    query.match(
      /\b(one|two|three|four|five|six|\d+)\s*[-_\s]?bed(?:room)?s?\b/i,
    );
  if (bedroomsMatch) {
    const value = bedroomsMatch[1].toLocaleLowerCase();
    filters.bedrooms = wordNumbers[value] ?? Number(value);
  }

  const hasRecognisedFilter = Object.keys(filters).length > 0;
  if (!hasRecognisedFilter) {
    return {
      status: "needs-clarification",
      filters,
      message: unsupportedFloodRating
        ? "Council mapping does not provide a low, moderate or high risk rating. Try a mapped flood hazard instead."
        : "Try adding a location, property type, flood risk, bedroom count or budget.",
    };
  }

  return {
    status: "ready",
    filters,
    message: "I found the details in your request and applied them below.",
  };
}

function distanceBetweenKm(a: Property, b: Property): number {
  const radiusKm = 6_371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const firstLatitude = toRadians(a.latitude);
  const secondLatitude = toRadians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function findComparableSales(
  target: Property,
  sales: Property[],
  options: { radiusKm: number; months: number; asOf: Date },
): {
  comps: { property: Property; distanceKm: number }[];
  averagePrice: number;
} {
  const earliestDate = new Date(options.asOf);
  earliestDate.setUTCMonth(earliestDate.getUTCMonth() - options.months);

  const comps = sales
    .filter((property) => {
      if (!property.soldDate || property.id === target.id) return false;
      const floorAreaDifference =
        Math.abs(property.floorArea - target.floorArea) / target.floorArea;
      return (
        new Date(property.soldDate) >= earliestDate &&
        property.propertyType === target.propertyType &&
        Math.abs(property.bedrooms - target.bedrooms) <= 1 &&
        floorAreaDifference <= 0.35 &&
        distanceBetweenKm(target, property) <= options.radiusKm
      );
    })
    .map((property) => ({
      property,
      distanceKm: distanceBetweenKm(target, property),
    }))
    .sort(
      (a, b) =>
        new Date(b.property.soldDate!).getTime() -
        new Date(a.property.soldDate!).getTime(),
    );

  const averagePrice = comps.length
    ? Math.round(
        comps.reduce((sum, { property }) => sum + property.price, 0) /
          comps.length,
      )
    : 0;

  return { comps, averagePrice };
}

export function calculateMonthlyMortgage(
  price: number,
  depositPercent: number,
  annualRatePercent: number,
  termYears: number,
): number {
  const principal = price * (1 - depositPercent / 100);
  const paymentCount = termYears * 12;
  const monthlyRate = annualRatePercent / 100 / 12;

  if (principal <= 0 || paymentCount <= 0) return 0;
  if (monthlyRate === 0) return Math.round(principal / paymentCount);

  return Math.round(
    (principal * monthlyRate * (1 + monthlyRate) ** paymentCount) /
      ((1 + monthlyRate) ** paymentCount - 1),
  );
}

export function generateSampleNotifications(
  savedProperties: Property[],
): PropertyNotification[] {
  return savedProperties.flatMap((property) => property.notifications ?? []);
}

export function generateValuationHistory(property: Property): {
  pastSales: PastSale[];
  valuationHistory: ValuationRecord[];
} {
  return {
    pastSales: property.pastSales ?? [],
    valuationHistory: property.valuationHistory ?? [],
  };
}
