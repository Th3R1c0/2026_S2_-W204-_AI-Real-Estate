import type { Property, PropertyFilters } from "../../lib/property-types";

export const evaluationHome: Property = {
  id: "evaluation-house",
  address: "10 Example Street",
  suburb: "Ponsonby",
  city: "Auckland",
  region: "Auckland",
  price: 1_100_000,
  bedrooms: 4,
  bathrooms: 2,
  parkingSpaces: 4,
  landArea: 800,
  floorArea: 220,
  yearBuilt: 2010,
  propertyType: "House",
  ownershipType: "Freehold",
  capitalValue: 1_200_000,
  estimatedWeeklyRent: 900,
  floodHazards: [],
  schoolZones: [
    { schoolId: 54, schoolName: "Auckland Grammar School", isInZone: true },
  ],
  nearbySchools: [
    {
      schoolId: 54,
      name: "Auckland Grammar School",
      orgType: "Secondary",
      distanceKm: 1,
      hasEnrolmentZone: true,
      hasZoneGeometry: true,
    },
  ],
  openHomes: [
    {
      date: "2026-10-25",
      startTime: "12:00",
      endTime: "12:30",
      label: "Sunday viewing",
    },
  ],
  latitude: -36.85,
  longitude: 174.74,
  image: "/properties/test.jpg",
  imageAlt: "Evaluation house",
};

// Announced to the user before evaluation. Literal expectations are independent of the interpreter.
export const complexSearches: Array<{
  query: string;
  expected: PropertyFilters;
  home: Partial<Property>;
}> = [
  {
    query:
      "A house in Auckland under $1.5m with enough room for 4 cars, at least 3 bedrooms and 2 bathrooms.",
    expected: {
      propertyTypes: ["House"],
      location: "Auckland",
      maxPrice: 1_499_999.99,
      numericCriteria: {
        parkingSpaces: { min: 4 },
        bedrooms: { min: 3 },
        bathrooms: { min: 2, max: 2 },
      },
    },
    home: {},
  },
  {
    query:
      "A house or townhouse in Ponsonby between $900k and $1.8m, with 3 to 4 bedrooms and at least 2 bathrooms.",
    expected: {
      propertyTypes: ["Townhouse", "House"],
      location: "Ponsonby",
      minPrice: 900_000,
      maxPrice: 1_800_000,
      numericCriteria: { bedrooms: { min: 3, max: 4 }, bathrooms: { min: 2 } },
    },
    home: { propertyType: "Townhouse" },
  },
  {
    query:
      "A contemporary house built between 2005 and 2020, at least 600 m² of land and 180 m² of floor area.",
    expected: {
      propertyTypes: ["House"],
      yearBuiltFrom: 2005,
      yearBuiltTo: 2020,
      numericCriteria: { landArea: { min: 600 }, floorArea: { min: 180 } },
    },
    home: {},
  },
  {
    query:
      "A character villa built before 1940, exactly 4 bedrooms, at least 2 bathrooms and no mapped flood hazards.",
    expected: {
      propertyTypes: ["Villa"],
      yearBuiltTo: 1939,
      bedrooms: 4,
      noMappedFloodHazard: true,
      floodRisk: "exclude_low",
      numericCriteria: { bathrooms: { min: 2 } },
    },
    home: {
      propertyType: "Villa",
      yearBuilt: 1920,
    },
  },
  {
    query:
      "A freehold house with at least 600 m² of land, 180 m² of floor area and parking for 2 cars.",
    expected: {
      propertyTypes: ["House"],
      ownershipTypes: ["Freehold"],
      numericCriteria: {
        landArea: { min: 600 },
        floorArea: { min: 180 },
        parkingSpaces: { min: 2 },
      },
    },
    home: {},
  },
  {
    query:
      "An apartment under $850k, no more than 2 bedrooms, exactly 1 bathroom and at least 1 parking space.",
    expected: {
      propertyTypes: ["Apartment"],
      maxPrice: 849_999.99,
      numericCriteria: {
        bedrooms: { max: 2 },
        bathrooms: { min: 1, max: 1 },
        parkingSpaces: { min: 1 },
      },
    },
    home: {
      propertyType: "Apartment",
      price: 800_000,
      bedrooms: 2,
      bathrooms: 1,
    },
  },
  {
    query:
      "A house near a school, with 4 or more bedrooms, at least 2 bathrooms and an open home.",
    expected: {
      propertyTypes: ["House"],
      hasNearbySchool: true,
      hasOpenHome: true,
      numericCriteria: { bedrooms: { min: 4 }, bathrooms: { min: 2 } },
    },
    home: {},
  },
  {
    query:
      "A lifestyle block with at least 2,000 m² of land, floor area over 200 m², built after 1990 and space for 4 cars.",
    expected: {
      propertyTypes: ["Lifestyle block"],
      yearBuiltFrom: 1991,
      numericCriteria: {
        landArea: { min: 2000 },
        floorArea: { min: 200, minExclusive: true },
        parkingSpaces: { min: 4 },
      },
    },
    home: { propertyType: "Lifestyle block", landArea: 2500 },
  },
  {
    query:
      "A house between $800k and $1.4m, capital value at least $1m, estimated weekly rent at least $800, 3 bedrooms and 2 bathrooms.",
    expected: {
      propertyTypes: ["House"],
      minPrice: 800_000,
      maxPrice: 1_400_000,
      bedrooms: 3,
      numericCriteria: {
        capitalValue: { min: 1_000_000 },
        estimatedWeeklyRent: { min: 800 },
        bathrooms: { min: 2, max: 2 },
      },
    },
    home: { bedrooms: 3 },
  },
];
