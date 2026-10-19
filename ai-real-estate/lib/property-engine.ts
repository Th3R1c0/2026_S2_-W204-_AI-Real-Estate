import type {
  ArchitecturalStyle,
  FloodHazardType,
  PastSale,
  Property,
  PropertyFilters,
  PropertyNotification,
  PropertyType,
  ValuationRecord,
} from "./property-types";
import { matchCatalogDetails, parseExplicitPropertyFilters } from "./property-query";

export function filterProperties(
  properties: Property[],
  filters: PropertyFilters,
): Property[] {
  const location = filters.location?.toLocaleLowerCase();

  return properties.filter((property) => {
    const propertyLocation = [property.address, property.suburb, property.city, property.region]
      .join(" ")
      .toLocaleLowerCase();

    const numericCriteriaMatch = Object.entries(filters.numericCriteria ?? {}).every(
      ([field, range]) => {
        const value = property[field as keyof NonNullable<PropertyFilters["numericCriteria"]>];
        return typeof value === "number" &&
          (range.min === undefined || value >= range.min) &&
          (range.max === undefined || value <= range.max);
      },
    );

    return (
      (!filters.propertyTypes?.length ||
        filters.propertyTypes.includes(property.propertyType)) &&
      (!filters.architecturalStyles?.length ||
        (property.architecturalStyle !== undefined &&
          filters.architecturalStyles.includes(property.architecturalStyle))) &&
      (!filters.floodHazardTypes?.length ||
        property.floodHazards?.some((hazard) =>
          filters.floodHazardTypes?.includes(hazard.type),
        ) === true) &&
      (!filters.noMappedFloodHazard ||
        (property.floodHazards !== undefined && property.floodHazards.length === 0)) &&
      (!location || propertyLocation.includes(location)) &&
      (filters.maxPrice === undefined || property.price <= filters.maxPrice) &&
      (filters.minPrice === undefined || property.price >= filters.minPrice) &&
      (filters.bedrooms === undefined || property.bedrooms === filters.bedrooms) &&
      numericCriteriaMatch &&
      (!filters.orientations?.length ||
        (property.orientation !== undefined && filters.orientations.includes(property.orientation))) &&
      (!filters.ownershipTypes?.length ||
        (property.ownershipType !== undefined && filters.ownershipTypes.some(
          (type) => type.toLowerCase() === property.ownershipType?.toLowerCase(),
        ))) &&
      (filters.yearBuiltFrom === undefined || property.yearBuilt >= filters.yearBuiltFrom) &&
      (filters.yearBuiltTo === undefined || property.yearBuilt <= filters.yearBuiltTo) &&
      (!filters.northFacingOnly || property.orientation === "North") &&
      // Walkability filter
      (filters.minWalkScore === undefined ||
        (property.walkability?.score ?? 0) >= filters.minWalkScore) &&
      (filters.maxWalkScore === undefined ||
        (property.walkability?.score !== undefined && property.walkability.score <= filters.maxWalkScore)) &&
      // In-zone school catchment filter
      (!filters.inZoneOnly ||
        (property.schoolZones?.some((zone) => zone.isInZone) ?? false)) &&
      (!filters.schoolZoneName ||
        (property.schoolZones?.some((zone) => zone.isInZone && zone.name.toLowerCase() === filters.schoolZoneName?.toLowerCase()) ?? false)) &&
      // Commute filter logic
      (!filters.commuteFilter ||
        !filters.commuteFilter.destinationName ||
        (() => {
          const { destinationName, maxTime, mode } = filters.commuteFilter!;
          if (!property.commuteOptions) return false;

          const matchingCommute = property.commuteOptions.find(
            (opt) => opt?.destinationName?.toLowerCase() === destinationName.toLowerCase()
          );

          if (!matchingCommute) return false;

          const travelTime = matchingCommute.travelTimes?.[mode];
          return travelTime !== undefined && travelTime <= maxTime;
        })()) &&
      (filters.maxCommuteTimeMinutes === undefined ||
        (() => {
          if (!property.commuteOptions || property.commuteOptions.length === 0) return false;
          const mode = filters.commuteMode ?? "driving";
          return property.commuteOptions.some((opt) => {
            if (filters.commuteDestination && opt.destinationName?.toLowerCase() !== filters.commuteDestination.toLowerCase()) return false;
            const time = opt.travelTimes?.[mode] ?? (opt.mode === mode ? opt.timeMinutes : undefined);
            return time !== undefined && time <= filters.maxCommuteTimeMinutes!;
          });
        })()) &&
      (!filters.commuteDestination || filters.maxCommuteTimeMinutes !== undefined ||
        (property.commuteOptions?.some((option) => option.destinationName?.toLowerCase() === filters.commuteDestination?.toLowerCase()) ?? false))
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

const styleMatchers: Array<[RegExp, ArchitecturalStyle]> = [
  [/\bmid[-_\s]?century\b/i, "Mid-Century"],
  [/\bmodern(?:ist)?\b/i, "Modernist"],
  [/\bcontemporary\b/i, "Contemporary"],
  [/\bcraftsman\b/i, "Craftsman"],
  [/\bcharacter\b/i, "Character"],
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
  const propertyType = typeMatchers.find(([matcher]) => matcher.test(query))?.[1];
  const style = styleMatchers.find(([matcher]) => matcher.test(query))?.[1];
  const floodHazards = floodHazardMatchers
    .filter(([matcher]) => matcher.test(query))
    .map(([, hazard]) => hazard);
  const noFloodHazard = /\bno\s+(?:mapped\s+)?flood\s+(?:hazards?|risks?)\b/i.test(query);
  const unsupportedFloodRating = /\b(?:low|moderate|high)\s+flood\s+risk\b/i.test(query);

  if (propertyType) filters.propertyTypes = [propertyType];
  if (style) filters.architecturalStyles = [style];
  if (floodHazards.length) filters.floodHazardTypes = floodHazards;
  else if (/\bflood\s+(?:risk|hazards?)\b/i.test(query) && !noFloodHazard && !unsupportedFloodRating) {
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

  const places = Array.from(
    new Set(properties.flatMap(({ city, region, suburb }) => [city, region, suburb])),
  ).sort((a, b) => b.length - a.length);
  const location = places.find((place) =>
    query.toLocaleLowerCase().includes(place.toLocaleLowerCase()),
  );
  if (location) filters.location = location;
  Object.assign(filters, matchCatalogDetails(query, properties));

  const bedroomsMatch = filters.bedrooms === undefined && !filters.numericCriteria?.bedrooms && query.match(
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
        : "Try adding a location, property type, mapped flood hazard, architectural style, bedroom count or budget.",
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

  return radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
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
        comps.reduce((sum, { property }) => sum + property.price, 0) / comps.length,
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

export function generateSampleNotifications(savedProperties: Property[]): PropertyNotification[] {
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
