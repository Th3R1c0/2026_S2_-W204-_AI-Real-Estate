import snapshot from "../reports/auckland-property-snapshot.json";
import type { Property, PropertySource, PropertySourceField } from "./property-types";

type SnapshotSource = {
  status: string;
  url?: string;
  estimate?: { low?: string | null; medium?: string | null; high?: string | null };
};

const valuePreference = ["RealEstate", "Homes", "OneRoof", "PropertyValue", "QV"] as const;
const researchUrl = "https://github.com/Sakyawira/auckland-house-prices";

function amount(value?: string | null): number | null {
  if (!value) return null;
  const match = /^\$([\d,.]+)\s*([KM])?$/i.exec(value.trim());
  if (!match) return null;
  const multiplier = match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "K" ? 1_000 : 1;
  return Math.round(Number(match[1].replaceAll(",", "")) * multiplier);
}

function matchedSources(house: (typeof snapshot.houses)[number]): Array<[string, SnapshotSource]> {
  return Object.entries(house.sources).filter((entry): entry is [string, SnapshotSource] => {
    const source = entry[1] as SnapshotSource;
    return source.status === "matched" && Boolean(source.url);
  });
}

function toProperty(house: (typeof snapshot.houses)[number]): Property {
  const [address, suburb, city] = house.address.split(", ");
  const available = matchedSources(house);
  const preferred = valuePreference
    .map((name) => available.find(([sourceName]) => sourceName === name))
    .find((entry) => entry && amount(entry[1].estimate?.medium) !== null);
  if (!preferred) throw new Error(`No matched indicative value for ${house.address}`);
  const price = amount(preferred[1].estimate?.medium)!;
  const sources: PropertySource[] = [
    {
      id: `linz-${house.addressId}`,
      title: "NZ Addresses",
      publisher: "Land Information New Zealand",
      url: "https://data.linz.govt.nz/layer/123113-nz-addresses/",
      reference: `Current address ID ${house.addressId}`,
      material: `LINZ records ${house.address} as a current address with mapped coordinates.`,
      fields: ["address"],
    },
    {
      id: "auckland-housing-2020",
      title: "Auckland House Prices research dataset",
      publisher: "Sakyawira Nanda Ruslim",
      url: researchUrl,
      reference: "2020 research dataset",
      material: `Historical council value: $${house.historicalCv.toLocaleString("en-NZ")}. Bedroom, bathroom and land area figures are from the same older dataset.`,
      fields: ["bedrooms", "bathrooms", "landArea"],
    },
    ...available.map(([name, source]) => ({
      id: name.toLowerCase(),
      title: `${name} property estimate`,
      publisher: name,
      url: source.url!,
      reference: `One-time snapshot, ${snapshot.collectedAt.slice(0, 10)}`,
      material: `Indicative estimate: ${source.estimate?.medium ?? "not available"}. Range: ${source.estimate?.low ?? "unknown"} to ${source.estimate?.high ?? "unknown"}. This is a website estimate, not an asking price.`,
      fields: name === preferred[0] ? (["price"] as PropertySourceField[]) : [],
    })),
  ];

  return {
    id: `linz-${house.addressId}`,
    address,
    suburb,
    city,
    region: "Auckland",
    price,
    bedrooms: house.bedrooms,
    bathrooms: house.bathrooms,
    landArea: house.landArea,
    floorArea: 0,
    yearBuilt: 0,
    propertyType: "House",
    latitude: house.latitude,
    longitude: house.longitude,
    image: "/properties/address-placeholder.svg",
    imageAlt: `Illustration for ${house.address}; no property photograph supplied`,
    sources,
  };
}

export const properties: Property[] = snapshot.houses.map(toProperty);
export const comparableSales: Property[] = [];
