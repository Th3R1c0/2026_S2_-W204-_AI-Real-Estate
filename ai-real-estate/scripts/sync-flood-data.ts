import { pathToFileURL } from "node:url";
import { Pool, type PoolClient } from "pg";

const ARCGIS_SERVICES =
  "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services";
const PAGE_SIZE = 500;
const MAX_REQUEST_ATTEMPTS = 3;

export const FLOOD_DATASETS = [
  {
    hazardType: "flood_plains",
    serviceName: "Flood_Plains",
    layerName: "Flood Plains",
    expectedGeometryType: "esriGeometryPolygon",
  },
  {
    hazardType: "flood_prone_areas",
    serviceName: "Flood_Prone_Areas",
    layerName: "Flood Prone Areas",
    expectedGeometryType: "esriGeometryPolygon",
  },
  {
    hazardType: "overland_flow_paths",
    serviceName: "Overland_Flow_Paths",
    layerName: "Overland Flow Paths",
    expectedGeometryType: "esriGeometryPolyline",
  },
  {
    hazardType: "coastal_inundation",
    serviceName: "Coastal_Inundation_100_yr_return",
    layerName: "Coastal Inundation - 100 yr return",
    expectedGeometryType: "esriGeometryPolygon",
  },
] as const;

type Dataset = (typeof FLOOD_DATASETS)[number];

type Extent = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

type ArcGisFeature = {
  geometry: Record<string, unknown> | null;
  properties: Record<string, unknown> | null;
};

type ArcGisFeaturePage = {
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
  error?: { code?: number; message?: string; details?: string[] };
};

type StagedFeature = {
  hazard_type: Dataset["hazardType"];
  source_feature_id: string;
  source_url: string;
  source_attributes: Record<string, unknown>;
  geometry: Record<string, unknown>;
};

class ArcGisResponseError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ArcGisResponseError";
  }
}

export function createFeatureQueryUrl(
  dataset: Dataset,
  extent: Extent,
  resultOffset: number,
): URL {
  const layerUrl = `${ARCGIS_SERVICES}/${dataset.serviceName}/FeatureServer/0`;
  const url = new URL(`${layerUrl}/query`);
  url.search = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    geometry: `${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultOffset: String(resultOffset),
    resultRecordCount: String(PAGE_SIZE),
    orderByFields: "OBJECTID ASC",
  }).toString();
  return url;
}

export function parseFeaturePage(
  page: ArcGisFeaturePage,
  dataset: Dataset,
  objectIdField: string,
): StagedFeature[] {
  if (page.error) {
    const details = page.error.details?.join(" ");
    throw new Error(
      `ArcGIS query failed for ${dataset.layerName}: ${page.error.message ?? "Unknown error"}${details ? ` (${details})` : ""}`,
    );
  }

  if (!Array.isArray(page.features)) {
    throw new Error(`ArcGIS returned an invalid GeoJSON page for ${dataset.layerName}.`);
  }

  return page.features.map((feature, index) => {
    const attributes = feature.properties;
    if (!attributes || typeof attributes !== "object" || !feature.geometry) {
      throw new Error(
        `ArcGIS feature ${index} in ${dataset.layerName} has no properties or geometry.`,
      );
    }

    const idKey = Object.keys(attributes).find(
      (key) => key.toLowerCase() === objectIdField.toLowerCase(),
    );
    const sourceFeatureId = idKey ? attributes[idKey] : undefined;
    if (sourceFeatureId === undefined || sourceFeatureId === null) {
      throw new Error(
        `ArcGIS feature ${index} in ${dataset.layerName} has no ${objectIdField}.`,
      );
    }

    return {
      hazard_type: dataset.hazardType,
      source_feature_id: String(sourceFeatureId),
      source_url: `${ARCGIS_SERVICES}/${dataset.serviceName}/FeatureServer/0`,
      source_attributes: attributes,
      geometry: feature.geometry,
    };
  });
}

async function fetchArcGisJson<T>(url: URL): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
      });
      const result = (await response.json()) as
        | T
        | { error?: { code?: number; message?: string; details?: string[] } };
      const arcGisError =
        typeof result === "object" && result !== null && "error" in result
          ? result.error
          : undefined;

      if (response.ok && !arcGisError) return result as T;

      const detail = arcGisError?.details?.join(" ");
      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        (arcGisError?.code ?? 0) >= 500;
      const error = new ArcGisResponseError(
        `ArcGIS request failed (${response.status}) for ${url.pathname}: ${arcGisError?.message ?? response.statusText}${detail ? ` (${detail})` : ""}`,
        retryable,
      );
      if (!retryable) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof ArcGisResponseError && !error.retryable) throw error;
      lastError = error;
    }

    if (attempt < MAX_REQUEST_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("ArcGIS request failed after repeated attempts.");
}

async function getPropertyAddresses(client: PoolClient): Promise<
  Array<{
    property_id: number;
    latitude: number;
    longitude: number;
  }>
> {
  const result = await client.query<{
    property_id: number;
    latitude: string | number | null;
    longitude: string | number | null;
  }>(`
    SELECT property_id, latitude, longitude
    FROM address
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  `);

  const rows = result.rows
    .map((row) => ({
      property_id: row.property_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude) &&
        row.latitude >= -90 &&
        row.latitude <= 90 &&
        row.longitude >= -180 &&
        row.longitude <= 180,
    );

  if (rows.length === 0) {
    throw new Error(
      "Flood-data import requires at least one property address with coordinates.",
    );
  }
  return rows;
}

async function queryPropertyDatasetHit(
  dataset: Dataset,
  latitude: number,
  longitude: number,
): Promise<boolean> {
  const delta = dataset.expectedGeometryType === "esriGeometryPolyline" ? 0.00035 : 0.00022;
  const extent: Extent = {
    xmin: longitude - delta,
    ymin: latitude - delta,
    xmax: longitude + delta,
    ymax: latitude + delta,
  };
  const layerUrl = `${ARCGIS_SERVICES}/${dataset.serviceName}/FeatureServer/0`;
  const url = new URL(`${layerUrl}/query`);
  url.search = new URLSearchParams({
    where: "1=1",
    returnCountOnly: "true",
    f: "json",
    geometry: `${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
  }).toString();

  const data = await fetchArcGisJson<{ count?: number }>(url);
  return (data.count ?? 0) > 0;
}

export async function syncFloodData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(84549271, 1)");
    lockAcquired = true;
    const addresses = await getPropertyAddresses(client);
    console.info(
      `Checking Auckland Council flood layers for ${addresses.length} property addresses...`,
    );

    const hits: Array<{
      propertyId: number;
      hazardType: Dataset["hazardType"];
      sourceUrl: string;
    }> = [];
    const countsByLayer = new Map<Dataset["hazardType"], number>(
      FLOOD_DATASETS.map((d) => [d.hazardType, 0]),
    );

    for (const addr of addresses) {
      for (const dataset of FLOOD_DATASETS) {
        const hit = await queryPropertyDatasetHit(
          dataset,
          addr.latitude,
          addr.longitude,
        );
        if (hit) {
          hits.push({
            propertyId: addr.property_id,
            hazardType: dataset.hazardType,
            sourceUrl: `${ARCGIS_SERVICES}/${dataset.serviceName}/FeatureServer/0`,
          });
          countsByLayer.set(
            dataset.hazardType,
            (countsByLayer.get(dataset.hazardType) ?? 0) + 1,
          );
        }
      }
    }

    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM property_flood_hazards");
      for (const hit of hits) {
        await client.query(
          `
            INSERT INTO property_flood_hazards (
              property_id, hazard_type, source_feature_id, source_url
            ) VALUES ($1, $2::flood_hazard_type, 'arcgis-verified', $3)
            ON CONFLICT (property_id, hazard_type) DO NOTHING
          `,
          [hit.propertyId, hit.hazardType, hit.sourceUrl],
        );
      }

      for (const dataset of FLOOD_DATASETS) {
        await client.query(
          `
            INSERT INTO flood_hazard_sync (
              hazard_type, imported_feature_count, imported_at
            ) VALUES ($1::flood_hazard_type, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (hazard_type) DO UPDATE SET
              imported_feature_count = EXCLUDED.imported_feature_count,
              imported_at = EXCLUDED.imported_at
          `,
          [dataset.hazardType, countsByLayer.get(dataset.hazardType) ?? 0],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    console.info(
      `Flood-data import complete. Stored intersections for ${hits.length} property/hazard pairs.`,
    );
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(84549271, 1)");
      }
    } finally {
      client.release();
    }
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL before importing Auckland Council flood data.");
  }

  const pool = new Pool({ connectionString });
  try {
    await syncFloodData(pool);
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch((error: unknown) => {
    console.error("Auckland Council flood-data import failed:", error);
    process.exitCode = 1;
  });
}
