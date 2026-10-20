export type PropertyType =
  "Villa" | "Townhouse" | "Apartment" | "House" | "Lifestyle block" | "Section";

export type ArchitecturalStyle =
  "Character" | "Modernist" | "Contemporary" | "Craftsman" | "Mid-Century";

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
  "address" | "price" | "bedrooms" | "bathrooms" | "landArea";

export type PropertySource = {
  id: string;
  title: string;
  publisher: string;
  reference: string;
  material: string;
  url: string;
  fields: PropertySourceField[];
};

export type ListingAgent = {
  name: string;
  source: "OneRoof";
  contactUrl: string;
  phone?: string;
  email?: string;
};

export type OpenHome = {
  date: string;
  startTime: string;
  endTime: string;
  label: string;
};

export type SchoolZone = {
  schoolId?: number;
  schoolName?: string;
  schoolType?: string;
  zoneName?: string;
  zoneType?: string;
  name?: string;
  type?: string;
  distanceKm?: number;
  isInZone?: boolean;
};

export type NearbySchool = {
  schoolId: number;
  latitude?: number;
  longitude?: number;
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
  saleType?: string;
};

export type ValuationRecord = {
  date: string;
  value: number;
  source: string;
  kind?: "avm" | "rv";
  capitalValue?: number;
  landValue?: number;
  improvementValue?: number;
  lowEstimate?: number;
  medianEstimate?: number;
  highEstimate?: number;
  changePercent?: number;
};

export type AvmHistoryPoint = {
  date: string;
  value: number;
  suburbMedian?: number;
};

export type PropertyHistoryEvent = {
  type: "list" | "cv" | "sale" | "build" | string;
  date: string;
  label: string;
  value?: string | number;
  detail?: string;
};

export type Property = {
  id: string;
  address: string;
  suburb: string;
  city: string;
  region: string;
  price: number;
  saleMethod?: string;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  floorArea: number;
  yearBuilt: number;
  propertyType: PropertyType;
  architecturalStyle?: ArchitecturalStyle;
  floodRisk?: FloodRisk;
  floodHazards?: PropertyFloodHazard[];
  openHomes?: OpenHome[];
  latitude: number;
  longitude: number;
  image: string;
  imageAlt: string;
  imageSourceUrl?: string;
  listingAgent?: ListingAgent;
  photoGallery?: string[];
  parkingSpaces?: number;
  capitalValue?: number;
  landValue?: number;
  improvementValue?: number;
  valuationDate?: string;
  rateableValueChange?: number | string;
  estimateLow?: number;
  estimateMedian?: number;
  estimateHigh?: number;
  estimateConfidence?: string;
  estimatedWeeklyRent?: number;
  ownershipType?: string;
  titleNumber?: string;
  legalDescription?: string;
  estateDescription?: string;
  unitaryPlanZone?: string;
  contour?: string;
  construction?: string;
  condition?: string;
  council?: string;
  soldDate?: string;
  teaser?: string;
  summary?: string;
  sources?: PropertySource[];
  schoolZones?: SchoolZone[];
  nearbySchools?: NearbySchool[];
  schoolDataSynced?: boolean;
  commuteOptions?: CommuteOption[];
  pastSales?: PastSale[];
  valuationHistory?: ValuationRecord[];
  avmHistory?: AvmHistoryPoint[];
  propertyHistory?: PropertyHistoryEvent[];
  notifications?: PropertyNotification[];
};

export type ComparableSale = {
  property: Pick<
    Property,
    "id" | "address" | "bedrooms" | "floorArea" | "price" | "soldDate"
  >;
  distanceKm: number;
};

export type ComparableSalesResult = {
  comps: ComparableSale[];
  averagePrice: number;
};

export type PropertyFilters = {
  propertyTypes?: PropertyType[];
  architecturalStyles?: ArchitecturalStyle[];
  floodHazardTypes?: FloodHazardType[];
  noMappedFloodHazard?: boolean;
  hasOpenHome?: boolean;
  yearBuiltFrom?: number;
  yearBuiltTo?: number;
  inZoneOnly?: boolean;
  hasNearbySchool?: boolean;
  nearbySchoolType?: string;
  schoolId?: number;
  schoolSearchMode?: "zone" | "nearby";
  maxCommuteTimeMinutes?: number;
  commuteMode?: "driving" | "transit" | "walking";
  location?: string;
  maxPrice?: number;
  minPrice?: number;
  bedrooms?: number;
  numericCriteria?: Partial<Record<NumericSearchField, NumericCriterion>>;
  ownershipTypes?: string[];
  schoolZoneName?: string;
  commuteDestination?: string;
  commuteFilter?: {
    destinationName: string;
    maxTimeMinutes?: number;
    maxTime: number;
    mode: "driving" | "transit" | "walking";
  };
};

export type NumericSearchField =
  | "bedrooms"
  | "bathrooms"
  | "parkingSpaces"
  | "landArea"
  | "floorArea"
  | "estimatedWeeklyRent"
  | "capitalValue";

export type NumericCriterion = {
  min?: number;
  max?: number;
  minExclusive?: boolean;
  maxExclusive?: boolean;
};
