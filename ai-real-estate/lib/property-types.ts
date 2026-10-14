export type PropertyType =
  | "Apartment"
  | "House"
  | "Lifestyle block"
  | "Commercial"
  | "Other"
  | "Section"
  | "Townhouse"
  | "Unit"
  | "Villa";

export type ArchitecturalStyle =
  | "Character"
  | "Contemporary"
  | "Craftsman"
  | "Mid-Century"
  | "Modernist";

export type FloodRisk = "Low" | "Moderate" | "High";

export type Property = {
  id: string;
  address: string;
  title?: string;
  description?: string | null;
  suburb: string | null;
  city: string;
  region: string | null;
  postCode?: string | null;
  country?: string;
  price: number | null;
  currency?: string;
  listingType?: "sale" | "rent" | "lease";
  rentPeriod?: "week" | "fortnight" | "month" | null;
  pricingMethod?: string;
  status?: string;
  listedAt?: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  landArea: number | null;
  floorArea: number | null;
  yearBuilt: number | null;
  propertyType: PropertyType | null;
  architecturalStyle: ArchitecturalStyle | null;
  floodRisk: FloodRisk | null;
  orientation: "North" | "East" | "South" | "West" | null;
  sunlightHours: number | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  imageAlt: string;
  soldDate?: string;
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
};
