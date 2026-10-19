import { count } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db";
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
} from "../lib/db/schema";
import { comparableSales, properties } from "../lib/property-data";
import type { Property, PropertyType } from "../lib/property-types";

const propertyTypeForSql: Record<
  PropertyType,
  "house" | "apartment" | "townhouse" | "section" | "lifestyle"
> = {
  Apartment: "apartment",
  House: "house",
  "Lifestyle block": "lifestyle",
  Section: "section",
  Townhouse: "townhouse",
  Villa: "house",
};

export function splitAddress(value: string) {
  const trimmed = value.trim();
  const match = /^(?:([^/]+)\/)?(\d+[A-Za-z]?(?:\s*&\s*\d+[A-Za-z]?)?)\s+(.+)$/.exec(
    trimmed,
  );
  if (!match) {
    return {
      unitNumber: null,
      streetNumber: "1",
      streetName: trimmed,
    };
  }
  return {
    unitNumber: match[1]?.trim() ?? null,
    streetNumber: match[2]?.trim() ?? "1",
    streetName: match[3]?.trim() ?? trimmed,
  };
}

function normalizeSqlTime(time: string): string {
  const trimmed = time.trim();
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function insertProperty(
  tx: DbTransaction,
  property: Property,
  status: "active" | "sold",
) {
  const [record] = await tx
    .insert(propertyTable)
    .values({
      demoKey: property.id,
      title: property.address,
      body: property.summary,
      listingType: "sale",
      status,
    })
    .returning({ propertyId: propertyTable.propertyId });
  const propertyId = record.propertyId;
  const parsedAddress = splitAddress(property.address);

  await tx.insert(propertyPrice).values({
    propertyId,
    salePrice: String(property.price),
    pricingMethod: "fixed",
  });

  await tx.insert(address).values({
    propertyId,
    unitNumber: parsedAddress.unitNumber,
    streetNumber: parsedAddress.streetNumber,
    streetName: parsedAddress.streetName,
    suburb: property.suburb,
    city: property.city,
    state: property.region,
    country: "New Zealand",
    latitude: String(property.latitude),
    longitude: String(property.longitude),
  });

  await tx.insert(propertyDetails).values({
    propertyId,
    propertyType: propertyTypeForSql[property.propertyType],
    displayPropertyType: property.propertyType,
    architecturalStyle: property.architecturalStyle ?? null,
    orientation: property.orientation,
    sunlightHours: String(property.sunlightHours),
    landArea: String(property.landArea),
    floorArea: String(property.floorArea),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    offStreetParking: property.parkingSpaces ?? 0,
    yearBuilt: property.yearBuilt,
    capitalValue: property.capitalValue ? String(property.capitalValue) : null,
    estimatedWeeklyRent: property.estimatedWeeklyRent
      ? String(property.estimatedWeeklyRent)
      : null,
    ownershipType: property.ownershipType ?? "Freehold",
    saleMethod: property.saleMethod ?? null,
    imageSourceUrl: property.imageSourceUrl ?? null,
    agentName: property.listingAgent?.name ?? null,
    agentSource: property.listingAgent?.source ?? null,
    agentContactUrl: property.listingAgent?.contactUrl ?? null,
  });

  const gallery = Array.from(
    new Set([property.image, ...(property.photoGallery ?? [])].filter(Boolean)),
  );

  for (let i = 0; i < gallery.length; i += 1) {
    await tx.insert(propertyImages).values({
      propertyId,
      url: gallery[i],
      caption: property.imageAlt,
      sortOrder: i,
      isCover: i === 0,
    });
  }

  for (const oh of property.openHomes ?? []) {
    if (!oh.date || !oh.startTime || !oh.endTime) continue;
    const startTime = normalizeSqlTime(oh.startTime);
    const endTime = normalizeSqlTime(oh.endTime);
    if (endTime > startTime) {
      await tx.insert(openHomes).values({
        propertyId,
        openDate: oh.date,
        startTime,
        endTime,
        label: oh.label,
      });
    }
  }

  for (const hazard of property.floodHazards ?? []) {
    await tx.insert(propertyFloodHazards).values({
      propertyId,
      hazardType: hazard.type,
      sourceFeatureId: hazard.sourceFeatureId || "arcgis-verified",
      sourceUrl: hazard.sourceUrl,
    });
  }

  for (const source of property.sources ?? []) {
    await tx.insert(propertySources).values({
      propertyId,
      sourceKey: source.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      reference: source.reference,
      material: source.material,
      fields: source.fields,
    });
  }

  if (property.soldDate) {
    await tx.insert(propertySales).values({
      propertyId,
      soldPrice: String(property.price),
      soldDate: property.soldDate,
    });
  }
}

async function ensureSimplifiedSchema() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { sql } = await import("drizzle-orm");
  const db = getDb();

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."flood_hazard_type" AS ENUM('flood_plains', 'flood_prone_areas', 'overland_flow_paths', 'coastal_inundation');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."orientation" AS ENUM('North', 'East', 'South', 'West');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "flood_hazard_sync" (
      "hazard_type" "flood_hazard_type" PRIMARY KEY NOT NULL,
      "imported_feature_count" integer NOT NULL,
      "imported_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  const sqlPath = path.join(
    process.cwd(),
    "drizzle/postgres/0007_simplify_schema_and_remove_postgis_demo.sql",
  );
  if (fs.existsSync(sqlPath)) {
    const rawSql = fs.readFileSync(sqlPath, "utf8");
    const statements = rawSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.execute(sql.raw(stmt));
    }
  }
}

const FLOOD_SYNC_LAYERS = [
  "flood_plains",
  "flood_prone_areas",
  "overland_flow_paths",
  "coastal_inundation",
] as const;

async function main() {
  const forceReset =
    process.argv.includes("--reset") || process.env.FORCE_RESEED === "true";
  await ensureSimplifiedSchema();

  const db = getDb();
  await db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(propertyTable);
    if (total > 0) {
      if (!forceReset) {
        throw new Error(
          "The properties table is not empty; pass --reset or FORCE_RESEED=true to replace existing property records.",
        );
      }
      await tx.delete(propertyTable);
      await tx.delete(floodHazardSync);
    }

    for (const property of properties) await insertProperty(tx, property, "active");
    for (const property of comparableSales) await insertProperty(tx, property, "sold");

    for (const hazardType of FLOOD_SYNC_LAYERS) {
      const matchedCount = properties.filter((p) =>
        p.floodHazards?.some((h) => h.type === hazardType),
      ).length;
      await tx.insert(floodHazardSync).values({
        hazardType,
        importedFeatureCount: matchedCount,
      });
    }
  });

  console.info(
    `Seeded ${properties.length} active properties, ${comparableSales.length} comparable sales, and ${FLOOD_SYNC_LAYERS.length} flood hazard sync layers.`,
  );
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

void run();
