import "server-only";

import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from ".";
import {
  address,
  floodHazardSync,
  floodHazardZones,
  properties as propertyTable,
  propertyDetails,
  propertyDemoDetails,
  propertyFloodHazards,
  propertyImages,
  propertyPrice,
  propertySales,
  propertySources,
  schoolDataSync,
  schools as schoolsTable,
} from "./schema";
import type {
  ArchitecturalStyle,
  FloodRisk,
  NearbySchool,
  Property,
  PropertySource,
  PropertySourceField,
  PropertyType,
  SchoolOption,
  SchoolZone,
  WalkabilityProfile,
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

type SchoolSpatialRow = {
  property_id: number;
  nearby_schools: unknown;
  school_zones: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNearbySchools(value: unknown): NearbySchool[] {
  if (!Array.isArray(value)) throw new Error("Invalid nearby school results from database.");
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.schoolId !== "number" ||
      typeof item.name !== "string" ||
      typeof item.orgType !== "string" ||
      typeof item.distanceKm !== "number" ||
      typeof item.hasEnrolmentZone !== "boolean" ||
      typeof item.hasZoneGeometry !== "boolean"
    ) {
      throw new Error("Invalid nearby school record from database.");
    }
    return {
      schoolId: item.schoolId,
      name: item.name,
      orgType: item.orgType,
      distanceKm: item.distanceKm,
      hasEnrolmentZone: item.hasEnrolmentZone,
      hasZoneGeometry: item.hasZoneGeometry,
    };
  });
}

function parseSchoolZones(value: unknown): SchoolZone[] {
  if (!Array.isArray(value)) throw new Error("Invalid school-zone results from database.");
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.schoolId !== "number" ||
      typeof item.schoolName !== "string" ||
      typeof item.schoolType !== "string"
    ) {
      throw new Error("Invalid school-zone record from database.");
    }
    return {
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      schoolType: item.schoolType,
      ...(typeof item.zoneName === "string" ? { zoneName: item.zoneName } : {}),
      ...(typeof item.zoneType === "string" ? { zoneType: item.zoneType } : {}),
    };
  });
}

async function getPropertySchoolData(
  propertyIds: number[],
): Promise<{
  synced: boolean;
  nearbyByProperty: Map<number, NearbySchool[]>;
  zonesByProperty: Map<number, SchoolZone[]>;
}> {
  const db = getDb();
  const [syncRows] = await Promise.all([
    db.select({ singletonId: schoolDataSync.singletonId }).from(schoolDataSync).limit(1),
  ]);
  if (syncRows.length === 0) {
    return {
      synced: false,
      nearbyByProperty: new Map(),
      zonesByProperty: new Map(),
    };
  }

  const { rows } = await db.$client.query<SchoolSpatialRow>(
    `
      SELECT
        property_address.property_id,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'schoolId', school.school_id,
              'name', school.org_name,
              'orgType', school.org_type,
              'distanceKm', ROUND(
                ST_Distance(school.location, property_point.geog)::numeric / 1000,
                2
              ),
              'hasEnrolmentZone', school.enrolment_scheme,
              'hasZoneGeometry', EXISTS (
                SELECT 1 FROM school_zones AS available_zone
                WHERE available_zone.school_id = school.school_id
              )
            )
            ORDER BY ST_Distance(school.location, property_point.geog), school.org_name
          )
          FROM schools AS school
          WHERE school.location IS NOT NULL
            AND ST_DWithin(school.location, property_point.geog, $2)
        ), '[]'::jsonb) AS nearby_schools,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'schoolId', school.school_id,
              'schoolName', school.org_name,
              'schoolType', school.org_type,
              'zoneName', school_zone.zone_name,
              'zoneType', school_zone.zone_type
            )
            ORDER BY school.org_name, school_zone.zone_name
          )
          FROM school_zones AS school_zone
          JOIN schools AS school ON school.school_id = school_zone.school_id
          WHERE ST_Covers(school_zone.geom, property_point.geom)
        ), '[]'::jsonb) AS school_zones
      FROM address AS property_address
      CROSS JOIN LATERAL (
        SELECT
          ST_SetSRID(
            ST_MakePoint(
              property_address.longitude::double precision,
              property_address.latitude::double precision
            ),
            4326
          ) AS geom,
          ST_SetSRID(
            ST_MakePoint(
              property_address.longitude::double precision,
              property_address.latitude::double precision
            ),
            4326
          )::geography AS geog
      ) AS property_point
      WHERE property_address.property_id = ANY($1::integer[])
    `,
    [propertyIds, SCHOOL_NEARBY_RADIUS_METRES],
  );

  const nearbyByProperty = new Map<number, NearbySchool[]>();
  const zonesByProperty = new Map<number, SchoolZone[]>();
  for (const row of rows) {
    nearbyByProperty.set(row.property_id, parseNearbySchools(row.nearby_schools));
    zonesByProperty.set(row.property_id, parseSchoolZones(row.school_zones));
  }
  return { synced: true, nearbyByProperty, zonesByProperty };
}

export async function getAucklandSchoolOptions(): Promise<{
  synced: boolean;
  schools: SchoolOption[];
}> {
  const db = getDb();
  const [syncRows, schoolRows] = await Promise.all([
    db.select({ singletonId: schoolDataSync.singletonId }).from(schoolDataSync).limit(1),
    db
      .select({
        schoolId: schoolsTable.schoolId,
        name: schoolsTable.orgName,
        orgType: schoolsTable.orgType,
        hasEnrolmentZone: schoolsTable.enrolmentScheme,
        hasCoordinates: sql<boolean>`${schoolsTable.location} IS NOT NULL`,
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
  const [images, sources, schoolData] = await Promise.all([
    db
      .select()
      .from(propertyImages)
      .where(inArray(propertyImages.propertyId, ids))
      .orderBy(desc(propertyImages.isCover), propertyImages.sortOrder),
    db.select().from(propertySources).where(inArray(propertySources.propertyId, ids)),
    getPropertySchoolData(ids),
  ]);
  const [floodZones, floodSyncRows] = await Promise.all([
    db
      .select({
        propertyId: propertyFloodHazards.propertyId,
        type: floodHazardZones.hazardType,
        sourceFeatureId: floodHazardZones.sourceFeatureId,
        sourceUrl: floodHazardZones.sourceUrl,
      })
      .from(propertyFloodHazards)
      .innerJoin(
        floodHazardZones,
        eq(propertyFloodHazards.floodHazardZoneId, floodHazardZones.floodHazardZoneId),
      )
      .where(inArray(propertyFloodHazards.propertyId, ids)),
    db.select({ hazardType: floodHazardSync.hazardType }).from(floodHazardSync),
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
    floodSyncRows.length === 4 &&
    new Set(floodSyncRows.map(({ hazardType }) => hazardType)).size === 4;

  return rows.map((row) => {
    const image = imageByProperty.get(row.propertyId);
    if (!image) throw new Error(`Missing property image for database property ${row.propertyId}.`);

    let walkability: WalkabilityProfile | undefined;
    if (
      row.walkabilityScore !== null ||
      row.walkabilityLabel !== null ||
      row.parksNearby !== null ||
      row.cafesNearby !== null ||
      row.supermarketsNearby !== null
    ) {
      let walkabilityLabel: WalkabilityProfile["label"];
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
