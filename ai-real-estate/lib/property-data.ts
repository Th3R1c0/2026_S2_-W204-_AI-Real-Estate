import addressSnapshot from "../reports/auckland-property-snapshot.json";
import directSnapshot from "../reports/auckland-direct-sources.json";
import type { Property, PropertySource, PropertySourceField } from "./property-types";

type DirectSource = {
  status: string;
  url?: string;
  estimate?: { low?: number | null; medium?: number | null; high?: number | null };
  facts?: Record<string, string | number | boolean | null>;
  images?: string[];
};

const directById = new Map(directSnapshot.houses.map(house => [house.addressId, house]));
const sourceOrder = ["RealEstate", "Homes", "PropertyValue", "OneRoof", "QV"];

function toProperty(house: (typeof addressSnapshot.houses)[number]): Property {
  const direct = directById.get(house.addressId);
  if (!direct) throw new Error(`Missing direct-source record for ${house.address}`);
  const sourceMap = direct.sources as Record<string, DirectSource>;
  const matched = sourceOrder.map(name => [name, sourceMap[name]] as const).filter(([,source]) => source?.status === "matched");
  const value = matched.find(([,source]) => source.estimate?.medium);
  if (!value?.[1].estimate?.medium) throw new Error(`No direct indicative value for ${house.address}`);
  const fact = (field: string) => matched.map(([,source]) => source.facts?.[field]).find(value => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return field === "landArea" ? value >= 10 : value > 0;
    return true;
  });
  const numericFact = (field: string, fallback = 0) => {
    const value = fact(field);
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const photo = matched.find(([,source]) => source.images?.length);
  const image = photo?.[1].images?.[0] ?? "/properties/address-placeholder.svg";
  const saleSource = matched.find(([,source]) => typeof source.facts?.lastSalePrice === "number" && typeof source.facts?.lastSaleDate === "string");
  const dateParts = String(saleSource?.[1].facts?.lastSaleDate ?? "").split("/");
  const saleDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2,"0")}-${dateParts[0].padStart(2,"0")}` : null;
  const sources: PropertySource[] = [
    {
      id: `linz-${house.addressId}`, title: "NZ Addresses", publisher: "Land Information New Zealand",
      url: "https://data.linz.govt.nz/layer/123113-nz-addresses/", reference: `Address ID ${house.addressId}`,
      material: `Current verified address and coordinates: ${house.latitude}, ${house.longitude}.`, fields: ["address"],
    },
    ...matched.map(([name,source]) => {
      const fields: PropertySourceField[] = [];
      if (name === value[0]) fields.push("price");
      for (const [field,sourceField] of [["bedrooms","bedrooms"],["bathrooms","bathrooms"],["landArea","landArea"]] as const) {
        if (source.facts?.[field] === fact(field)) fields.push(sourceField);
      }
      const range = source.estimate;
      return {
        id: name.toLowerCase(), title: `${name} public property page`, publisher: name, url: source.url!,
        reference: `Direct page snapshot ${directSnapshot.collectedAt.slice(0,10)}`,
        material: `Indicative estimate ${range?.medium ? "$" + range.medium.toLocaleString("en-NZ") : "unavailable"}; range ${range?.low ? "$" + range.low.toLocaleString("en-NZ") : "unknown"}–${range?.high ? "$" + range.high.toLocaleString("en-NZ") : "unknown"}. ${source.images?.length ?? 0} photo URL(s) found.`,
        fields,
      };
    }),
  ];
  if (!fact("bedrooms") || !fact("bathrooms") || !fact("landArea")) sources.push({
    id: "auckland-housing-2020",title: "Auckland House Prices research dataset",publisher: "Sakyawira Nanda Ruslim",
    url: "https://github.com/Sakyawira/auckland-house-prices",reference: "2020 research data",
    material: "Historical fallback for property facts missing from direct pages.",
    fields: [!fact("bedrooms") && "bedrooms",!fact("bathrooms") && "bathrooms",!fact("landArea") && "landArea"].filter(Boolean) as PropertySourceField[],
  });
  const [address,suburb,city] = house.address.split(", ");
  return {
    id: `linz-${house.addressId}`,address,suburb,city,region:"Auckland",price:value[1].estimate.medium,
    bedrooms:numericFact("bedrooms",house.bedrooms),bathrooms:numericFact("bathrooms",house.bathrooms),
    landArea:numericFact("landArea",house.landArea),floorArea:numericFact("floorArea"),yearBuilt:numericFact("yearBuilt"),
    propertyType:"House",latitude:house.latitude,longitude:house.longitude,
    image,imageAlt:`Photo of ${house.address} from ${photo?.[0] ?? "source website"}`,
    imageSourceUrl:photo?.[1].url,photoGallery:photo?.[1].images ?? [],
    parkingSpaces:numericFact("parkingSpaces"),capitalValue:numericFact("capitalValue"),
    estimatedWeeklyRent:numericFact("estimatedWeeklyRent"),ownershipType:typeof fact("ownershipType") === "string" ? fact("ownershipType") as string : undefined,
    pastSales:saleSource && saleDate ? [{date:saleDate,price:saleSource[1].facts?.lastSalePrice as number,source:saleSource[0]}] : [],
    sources,
  };
}

import forSaleListings from "../reports/forsale-properties.json";

export const aucklandProperties: Property[] = addressSnapshot.houses.map(toProperty);
export const forSaleProperties: Property[] = forSaleListings as Property[];
export const properties: Property[] = forSaleProperties;
export const comparableSales: Property[] = [];
