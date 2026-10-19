import { comparableSales as localSales, properties as localProperties } from "./property-data";
import type { SchoolOption } from "./property-types";

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
      properties,
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
