import { comparableSales as localSales, properties as localProperties } from "./property-data";

export async function loadPropertyCatalog(includeComparableSales = false) {
  const fallback = { properties: localProperties, comparableSales: localSales };
  if (!process.env.DATABASE_URL) return fallback;

  try {
    const { getComparableSales, getPropertiesByStatus } = await import("./db/properties");
    const properties = await getPropertiesByStatus("active");
    if (properties.length === 0) return fallback;

    const comparableSales = includeComparableSales
      ? await getComparableSales()
      : localSales;
    return { properties, comparableSales };
  } catch (error) {
    const reason = error instanceof Error
      ? error.cause instanceof Error ? error.cause.message : error.message
      : "unknown database error";
    console.warn(`[Database] Using bundled property listings: ${reason}`);
    return fallback;
  }
}
