import "server-only";

import { count, sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db";
import {
  properties as propertyTable,
  propertyDemoDetails,
  propertyDetails,
  propertyImages,
  propertyPrice,
  propertySales,
  propertySchoolZones,
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

function splitAddress(value: string) {
  const match = /^(?:(?:([^/]+)\/))?(\d+[A-Za-z]?)\s+(.+)$/.exec(value);
  if (!match) throw new Error(`Could not parse property address: ${value}`);
  return {
    unitNumber: match[1]?.slice(0, -1) ?? null,
    streetNumber: match[2],
    streetName: match[3],
  };
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
      listingType: "sale",
      status,
    })
    .$returningId();
  const propertyId = record.propertyId;
  const parsedAddress = splitAddress(property.address);

  await tx.insert(propertyPrice).values({
    propertyId,
    salePrice: String(property.price),
    pricingMethod: "fixed",
  });
  await tx.execute(sql`
    INSERT INTO address (
      property_id, unit_number, street_number, street_name, suburb, city, state,
      country, latitude, longitude, location
    ) VALUES (
      ${propertyId}, ${parsedAddress.unitNumber}, ${parsedAddress.streetNumber},
      ${parsedAddress.streetName}, ${property.suburb}, ${property.city}, ${property.region},
      'New Zealand', ${String(property.latitude)}, ${String(property.longitude)},
      POINT(${property.longitude}, ${property.latitude})
    )
  `);
  await tx.insert(propertyDetails).values({
    propertyId,
    propertyType: propertyTypeForSql[property.propertyType],
    landArea: String(property.landArea),
    floorArea: String(property.floorArea),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    yearBuilt: property.yearBuilt,
  });
  await tx.insert(propertyDemoDetails).values({
    propertyId,
    displayPropertyType: property.propertyType,
    architecturalStyle: property.architecturalStyle,
    floodRisk: property.floodRisk,
    orientation: property.orientation,
    sunlightHours: String(property.sunlightHours),
    walkabilityScore: property.walkability?.score ?? null,
    walkabilityLabel: property.walkability?.label ?? null,
    parksNearby: property.walkability?.parksNearby ?? null,
    cafesNearby: property.walkability?.cafesNearby ?? null,
    supermarketsNearby: property.walkability?.supermarketsNearby ?? null,
  });
  await tx.insert(propertyImages).values({
    propertyId,
    url: property.image,
    caption: property.imageAlt,
    isCover: true,
  });

  for (const zone of property.schoolZones ?? []) {
    await tx.insert(propertySchoolZones).values({
      propertyId,
      name: zone.name,
      type: zone.type,
      distanceKm: String(zone.distanceKm),
      isInZone: zone.isInZone,
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

async function main() {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(propertyTable);
    if (total > 0) {
      throw new Error(
        "The properties table is not empty; refusing to duplicate or overwrite existing records.",
      );
    }

    for (const property of properties) await insertProperty(tx, property, "active");
    for (const property of comparableSales) await insertProperty(tx, property, "sold");
  });

  console.info(
    `Seeded ${properties.length} active properties and ${comparableSales.length} comparable sales.`,
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
