export type PropertyType =
  | "Villa"
  | "Townhouse"
  | "Apartment"
  | "House"
  | "Lifestyle block"
  | "Section";

export type ArchitecturalStyle =
  | "Character"
  | "Modernist"
  | "Contemporary"
  | "Craftsman"
  | "Mid-Century";

export type FloodRisk = "Low" | "Moderate" | "High";

export type PropertySourceField =
  | "address"
  | "price"
  | "bedrooms"
  | "bathrooms"
  | "landArea";

export type PropertySource = {
  id: string;
  title: string;
  publisher: string;
  reference: string;
  material: string;
  url: string;
  fields: PropertySourceField[];
};

export type SchoolZone = {
  name: string;
  type: "Primary" | "Intermediate" | "Secondary";
  distanceKm: number;
  isInZone: boolean;
};

export type WalkabilityProfile = {
  score?: number;
  label?: string;
  parksNearby?: number;
  cafesNearby?: number;
  supermarketsNearby?: number;
};

export type CommuteOption = {
  destinationName?: string;
  mode: "driving" | "transit" | "walking";
  timeMinutes?: number;
  travelTimes?: Record<string, number>;
};

export type PropertyNotification = {
  id: string;
  propertyId: string;
  propertyAddress: string;
  type: "price_drop" | "status_update" | "open_home";
  title: string;
  message: string;
  date: string;
  read: boolean;
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
  architecturalStyle?: ArchitecturalStyle;
  floodRisk?: FloodRisk;
  orientation?: "North" | "South" | "East" | "West";
  sunlightHours?: number;
  latitude: number;
  longitude: number;
  image: string;
  imageAlt: string;
  soldDate?: string;
  sources?: PropertySource[];
  schoolZones?: SchoolZone[];
  walkability?: WalkabilityProfile;
  commuteOptions?: CommuteOption[];
  pastSales?: PastSale[];
  valuationHistory?: ValuationRecord[];
};

export type PropertyFilters = {
  propertyTypes?: PropertyType[];
  architecturalStyles?: ArchitecturalStyle[];
  floodRisks?: FloodRisk[];
  northFacingOnly?: boolean;
  yearBuiltFrom?: number;
  yearBuiltTo?: number;
  minWalkScore?: number;
  inZoneOnly?: boolean;
  maxCommuteTimeMinutes?: number;
  commuteMode?: "driving" | "transit" | "walking";
  location?: string;
  maxPrice?: number;
  minPrice?: number;
  bedrooms?: number;
  commuteFilter?: {
    destinationName: string;
    maxTimeMinutes?: number;
    maxTime: number;
    mode: "driving" | "transit" | "walking";
  };
};