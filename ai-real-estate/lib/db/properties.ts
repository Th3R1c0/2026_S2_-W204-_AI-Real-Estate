import "server-only";

import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from ".";
import {
  address,
  floodHazardSync,
  openHomes,
  properties as propertyTable,
  propertyDetails,
  propertyFloodHazards,
  propertyImages,
  propertyPrice,
  propertySales,
  propertySources,
  schoolDataSync,
  schools as schoolsTable,
} from "./schema";
import { findComparableSales } from "../property-engine";
import type {
  ArchitecturalStyle,
  ComparableSalesResult,
  NearbySchool,
  OpenHome,
  Property,
  PropertySource,
  PropertySourceField,
  PropertyType,
  SchoolOption,
  SchoolZone,
} from "../property-types";
import { SCHOOL_NEARBY_RADIUS_METRES } from "../school-data";

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

function asPropertyType(value: string | null | undefined, fallback: string): PropertyType {
  if (!value) {
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
      default:
        return "House";
    }
  }
  if (!propertyTypeValues.includes(value as PropertyType)) {
    return "House";
  }
  return value as PropertyType;
}

function asArchitecturalStyle(value: string | null | undefined): ArchitecturalStyle | undefined {
  if (!value) return undefined;
  if (!styleValues.includes(value as ArchitecturalStyle)) {
    return undefined;
  }
  return value as ArchitecturalStyle;
}

function decimalNumber(value: string | number | null | undefined, field: string): number {
  if (value === null || value === undefined) throw new Error(`Missing required ${field} in database.`);
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${field} in database: ${value}`);
  return result;
}

function formatAddress(
  unitNumber: string | null,
  streetNumber: string,
  streetName: string,
): string {
  return `${unitNumber ? `${unitNumber}/` : ""}${streetNumber} ${streetName}`.trim();
}

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type PropertyStatus = "active" | "sold";

async function getPropertySchoolData(
  propertyCoords: Array<{ propertyId: number; latitude: number; longitude: number }>,
): Promise<{
  synced: boolean;
  nearbyByProperty: Map<number, NearbySchool[]>;
  zonesByProperty: Map<number, SchoolZone[]>;
}> {
  const db = getDb();
  try {
    const syncRows = await db
      .select({ singletonId: schoolDataSync.singletonId })
      .from(schoolDataSync)
      .limit(1);
    if (syncRows.length === 0) {
      return {
        synced: false,
        nearbyByProperty: new Map(),
        zonesByProperty: new Map(),
      };
    }

    const allSchools = await db
      .select({
        schoolId: schoolsTable.schoolId,
        name: schoolsTable.orgName,
        orgType: schoolsTable.orgType,
        latitude: schoolsTable.latitude,
        longitude: schoolsTable.longitude,
        hasEnrolmentZone: schoolsTable.enrolmentScheme,
        hasZoneGeometry: sql<boolean>`EXISTS (
          SELECT 1 FROM school_zones
          WHERE school_zones.school_id = ${schoolsTable.schoolId}
        )`,
      })
      .from(schoolsTable);

    const maxRadiusKm = SCHOOL_NEARBY_RADIUS_METRES / 1000;
    const nearbyByProperty = new Map<number, NearbySchool[]>();
    const zonesByProperty = new Map<number, SchoolZone[]>();

    for (const prop of propertyCoords) {
      const nearby: NearbySchool[] = [];
      for (const school of allSchools) {
        if (school.latitude === null || school.longitude === null) continue;
        const sLat = Number(school.latitude);
        const sLng = Number(school.longitude);
        if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;
        const distKm = haversineDistanceKm(prop.latitude, prop.longitude, sLat, sLng);
        if (distKm <= maxRadiusKm) {
          nearby.push({
            schoolId: school.schoolId,
            latitude: sLat,
            longitude: sLng,
            name: school.name,
            orgType: school.orgType,
            distanceKm: Math.round(distKm * 100) / 100,
            hasEnrolmentZone: school.hasEnrolmentZone,
            hasZoneGeometry: Boolean(school.hasZoneGeometry),
          });
        }
      }
      nearby.sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
      nearbyByProperty.set(prop.propertyId, nearby);
      zonesByProperty.set(
        prop.propertyId,
        nearby
          .filter((s) => s.hasEnrolmentZone && s.distanceKm <= 1.8)
          .map((s) => ({
            schoolId: s.schoolId,
            schoolName: s.name,
            schoolType: s.orgType,
            zoneName: `${s.name} Zone`,
            zoneType: s.orgType,
            isInZone: true,
          })),
      );
    }

    return { synced: true, nearbyByProperty, zonesByProperty };
  } catch {
    return {
      synced: false,
      nearbyByProperty: new Map(),
      zonesByProperty: new Map(),
    };
  }
}

export async function getAucklandSchoolOptions(): Promise<{
  synced: boolean;
  schools: SchoolOption[];
}> {
  const db = getDb();
  try {
    const [syncRows, schoolRows] = await Promise.all([
      db.select({ singletonId: schoolDataSync.singletonId }).from(schoolDataSync).limit(1),
      db
        .select({
          schoolId: schoolsTable.schoolId,
          name: schoolsTable.orgName,
          orgType: schoolsTable.orgType,
          hasEnrolmentZone: schoolsTable.enrolmentScheme,
          hasCoordinates: sql<boolean>`${schoolsTable.latitude} IS NOT NULL AND ${schoolsTable.longitude} IS NOT NULL`,
          hasZoneGeometry: sql<boolean>`EXISTS (
            SELECT 1 FROM school_zones
            WHERE school_zones.school_id = ${schoolsTable.schoolId}
          )`,
        })
        .from(schoolsTable)
        .orderBy(schoolsTable.orgName),
    ]);
    return {
      synced: syncRows.length > 0,
      schools: syncRows.length > 0 ? schoolRows : [],
    };
  } catch {
    return { synced: false, schools: [] };
  }
}

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
      garageParking: propertyDetails.garageParking,
      offStreetParking: propertyDetails.offStreetParking,
      yearBuilt: propertyDetails.yearBuilt,
      storedPropertyType: propertyDetails.propertyType,
      displayPropertyType: propertyDetails.displayPropertyType,
      architecturalStyle: propertyDetails.architecturalStyle,
      orientation: propertyDetails.orientation,
      sunlightHours: propertyDetails.sunlightHours,
      capitalValue: propertyDetails.capitalValue,
      estimatedWeeklyRent: propertyDetails.estimatedWeeklyRent,
      ownershipType: propertyDetails.ownershipType,
      saleMethod: propertyDetails.saleMethod,
      imageSourceUrl: propertyDetails.imageSourceUrl,
      agentName: propertyDetails.agentName,
      agentSource: propertyDetails.agentSource,
      agentContactUrl: propertyDetails.agentContactUrl,
    })
    .from(propertyTable)
    .innerJoin(address, eq(address.propertyId, propertyTable.propertyId))
    .innerJoin(propertyDetails, eq(propertyDetails.propertyId, propertyTable.propertyId))
    .leftJoin(propertyPrice, eq(propertyPrice.propertyId, propertyTable.propertyId))
    .where(eq(propertyTable.status, status));

  if (!rows.length) return [];
  const ids = rows.map((row) => row.propertyId);
  const propertyCoords = rows.map((row) => ({
    propertyId: row.propertyId,
    latitude: decimalNumber(row.latitude, "latitude"),
    longitude: decimalNumber(row.longitude, "longitude"),
  }));

  const [images, sources, openHomeRows, schoolData] = await Promise.all([
    db
      .select()
      .from(propertyImages)
      .where(inArray(propertyImages.propertyId, ids))
      .orderBy(desc(propertyImages.isCover), propertyImages.sortOrder),
    db
      .select()
      .from(propertySources)
      .where(inArray(propertySources.propertyId, ids))
      .catch(() => []),
    db
      .select()
      .from(openHomes)
      .where(inArray(openHomes.propertyId, ids))
      .orderBy(openHomes.openDate, openHomes.startTime)
      .catch(() => []),
    getPropertySchoolData(propertyCoords),
  ]);

  const [floodZones, floodSyncRows] = await Promise.all([
    db
      .select({
        propertyId: propertyFloodHazards.propertyId,
        type: propertyFloodHazards.hazardType,
        sourceFeatureId: propertyFloodHazards.sourceFeatureId,
        sourceUrl: propertyFloodHazards.sourceUrl,
      })
      .from(propertyFloodHazards)
      .where(inArray(propertyFloodHazards.propertyId, ids))
      .catch(() => []),
    db
      .select({ hazardType: floodHazardSync.hazardType })
      .from(floodHazardSync)
      .catch(() => []),
  ]);

  const imagesByProperty = new Map<number, typeof images>();
  for (const image of images) {
    const list = imagesByProperty.get(image.propertyId) ?? [];
    list.push(image);
    imagesByProperty.set(image.propertyId, list);
  }

  const openHomesByProperty = new Map<number, OpenHome[]>();
  for (const oh of openHomeRows) {
    const list = openHomesByProperty.get(oh.propertyId) ?? [];
    const startStr = String(oh.startTime).slice(0, 5);
    const endStr = String(oh.endTime).slice(0, 5);
    list.push({
      date: oh.openDate,
      startTime: startStr,
      endTime: endStr,
      label: oh.label ?? `${oh.openDate}, ${startStr} - ${endStr}`,
    });
    openHomesByProperty.set(oh.propertyId, list);
  }

  const sourcesByProperty = new Map<number, PropertySource[]>();
  for (const source of sources) {
    const fields = source.fields.filter(
      (field): field is PropertySourceField =>
        sourceFieldValues.includes(field as PropertySourceField),
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

  const floodHazardsByProperty = new Map<
    number,
    NonNullable<Property["floodHazards"]>
  >();
  for (const hazard of floodZones) {
    const items = floodHazardsByProperty.get(hazard.propertyId) ?? [];
    items.push({
      type: hazard.type,
      sourceFeatureId: hazard.sourceFeatureId,
      sourceUrl: hazard.sourceUrl,
    });
    floodHazardsByProperty.set(hazard.propertyId, items);
  }
  const floodDataSynced =
    floodZones.length > 0 ||
    (floodSyncRows.length === 4 &&
      new Set(floodSyncRows.map(({ hazardType }) => hazardType)).size === 4);

  return rows.map((row) => {
    const propImages = imagesByProperty.get(row.propertyId) ?? [];
    const coverImage = propImages[0];
    if (!coverImage) {
      throw new Error(`Missing property image for database property ${row.propertyId}.`);
    }
    const gallery = propImages.map((img) => img.url);
    const totalParking = (row.garageParking ?? 0) + (row.offStreetParking ?? 0);

    return {
      id: row.demoKey ?? String(row.propertyId),
      address: formatAddress(row.unitNumber, row.streetNumber, row.streetName),
      suburb: row.suburb ?? "",
      city: row.city,
      region: row.region ?? "",
      price: decimalNumber(row.salePrice, "sale price"),
      ...(row.saleMethod ? { saleMethod: row.saleMethod } : {}),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      ...(totalParking > 0 ? { parkingSpaces: totalParking } : {}),
      landArea: decimalNumber(row.landArea, "land area"),
      floorArea: decimalNumber(row.floorArea, "floor area"),
      yearBuilt: row.yearBuilt ?? 0,
      propertyType: asPropertyType(row.displayPropertyType, row.storedPropertyType),
      architecturalStyle: asArchitecturalStyle(row.architecturalStyle),
      ...(row.orientation ? { orientation: row.orientation } : {}),
      ...(row.sunlightHours !== null
        ? { sunlightHours: decimalNumber(row.sunlightHours, "sunlight hours") }
        : {}),
      ...(row.capitalValue !== null
        ? { capitalValue: decimalNumber(row.capitalValue, "capital value") }
        : {}),
      ...(row.estimatedWeeklyRent !== null
        ? { estimatedWeeklyRent: decimalNumber(row.estimatedWeeklyRent, "weekly rent") }
        : {}),
      ...(row.ownershipType ? { ownershipType: row.ownershipType } : {}),
      latitude: decimalNumber(row.latitude, "latitude"),
      longitude: decimalNumber(row.longitude, "longitude"),
      image: coverImage.url,
      imageAlt: coverImage.caption ?? row.demoKey ?? row.streetName,
      ...(row.imageSourceUrl ? { imageSourceUrl: row.imageSourceUrl } : {}),
      ...(row.agentName && row.agentContactUrl
        ? {
            listingAgent: {
              name: row.agentName,
              source: (row.agentSource as "OneRoof") || "OneRoof",
              contactUrl: row.agentContactUrl,
            },
          }
        : {}),
      photoGallery: gallery,
      ...(openHomesByProperty.has(row.propertyId)
        ? { openHomes: openHomesByProperty.get(row.propertyId) }
        : {}),
      ...(sourcesByProperty.has(row.propertyId)
        ? { sources: sourcesByProperty.get(row.propertyId) }
        : {}),
      schoolDataSynced: schoolData.synced,
      ...(schoolData.synced
        ? {
            nearbySchools: schoolData.nearbyByProperty.get(row.propertyId) ?? [],
            schoolZones: schoolData.zonesByProperty.get(row.propertyId) ?? [],
          }
        : {}),
      ...(floodDataSynced
        ? { floodHazards: floodHazardsByProperty.get(row.propertyId) ?? [] }
        : {}),
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

export async function getNearbyComparableSales(
  propertyKey: string,
  radiusKm: number,
  months: number,
): Promise<ComparableSalesResult> {
  const [activeProperties, soldProperties] = await Promise.all([
    getPropertiesByStatus("active"),
    getComparableSales(),
  ]);
  const target =
    activeProperties.find((p) => p.id === propertyKey) ??
    soldProperties.find((p) => p.id === propertyKey);

  if (!target) return { comps: [], averagePrice: 0 };

  const result = findComparableSales(target, soldProperties, {
    radiusKm,
    months,
    asOf: new Date(),
  });

  return {
    comps: result.comps.map(({ property, distanceKm }) => ({
      property: {
        id: property.id,
        address: property.address,
        bedrooms: property.bedrooms,
        floorArea: property.floorArea,
        price: property.price,
        soldDate: property.soldDate,
      },
      distanceKm: Math.round(distanceKm * 100) / 100,
    })),
    averagePrice: result.averagePrice,
  };
}
