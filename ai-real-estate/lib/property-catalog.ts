import { comparableSales as localSales, properties as localProperties } from "./property-data";
import type { SchoolSearchOption } from "./property-types";

export interface PropertyCatalogResult {
  properties: typeof localProperties;
  comparableSales: typeof localSales;
  schoolCatalog: {
    synced: boolean;
    schools: SchoolSearchOption[];
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
    const { getComparableSales, getPropertiesByStatus, getAucklandSchoolOptions } = await import("./db/properties");
    const [properties, schoolCatalog] = await Promise.all([
      getPropertiesByStatus("active"),
      getAucklandSchoolOptions(),
    ]);
    if (properties.length === 0) return fallback;

    const comparableSales = includeComparableSales
      ? await getComparableSales()
      : localSales;
    return { properties, comparableSales, schoolCatalog };
  } catch (error) {
    const reason = error instanceof Error
      ? error.cause instanceof Error ? error.cause.message : error.message
      : "unknown database error";
    console.warn(`[Database] Using bundled property listings: ${reason}`);
    return fallback;
  }
}
