import type {
  ArchitecturalStyle,
  Property,
  PropertyFilters,
  PropertyType,
} from "./property-types";

export function filterProperties(
  properties: Property[],
  filters: PropertyFilters,
): Property[] {
  const location = filters.location?.toLocaleLowerCase();

  return properties.filter((property) => {
    const propertyLocation = [property.address, property.suburb, property.city, property.region]
      .join(" ")
      .toLocaleLowerCase();

    return (
      (!filters.propertyTypes?.length ||
        filters.propertyTypes.includes(property.propertyType)) &&
      (!filters.architecturalStyles?.length ||
        filters.architecturalStyles.includes(property.architecturalStyle)) &&
      (!filters.floodRisks?.length || filters.floodRisks.includes(property.floodRisk)) &&
      (!location || propertyLocation.includes(location)) &&
      (filters.maxPrice === undefined || property.price <= filters.maxPrice) &&
      (filters.minPrice === undefined || property.price >= filters.minPrice) &&
      (filters.bedrooms === undefined || property.bedrooms === filters.bedrooms) &&
      (filters.yearBuiltFrom === undefined || property.yearBuilt >= filters.yearBuiltFrom) &&
      (filters.yearBuiltTo === undefined || property.yearBuilt <= filters.yearBuiltTo) &&
      (!filters.northFacingOnly || property.orientation === "North")
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
  [/\bmid[- ]?century\b/i, "Mid-Century"],
  [/\bmodern(?:ist)?\b/i, "Modernist"],
  [/\bcontemporary\b/i, "Contemporary"],
  [/\bcraftsman\b/i, "Craftsman"],
  [/\bcharacter\b/i, "Character"],
];

const wordNumbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function parsePriceAmount(raw: string, suffix?: string): number {
  const numeric = Number(raw.replaceAll(",", ""));
  if (suffix?.toLocaleLowerCase() === "k") return numeric * 1_000;
  if (suffix?.toLocaleLowerCase() === "m") return numeric * 1_000_000;
  return numeric;
}

export function parseNaturalLanguageSearch(
  query: string,
  properties: Property[],
): {
  status: "ready" | "needs-clarification";
  filters: PropertyFilters;
  message: string;
} {
  const filters: PropertyFilters = {};
  const propertyType = typeMatchers.find(([matcher]) => matcher.test(query))?.[1];
  const style = styleMatchers.find(([matcher]) => matcher.test(query))?.[1];

  if (propertyType) filters.propertyTypes = [propertyType];
  if (style) filters.architecturalStyles = [style];

  const places = Array.from(
    new Set(properties.flatMap(({ city, region, suburb }) => [city, region, suburb])),
  ).sort((a, b) => b.length - a.length);
  const location = places.find((place) =>
    query.toLocaleLowerCase().includes(place.toLocaleLowerCase()),
  );
  if (location) filters.location = location;

  const priceMatch = query.match(
    /(?:under|below|up to|maximum|max)\s*\$?([\d,.]+)\s*([km])?/i,
  );
  if (priceMatch) filters.maxPrice = parsePriceAmount(priceMatch[1], priceMatch[2]);

  const bedroomsMatch = query.match(
    /\b(one|two|three|four|five|six|\d+)\s*[- ]?bed(?:room)?s?\b/i,
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
      message:
        "Try adding a location, property type, architectural style, bedroom count or budget.",
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
