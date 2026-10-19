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
export type FloodHazardType =
  | "flood_plains"
  | "flood_prone_areas"
  | "overland_flow_paths"
  | "coastal_inundation";

export type PropertyFloodHazard = {
  type: FloodHazardType;
  sourceFeatureId: string;
  sourceUrl: string;
};

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
  schoolId: number;
  schoolName: string;
  schoolType: string;
  zoneName?: string;
  zoneType?: string;
};

export type NearbySchool = {
  schoolId: number;
  name: string;
  orgType: string;
  distanceKm: number;
  hasEnrolmentZone: boolean;
  hasZoneGeometry: boolean;
};

export type SchoolOption = {
  schoolId: number;
  name: string;
  orgType: string;
  hasEnrolmentZone: boolean;
  hasZoneGeometry?: boolean;
  hasCoordinates?: boolean;
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

export type PastSale = {
  date: string;
  price: number;
  source: string;
  saleType?: "Auction" | "Private Sale" | "Deadline Treaty";
};

export type ValuationRecord = {
  date: string;
  value: number;
  source: string;
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
  floodHazards?: PropertyFloodHazard[];
  orientation?: "North" | "South" | "East" | "West";
  sunlightHours?: number;
  latitude: number;
  longitude: number;
  image: string;
  imageAlt: string;
  soldDate?: string;
  sources?: PropertySource[];
  schoolZones?: SchoolZone[];
  nearbySchools?: NearbySchool[];
  schoolDataSynced?: boolean;
  walkability?: WalkabilityProfile;
  commuteOptions?: CommuteOption[];
  pastSales?: PastSale[];
  valuationHistory?: ValuationRecord[];
  notifications?: PropertyNotification[];
};

export type PropertyFilters = {
  propertyTypes?: PropertyType[];
  architecturalStyles?: ArchitecturalStyle[];
  floodHazardTypes?: FloodHazardType[];
  noMappedFloodHazard?: boolean;
  northFacingOnly?: boolean;
  yearBuiltFrom?: number;
  yearBuiltTo?: number;
  minWalkScore?: number;
  inZoneOnly?: boolean;
  nearbySchoolType?: string;
  schoolId?: number;
  schoolSearchMode?: "zone" | "nearby";
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
