import { comparableSales as localSales, properties as localProperties } from "./property-data";
import type { Property, SchoolOption } from "./property-types";

const bundledListingsById = new Map(localProperties.map(property => [property.id, property]));

function withSourceEnrichment(property: Property): Property {
  const bundled = bundledListingsById.get(property.id);
  if (!bundled) return property;

  const expectedUrl =
    bundled.listingAgent?.contactUrl ??
    bundled.sources?.find(s => s.publisher === "OneRoof")?.url;
  const hasMatchingSource = expectedUrl
    ? property.sources?.some(
        source => source.publisher === "OneRoof" && source.url === expectedUrl,
      )
    : false;

  if (!hasMatchingSource) return property;

  const needsAgent = !property.listingAgent && Boolean(bundled.listingAgent);
  const needsFlood =
    property.floodHazards === undefined && bundled.floodHazards !== undefined;
  const needsOpenHomes =
    (!property.openHomes || property.openHomes.length === 0) &&
    Boolean(bundled.openHomes && bundled.openHomes.length > 0);
  const needsGallery =
    (!property.photoGallery || property.photoGallery.length <= 1) &&
    Boolean(bundled.photoGallery && bundled.photoGallery.length > 1);
  const needsSaleMethod = !property.saleMethod && Boolean(bundled.saleMethod);

  if (
    !needsAgent &&
    !needsFlood &&
    !needsOpenHomes &&
    !needsGallery &&
    !needsSaleMethod
  ) {
    return property;
  }

  return {
    ...property,
    ...(needsAgent ? { listingAgent: bundled.listingAgent } : {}),
    ...(needsFlood ? { floodHazards: bundled.floodHazards } : {}),
    ...(needsOpenHomes ? { openHomes: bundled.openHomes } : {}),
    ...(needsGallery ? { photoGallery: bundled.photoGallery } : {}),
    ...(needsSaleMethod ? { saleMethod: bundled.saleMethod } : {}),
  };
}

export interface PropertyCatalogResult {
  properties: typeof localProperties;
  comparableSales: typeof localSales;
  schoolCatalog: {
    synced: boolean;
    schools: SchoolOption[];
  };
}

export async function loadPropertyCatalog(includeComparableSales = false): Promise<PropertyCatalogResult> {
  const fallback: PropertyCatalogResult = {
    properties: localProperties,
    comparableSales: localSales,
    schoolCatalog: { synced: false, schools: [] },
  };
  if (!process.env.DATABASE_URL) return fallback;

  try {
    const db = await import("./db/properties");
    const getPropertiesByStatus = db.getPropertiesByStatus;
    const getComparableSales = db.getComparableSales;
    const getAucklandSchoolOptions = db.getAucklandSchoolOptions;

    const [properties, schoolCatalog, comparableSales] = await Promise.all([
      typeof getPropertiesByStatus === "function"
        ? getPropertiesByStatus("active")
        : Promise.resolve(localProperties),
      typeof getAucklandSchoolOptions === "function"
        ? Promise.resolve(getAucklandSchoolOptions())
            .then((res) => res ?? { synced: false, schools: [] })
            .catch(() => ({ synced: false, schools: [] }))
        : Promise.resolve({ synced: false, schools: [] }),
      includeComparableSales && typeof getComparableSales === "function"
        ? Promise.resolve(getComparableSales()).catch(() => localSales)
        : Promise.resolve(localSales),
    ]);
    if (!properties || properties.length === 0) return fallback;

    return {
      properties: properties.some(property => withSourceEnrichment(property) !== property)
        ? properties.map(withSourceEnrichment)
        : properties,
      comparableSales: comparableSales ?? localSales,
      schoolCatalog: schoolCatalog ?? { synced: false, schools: [] },
    };
  } catch (error) {
    const reason = error instanceof Error
      ? error.cause instanceof Error ? error.cause.message : error.message
      : "unknown database error";
    console.warn(`[Database] Using bundled property listings: ${reason}`);
    return fallback;
  }
}
