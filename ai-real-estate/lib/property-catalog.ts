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
  const needsSummary = !property.summary && Boolean(bundled.summary);
  const needsTeaser = !property.teaser && Boolean(bundled.teaser);
  const needsValuations =
    (!property.valuationHistory || property.valuationHistory.length === 0) &&
    Boolean(bundled.valuationHistory && bundled.valuationHistory.length > 0);
  const needsAvmHistory =
    (!property.avmHistory || property.avmHistory.length === 0) &&
    Boolean(bundled.avmHistory && bundled.avmHistory.length > 0);
  const needsPastSales =
    (!property.pastSales || property.pastSales.length === 0) &&
    Boolean(bundled.pastSales && bundled.pastSales.length > 0);
  const needsPropertyHistory =
    (!property.propertyHistory || property.propertyHistory.length === 0) &&
    Boolean(bundled.propertyHistory && bundled.propertyHistory.length > 0);
  const needsPublicRecords =
    (!property.titleNumber && Boolean(bundled.titleNumber)) ||
    (!property.unitaryPlanZone && Boolean(bundled.unitaryPlanZone)) ||
    (property.landValue === undefined && bundled.landValue !== undefined) ||
    (property.estimateMedian === undefined && bundled.estimateMedian !== undefined);

  if (
    !needsAgent &&
    !needsFlood &&
    !needsOpenHomes &&
    !needsGallery &&
    !needsSaleMethod &&
    !needsSummary &&
    !needsTeaser &&
    !needsValuations &&
    !needsAvmHistory &&
    !needsPastSales &&
    !needsPropertyHistory &&
    !needsPublicRecords
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
    ...(needsSummary ? { summary: bundled.summary } : {}),
    ...(needsTeaser ? { teaser: bundled.teaser } : {}),
    ...(needsValuations ? { valuationHistory: bundled.valuationHistory } : {}),
    ...(needsAvmHistory ? { avmHistory: bundled.avmHistory } : {}),
    ...(needsPastSales ? { pastSales: bundled.pastSales } : {}),
    ...(needsPropertyHistory ? { propertyHistory: bundled.propertyHistory } : {}),
    ...(property.landValue === undefined && bundled.landValue !== undefined
      ? { landValue: bundled.landValue }
      : {}),
    ...(property.improvementValue === undefined && bundled.improvementValue !== undefined
      ? { improvementValue: bundled.improvementValue }
      : {}),
    ...(!property.valuationDate && bundled.valuationDate
      ? { valuationDate: bundled.valuationDate }
      : {}),
    ...(!property.rateableValueChange && bundled.rateableValueChange
      ? { rateableValueChange: bundled.rateableValueChange }
      : {}),
    ...(property.estimateLow === undefined && bundled.estimateLow !== undefined
      ? { estimateLow: bundled.estimateLow }
      : {}),
    ...(property.estimateMedian === undefined && bundled.estimateMedian !== undefined
      ? { estimateMedian: bundled.estimateMedian }
      : {}),
    ...(property.estimateHigh === undefined && bundled.estimateHigh !== undefined
      ? { estimateHigh: bundled.estimateHigh }
      : {}),
    ...(!property.estimateConfidence && bundled.estimateConfidence
      ? { estimateConfidence: bundled.estimateConfidence }
      : {}),
    ...(!property.titleNumber && bundled.titleNumber ? { titleNumber: bundled.titleNumber } : {}),
    ...(!property.legalDescription && bundled.legalDescription
      ? { legalDescription: bundled.legalDescription }
      : {}),
    ...(!property.estateDescription && bundled.estateDescription
      ? { estateDescription: bundled.estateDescription }
      : {}),
    ...(!property.unitaryPlanZone && bundled.unitaryPlanZone
      ? { unitaryPlanZone: bundled.unitaryPlanZone }
      : {}),
    ...(!property.contour && bundled.contour ? { contour: bundled.contour } : {}),
    ...(!property.construction && bundled.construction
      ? { construction: bundled.construction }
      : {}),
    ...(!property.condition && bundled.condition ? { condition: bundled.condition } : {}),
    ...(!property.council && bundled.council ? { council: bundled.council } : {}),
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
