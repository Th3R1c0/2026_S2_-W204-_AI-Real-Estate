export type PropertyType =
  | "Apartment"
  | "House"
  | "Lifestyle block"
  | "Section"
  | "Townhouse"
  | "Villa";

export type ArchitecturalStyle =
  | "Character"
  | "Contemporary"
  | "Craftsman"
  | "Mid-Century"
  | "Modernist";

export type FloodRisk = "Low" | "Moderate" | "High";

export type SchoolZone = {
  name: string;
  type: "Primary" | "Intermediate" | "Secondary";
  distanceKm: number;
  isInZone: boolean;
};

export type WalkabilityData = {
  score: number; // 0 to 100
  label: "Car-Dependent" | "Somewhat Walkable" | "Very Walkable" | "Walker's Paradise";
  parksNearby: number;
  cafesNearby: number;
  supermarketsNearby: number;
};

export type Property = {
  id: string;
  address: string;
  suburb: string;
  city: string;
  region: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  floorArea: number;
  yearBuilt: number;
  propertyType: PropertyType;
  architecturalStyle: ArchitecturalStyle;
  floodRisk: FloodRisk;
  orientation: "North" | "East" | "South" | "West";
  sunlightHours: number;
  latitude: number;
  longitude: number;
  image: string;
  imageAlt: string;
  soldDate?: string;
  // Family & Lifestyle Features
  walkability?: WalkabilityData;
  schoolZones?: SchoolZone[];
};

export type PropertyFilters = {
  propertyTypes?: PropertyType[];
  architecturalStyles?: ArchitecturalStyle[];
  floodRisks?: FloodRisk[];
  location?: string;
  maxPrice?: number;
  minPrice?: number;
  bedrooms?: number;
  yearBuiltFrom?: number;
  yearBuiltTo?: number;
  northFacingOnly?: boolean;
  // Family & Lifestyle Filters
  minWalkScore?: number;
  inZoneOnly?: boolean;
};