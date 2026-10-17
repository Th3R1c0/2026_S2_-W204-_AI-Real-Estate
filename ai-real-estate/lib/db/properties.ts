import "server-only";

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from ".";
import {
  address,
  properties as propertyTable,
  propertyDetails,
  propertyDemoDetails,
  propertyImages,
  propertyPrice,
  propertySales,
  propertySchoolZones,
  propertySources,
} from "./schema";
import type {
  ArchitecturalStyle,
  FloodRisk,
  Property,
  PropertySource,
  PropertySourceField,
  PropertyType,
  SchoolZone,
  WalkabilityData,
} from "../property-types";

const propertyTypeValues: PropertyType[] = [
  "Apartment",
  "House",
  "Lifestyle block",
  "Section",
  "Townhouse",
  "Villa",
];

const styleValues: ArchitecturalStyle[] = [
  "Character",
  "Contemporary",
  "Craftsman",
  "Mid-Century",
  "Modernist",
];

const sourceFieldValues: PropertySourceField[] = [
  "address",
  "price",
  "bedrooms",
  "bathrooms",
  "landArea",
];

function asPropertyType(value: string | null, fallback: string): PropertyType {
  if (value === null) {
    switch (fallback) {
      case "apartment":
      case "unit":
        return "Apartment";
      case "house":
        return "House";
      case "lifestyle":
        return "Lifestyle block";
      case "section":
        return "Section";
      case "townhouse":
        return "Townhouse";
      case "commercial":
      case "other":
        throw new Error(
          `Cannot map database property type "${fallback}" to the current property model without display metadata.`,
        );
      default:
        throw new Error(`Unsupported database property type: ${fallback}`);
    }
  }
  if (!propertyTypeValues.includes(value as PropertyType)) {
    throw new Error(`Unsupported property type in database: ${value}`);
  }
  return value as PropertyType;
}

function asArchitecturalStyle(value: string | null): ArchitecturalStyle | undefined {
  if (value === null) return undefined;
  if (!styleValues.includes(value as ArchitecturalStyle)) {
    throw new Error(`Unsupported architectural style in database: ${value}`);
  }
  return value as ArchitecturalStyle;
}

function asFloodRisk(value: string | null): FloodRisk | undefined {
  if (value === null) return undefined;
  if (value !== "Low" && value !== "Moderate" && value !== "High") {
    throw new Error(`Unsupported flood risk in database: ${value}`);
  }
  return value;
}

function asSchoolZoneType(value: string): SchoolZone["type"] {
  if (value !== "Primary" && value !== "Intermediate" && value !== "Secondary") {
    throw new Error(`Unsupported school zone type in database: ${value}`);
  }
  return value;
}

function decimalNumber(value: string | number | null, field: string): number {
  if (value === null) throw new Error(`Missing required ${field} in database.`);
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${field} in database: ${value}`);
  return result;
}

function formatAddress(
  unitNumber: string | null,
  streetNumber: string,
  streetName: string,
): string {
  return `${unitNumber ? `${unitNumber}/` : ""}${streetNumber} ${streetName}`;
}

type PropertyStatus = "active" | "sold";

export async function getPropertiesByStatus(status: PropertyStatus): Promise<Property[]> {
  const db = getDb();
  const rows = await db
    .select({
      propertyId: propertyTable.propertyId,
      demoKey: propertyTable.demoKey,
      salePrice: propertyPrice.salePrice,
      unitNumber: address.unitNumber,
      streetNumber: address.streetNumber,
      streetName: address.streetName,
      suburb: address.suburb,
      city: address.city,
      region: address.state,
      latitude: address.latitude,
      longitude: address.longitude,
      landArea: propertyDetails.landArea,
      floorArea: propertyDetails.floorArea,
      bedrooms: propertyDetails.bedrooms,
      bathrooms: propertyDetails.bathrooms,
      yearBuilt: propertyDetails.yearBuilt,
      storedPropertyType: propertyDetails.propertyType,
      displayPropertyType: propertyDemoDetails.displayPropertyType,
      architecturalStyle: propertyDemoDetails.architecturalStyle,
      floodRisk: propertyDemoDetails.floodRisk,
      orientation: propertyDemoDetails.orientation,
      sunlightHours: propertyDemoDetails.sunlightHours,
      walkabilityScore: propertyDemoDetails.walkabilityScore,
      walkabilityLabel: propertyDemoDetails.walkabilityLabel,
      parksNearby: propertyDemoDetails.parksNearby,
      cafesNearby: propertyDemoDetails.cafesNearby,
      supermarketsNearby: propertyDemoDetails.supermarketsNearby,
    })
    .from(propertyTable)
    .innerJoin(address, eq(address.propertyId, propertyTable.propertyId))
    .innerJoin(propertyDetails, eq(propertyDetails.propertyId, propertyTable.propertyId))
    .leftJoin(propertyPrice, eq(propertyPrice.propertyId, propertyTable.propertyId))
    .leftJoin(propertyDemoDetails, eq(propertyDemoDetails.propertyId, propertyTable.propertyId))
    .where(eq(propertyTable.status, status));

  if (!rows.length) return [];
  const ids = rows.map((row) => row.propertyId);
  const [images, sources, zones] = await Promise.all([
    db
      .select()
      .from(propertyImages)
      .where(inArray(propertyImages.propertyId, ids))
      .orderBy(desc(propertyImages.isCover), propertyImages.sortOrder),
    db.select().from(propertySources).where(inArray(propertySources.propertyId, ids)),
    db.select().from(propertySchoolZones).where(inArray(propertySchoolZones.propertyId, ids)),
  ]);

  const imageByProperty = new Map<number, (typeof images)[number]>();
  for (const image of images) {
    if (!imageByProperty.has(image.propertyId)) imageByProperty.set(image.propertyId, image);
  }

  const sourcesByProperty = new Map<number, PropertySource[]>();
  for (const source of sources) {
    const fields = source.fields.filter(
      (field): field is PropertySourceField => sourceFieldValues.includes(field as PropertySourceField),
    );
    const item: PropertySource = {
      id: source.sourceKey,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      reference: source.reference,
      material: source.material,
      fields,
    };
    const items = sourcesByProperty.get(source.propertyId) ?? [];
    items.push(item);
    sourcesByProperty.set(source.propertyId, items);
  }

  const zonesByProperty = new Map<number, SchoolZone[]>();
  for (const zone of zones) {
    const items = zonesByProperty.get(zone.propertyId) ?? [];
    items.push({
      name: zone.name,
      type: asSchoolZoneType(zone.type),
      distanceKm: decimalNumber(zone.distanceKm, "school-zone distance"),
      isInZone: zone.isInZone,
    });
    zonesByProperty.set(zone.propertyId, items);
  }

  return rows.map((row) => {
    const image = imageByProperty.get(row.propertyId);
    if (!image) throw new Error(`Missing property image for database property ${row.propertyId}.`);

    let walkability: WalkabilityData | undefined;
    if (
      row.walkabilityScore !== null ||
      row.walkabilityLabel !== null ||
      row.parksNearby !== null ||
      row.cafesNearby !== null ||
      row.supermarketsNearby !== null
    ) {
      let walkabilityLabel: WalkabilityData["label"];
      if (
        row.walkabilityLabel !== null &&
        row.walkabilityLabel !== "Car-Dependent" &&
        row.walkabilityLabel !== "Somewhat Walkable" &&
        row.walkabilityLabel !== "Very Walkable" &&
        row.walkabilityLabel !== "Walker's Paradise"
      ) {
        throw new Error(`Unsupported walkability label in database: ${row.walkabilityLabel}`);
      }
      if (row.walkabilityLabel !== null) walkabilityLabel = row.walkabilityLabel;
      walkability = {
        ...(row.walkabilityScore !== null ? { score: row.walkabilityScore } : {}),
        ...(walkabilityLabel ? { label: walkabilityLabel } : {}),
        ...(row.parksNearby !== null ? { parksNearby: row.parksNearby } : {}),
        ...(row.cafesNearby !== null ? { cafesNearby: row.cafesNearby } : {}),
        ...(row.supermarketsNearby !== null
          ? { supermarketsNearby: row.supermarketsNearby }
          : {}),
      };
    }

    return {
      id: row.demoKey ?? String(row.propertyId),
      address: formatAddress(row.unitNumber, row.streetNumber, row.streetName),
      suburb: row.suburb ?? "",
      city: row.city,
      region: row.region ?? "",
      price: decimalNumber(row.salePrice, "sale price"),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      landArea: decimalNumber(row.landArea, "land area"),
      floorArea: decimalNumber(row.floorArea, "floor area"),
      yearBuilt: row.yearBuilt ?? 0,
      propertyType: asPropertyType(row.displayPropertyType, row.storedPropertyType),
      architecturalStyle: asArchitecturalStyle(row.architecturalStyle),
      floodRisk: asFloodRisk(row.floodRisk),
      ...(row.orientation ? { orientation: row.orientation } : {}),
      ...(row.sunlightHours !== null
        ? { sunlightHours: decimalNumber(row.sunlightHours, "sunlight hours") }
        : {}),
      latitude: decimalNumber(row.latitude, "latitude"),
      longitude: decimalNumber(row.longitude, "longitude"),
      image: image.url,
      imageAlt: image.caption ?? row.demoKey ?? row.streetName,
      ...(sourcesByProperty.has(row.propertyId)
        ? { sources: sourcesByProperty.get(row.propertyId) }
        : {}),
      ...(zonesByProperty.has(row.propertyId)
        ? { schoolZones: zonesByProperty.get(row.propertyId) }
        : {}),
      ...(walkability ? { walkability } : {}),
    };
  });
}

export async function getComparableSales(): Promise<Property[]> {
  const db = getDb();
  const soldProperties = await getPropertiesByStatus("sold");
  if (soldProperties.length === 0) return [];

  const databaseIds = await db
    .select({ propertyId: propertyTable.propertyId, demoKey: propertyTable.demoKey })
    .from(propertyTable)
    .where(eq(propertyTable.status, "sold"));
  const keyByDatabaseId = new Map(
    databaseIds.map(({ propertyId, demoKey }) => [propertyId, demoKey ?? String(propertyId)]),
  );
  const sales = await db
    .select()
    .from(propertySales)
    .where(inArray(propertySales.propertyId, databaseIds.map(({ propertyId }) => propertyId)))
    .orderBy(desc(propertySales.soldDate));
  const saleByKey = new Map<string, { soldDate: string; soldPrice: number }>();
  for (const sale of sales) {
    const key = keyByDatabaseId.get(sale.propertyId);
    if (key && !saleByKey.has(key)) {
      saleByKey.set(key, {
        soldDate: sale.soldDate,
        soldPrice: decimalNumber(sale.soldPrice, "sold price"),
      });
    }
  }
  return soldProperties.flatMap((property) => {
    const sale = saleByKey.get(property.id);
    return sale ? [{ ...property, price: sale.soldPrice, soldDate: sale.soldDate }] : [];
  });
}
