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

async function getPropertyExtent(client: PoolClient): Promise<Extent> {
  const result = await client.query<{
    xmin: number | null;
    ymin: number | null;
    xmax: number | null;
    ymax: number | null;
    total_addresses: number;
    valid_addresses: number;
  }>(`
    WITH property_extent AS (
      SELECT
        COUNT(*)::int AS total_addresses,
        COUNT(*) FILTER (
          WHERE longitude BETWEEN -180 AND 180
            AND latitude BETWEEN -90 AND 90
        )::int AS valid_addresses,
        ST_Transform(
          ST_MakeEnvelope(
            MIN(longitude::double precision) FILTER (
              WHERE longitude BETWEEN -180 AND 180
                AND latitude BETWEEN -90 AND 90
            ),
            MIN(latitude::double precision) FILTER (
              WHERE longitude BETWEEN -180 AND 180
                AND latitude BETWEEN -90 AND 90
            ),
            MAX(longitude::double precision) FILTER (
              WHERE longitude BETWEEN -180 AND 180
                AND latitude BETWEEN -90 AND 90
            ),
            MAX(latitude::double precision) FILTER (
              WHERE longitude BETWEEN -180 AND 180
                AND latitude BETWEEN -90 AND 90
            ),
            4326
          ),
          2193
        ) AS geom
      FROM address
    ),
    buffered_extent AS (
      SELECT
        total_addresses,
        valid_addresses,
        ST_Transform(ST_Expand(geom, 1000), 4326) AS geom
      FROM property_extent
    )
    SELECT
      ST_XMin(Box3D(geom)) AS xmin,
      ST_YMin(Box3D(geom)) AS ymin,
      ST_XMax(Box3D(geom)) AS xmax,
      ST_YMax(Box3D(geom)) AS ymax,
      total_addresses,
      valid_addresses
    FROM buffered_extent
  `);
  const extent = result.rows[0];
  if (!extent || extent.total_addresses === 0) {
    throw new Error(
      "Flood-data import requires at least one property address with coordinates.",
    );
  }
  if (extent.valid_addresses !== extent.total_addresses) {
    throw new Error(
      `Flood-data import found ${extent.total_addresses - extent.valid_addresses} address(es) with invalid longitude or latitude values.`,
    );
  }
  if (
    extent?.xmin === null ||
    extent?.ymin === null ||
    extent?.xmax === null ||
    extent?.ymax === null
  ) {
    throw new Error(
      "Flood-data import could not calculate a valid property-coordinate extent.",
    );
  }

  return {
    xmin: extent.xmin,
    ymin: extent.ymin,
    xmax: extent.xmax,
    ymax: extent.ymax,
  };
}

async function createStagingTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TEMP TABLE flood_hazard_import_stage (
      hazard_type text NOT NULL,
      source_feature_id text NOT NULL,
      source_url text NOT NULL,
      source_attributes jsonb NOT NULL,
      geom geometry(Geometry, 4326) NOT NULL,
      PRIMARY KEY (hazard_type, source_feature_id)
    ) ON COMMIT PRESERVE ROWS
  `);
}

async function stageFeatures(
  client: PoolClient,
  features: StagedFeature[],
): Promise<void> {
  if (features.length === 0) return;

  await client.query(
    `
      INSERT INTO flood_hazard_import_stage (
        hazard_type,
        source_feature_id,
        source_url,
        source_attributes,
        geom
      )
      SELECT
        feature.hazard_type,
        feature.source_feature_id,
        feature.source_url,
        feature.source_attributes,
        ST_SetSRID(ST_GeomFromGeoJSON(feature.geometry::text), 4326)
      FROM jsonb_to_recordset($1::jsonb) AS feature(
        hazard_type text,
        source_feature_id text,
        source_url text,
        source_attributes jsonb,
        geometry jsonb
      )
    `,
    [
      JSON.stringify(
        features.map(({ hazard_type, source_feature_id, source_url, source_attributes, geometry }) => ({
          hazard_type,
          source_feature_id,
          source_url,
          source_attributes,
          geometry,
        })),
      ),
    ],
  );
}

async function importDataset(
  client: PoolClient,
  dataset: Dataset,
  extent: Extent,
): Promise<number> {
  const layerUrl = new URL(
    `${ARCGIS_SERVICES}/${dataset.serviceName}/FeatureServer/0`,
  );
  layerUrl.searchParams.set("f", "json");
  const layer = await fetchArcGisJson<{
    name?: string;
    geometryType?: string;
    objectIdField?: string;
    objectIdFieldName?: string;
  }>(layerUrl);
  const objectIdField = layer.objectIdField ?? layer.objectIdFieldName;
  if (layer.geometryType !== dataset.expectedGeometryType || !objectIdField) {
    throw new Error(
      `ArcGIS layer metadata changed unexpectedly for ${dataset.layerName}.`,
    );
  }

  let resultOffset = 0;
  let totalImported = 0;
  for (;;) {
    const url = createFeatureQueryUrl(dataset, extent, resultOffset);
    const page = await fetchArcGisJson<ArcGisFeaturePage>(url);
    const features = parseFeaturePage(page, dataset, objectIdField);
    if (features.length === 0) {
      if (page.exceededTransferLimit) {
        throw new Error(
          `ArcGIS reported more ${dataset.layerName} features but returned an empty page.`,
        );
      }
      break;
    }

    await stageFeatures(client, features);
    totalImported += features.length;
    resultOffset += features.length;

    if (features.length < PAGE_SIZE && !page.exceededTransferLimit) break;
  }

  console.info(`${dataset.layerName}: staged ${totalImported} features.`);
  return totalImported;
}

async function refreshPropertyIntersections(client: PoolClient): Promise<number> {
  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM property_flood_hazards");
    await client.query("DELETE FROM flood_hazard_zones");
    await client.query(`
      INSERT INTO flood_hazard_zones (
        hazard_type,
        source_feature_id,
        source_url,
        source_attributes,
        geom
      )
      SELECT
        hazard_type::flood_hazard_type,
        source_feature_id,
        source_url,
        source_attributes,
        geom
      FROM flood_hazard_import_stage
    `);
    const result = await client.query(`
      INSERT INTO property_flood_hazards (property_id, flood_hazard_zone_id)
      SELECT address.property_id, flood_hazard_zones.flood_hazard_zone_id
      FROM address
      JOIN flood_hazard_zones
        ON ST_Intersects(
          flood_hazard_zones.geom,
          ST_SetSRID(
            ST_MakePoint(
              address.longitude::double precision,
              address.latitude::double precision
            ),
            4326
          )
        )
    `);
    await client.query(`
      INSERT INTO flood_hazard_sync (
        hazard_type,
        imported_feature_count,
        imported_at
      )
      SELECT
        dataset.hazard_type::flood_hazard_type,
        COUNT(stage.source_feature_id)::int,
        CURRENT_TIMESTAMP
      FROM (
        VALUES
          ('flood_plains'),
          ('flood_prone_areas'),
          ('overland_flow_paths'),
          ('coastal_inundation')
      ) AS dataset(hazard_type)
      LEFT JOIN flood_hazard_import_stage AS stage
        ON stage.hazard_type = dataset.hazard_type
      GROUP BY dataset.hazard_type
      ON CONFLICT (hazard_type) DO UPDATE SET
        imported_feature_count = EXCLUDED.imported_feature_count,
        imported_at = EXCLUDED.imported_at
    `);
    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function syncFloodData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(84549271, 1)");
    lockAcquired = true;
    const extent = await getPropertyExtent(client);
    console.info(
      `Importing Auckland Council flood data for property extent with a 1 km buffer: ${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}.`,
    );
    await createStagingTable(client);

    for (const dataset of FLOOD_DATASETS) {
      await importDataset(client, dataset, extent);
    }

    const intersections = await refreshPropertyIntersections(client);
    console.info(
      `Flood-data import complete. Stored intersections for ${intersections} property/hazard pairs.`,
    );
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(84549271, 1)");
      }
    } finally {
      try {
        await client.query("DROP TABLE IF EXISTS pg_temp.flood_hazard_import_stage");
      } finally {
        client.release();
      }
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
