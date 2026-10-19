import { comparableSales as localSales, properties as localProperties } from "./property-data";
import type { Property, SchoolOption } from "./property-types";

const bundledListingsById = new Map(localProperties.map(property => [property.id, property]));

function withSourceAgent(property: Property): Property {
  if (property.listingAgent) return property;
  const listingAgent = bundledListingsById.get(property.id)?.listingAgent;
  if (!listingAgent || !property.sources?.some(source =>
    source.publisher === listingAgent.source && source.url === listingAgent.contactUrl
  )) return property;
  return { ...property, listingAgent };
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
      properties: properties.some(property => withSourceAgent(property) !== property)
        ? properties.map(withSourceAgent)
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
