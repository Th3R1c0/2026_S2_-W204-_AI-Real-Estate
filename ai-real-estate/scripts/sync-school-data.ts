import { pathToFileURL } from "node:url";
import { Pool, type PoolClient } from "pg";
import {
  SCHOOL_DIRECTORY_RESOURCE_ID,
  SCHOOL_DIRECTORY_URL,
  SCHOOL_ZONE_URL,
  type AucklandSchoolRecord,
  type SchoolZoneFeature,
  parseAucklandSchool,
  parseSchoolZoneResponse,
} from "../lib/school-data";

const PAGE_SIZE = 500;
const ZONE_REQUEST_CONCURRENCY = 4;
const MAX_REQUEST_ATTEMPTS = 3;
const SCHOOL_LOCK_KEY = 84549271;
const SCHOOL_LOCK_SUBKEY = 2;
const BATCH_SIZE = 100;
const DIRECTORY_FIELDS = [
  "School_Id",
  "Org_Name",
  "Org_Type",
  "Latitude",
  "Longitude",
  "Enrolment_Scheme",
  "Regional_Council",
] as const;

type DirectoryResponse = {
  success?: boolean;
  result?: {
    total?: number;
    records?: unknown[];
  };
};

async function fetchJson<T>(
  url: URL,
  description: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "HavenSchoolDataImporter/1.0",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const error = new Error(`${description} returned HTTP ${response.status}.`);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else {
        return (await response.json()) as T;
      }
    } catch (error) {
      lastError = error;
      if (
        error instanceof Error &&
        /^.+ returned HTTP 4\d\d\.$/.test(error.message) &&
        !error.message.endsWith("HTTP 429.")
      ) {
        throw error;
      }
    }

    if (attempt < MAX_REQUEST_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw new Error(
    `${description} failed after ${MAX_REQUEST_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function createDirectoryPageUrl(offset: number): URL {
  const url = new URL(SCHOOL_DIRECTORY_URL);
  url.search = new URLSearchParams({
    resource_id: SCHOOL_DIRECTORY_RESOURCE_ID,
    filters: JSON.stringify({ Regional_Council: "Auckland Region" }),
    fields: DIRECTORY_FIELDS.join(","),
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }).toString();
  return url;
}

export async function fetchAucklandSchools(
  fetchImpl: typeof fetch = fetch,
): Promise<AucklandSchoolRecord[]> {
  const schools: AucklandSchoolRecord[] = [];
  let total: number | undefined;
  let offset = 0;

  for (;;) {
    const response = await fetchJson<DirectoryResponse>(
      createDirectoryPageUrl(offset),
      `School directory page at offset ${offset}`,
      fetchImpl,
    );
    if (response.success !== true || !response.result) {
      throw new Error("Education Counts returned an unsuccessful school directory response.");
    }
    const pageTotal = response.result.total;
    if (
      typeof pageTotal !== "number" ||
      !Number.isSafeInteger(pageTotal) ||
      pageTotal < 0
    ) {
      throw new Error("Education Counts returned an invalid school directory total.");
    }
    if (!Array.isArray(response.result.records)) {
      throw new Error("Education Counts returned an invalid school directory page.");
    }
    if (total === undefined) total = pageTotal;
    else if (total !== pageTotal) {
      throw new Error("The school directory total changed while it was being imported.");
    }

    for (const value of response.result.records) {
      const school = parseAucklandSchool(value);
      if (school) schools.push(school);
    }

    if (response.result.records.length === 0) {
      if (offset < pageTotal) {
        throw new Error("The school directory returned an incomplete page before its reported total.");
      }
      break;
    }
    offset += response.result.records.length;
    if (offset >= pageTotal) break;
  }

  if (schools.length === 0) {
    throw new Error("The school directory returned no Auckland schools; refusing to replace existing data.");
  }
  if (new Set(schools.map(({ schoolId }) => schoolId)).size !== schools.length) {
    throw new Error("The school directory returned duplicate School_Id values.");
  }
  return schools;
}

export async function fetchSchoolZones(
  schools: AucklandSchoolRecord[],
  fetchImpl: typeof fetch = fetch,
): Promise<SchoolZoneFeature[]> {
  const zonedSchools = schools.filter(({ enrolmentScheme }) => enrolmentScheme);
  const zonesBySchool = new Array<SchoolZoneFeature[]>(zonedSchools.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= zonedSchools.length) return;

      const school = zonedSchools[index];
      const url = new URL(SCHOOL_ZONE_URL);
      url.searchParams.set("school", String(school.schoolId));
      const response = await fetchJson<unknown>(
        url,
        `Enrolment-zone data for ${school.orgName} (${school.schoolId})`,
        fetchImpl,
      );
      zonesBySchool[index] = parseSchoolZoneResponse(response, school.schoolId);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(ZONE_REQUEST_CONCURRENCY, zonedSchools.length) },
      () => worker(),
    ),
  );
  return zonesBySchool.flat();
}

async function createStagingTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TEMP TABLE school_import_stage (
      school_id integer PRIMARY KEY,
      org_name varchar(200) NOT NULL,
      org_type varchar(100) NOT NULL,
      latitude double precision,
      longitude double precision,
      enrolment_scheme boolean NOT NULL,
      location geography(Point, 4326)
    ) ON COMMIT PRESERVE ROWS
  `);
  await client.query(`
    CREATE TEMP TABLE school_zone_import_stage (
      school_id integer NOT NULL,
      zone_index integer NOT NULL,
      zone_name varchar(200),
      zone_type varchar(100),
      geom geometry(MultiPolygon, 4326) NOT NULL CHECK (NOT ST_IsEmpty(geom)),
      PRIMARY KEY (school_id, zone_index)
    ) ON COMMIT PRESERVE ROWS
  `);
}

async function stageSchools(
  client: PoolClient,
  schools: AucklandSchoolRecord[],
): Promise<void> {
  for (let offset = 0; offset < schools.length; offset += BATCH_SIZE) {
    const batch = schools.slice(offset, offset + BATCH_SIZE);
    await client.query(
      `
        INSERT INTO school_import_stage (
          school_id, org_name, org_type, latitude, longitude, enrolment_scheme, location
        )
        SELECT
          school.school_id,
          school.org_name,
          school.org_type,
          school.latitude,
          school.longitude,
          school.enrolment_scheme,
          CASE WHEN school.latitude IS NULL THEN NULL ELSE
            ST_SetSRID(
              ST_MakePoint(school.longitude, school.latitude),
              4326
            )::geography(Point, 4326)
          END
        FROM jsonb_to_recordset($1::jsonb) AS school(
          school_id integer,
          org_name varchar,
          org_type varchar,
          latitude double precision,
          longitude double precision,
          enrolment_scheme boolean
        )
      `,
      [
        JSON.stringify(
          batch.map((school) => ({
            school_id: school.schoolId,
            org_name: school.orgName,
            org_type: school.orgType,
            latitude: school.latitude,
            longitude: school.longitude,
            enrolment_scheme: school.enrolmentScheme,
          })),
        ),
      ],
    );
  }
}

async function stageZones(client: PoolClient, zones: SchoolZoneFeature[]): Promise<void> {
  for (let offset = 0; offset < zones.length; offset += BATCH_SIZE) {
    const batch = zones.slice(offset, offset + BATCH_SIZE);
    await client.query(
      `
        INSERT INTO school_zone_import_stage (
          school_id, zone_index, zone_name, zone_type, geom
        )
        SELECT
          zone.school_id,
          zone.zone_index,
          zone.zone_name,
          zone.zone_type,
          ST_Multi(
            ST_CollectionExtract(
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(zone.geometry::text), 4326)),
              3
            )
          )::geometry(MultiPolygon, 4326)
        FROM jsonb_to_recordset($1::jsonb) AS zone(
          school_id integer,
          zone_index integer,
          zone_name varchar,
          zone_type varchar,
          geometry jsonb
        )
      `,
      [
        JSON.stringify(
          batch.map((zone) => ({
            school_id: zone.schoolId,
            zone_index: zone.zoneIndex,
            zone_name: zone.zoneName,
            zone_type: zone.zoneType,
            geometry: zone.geometry,
          })),
        ),
      ],
    );
  }
}

async function replaceSchoolData(client: PoolClient): Promise<{
  schoolCount: number;
  zoneCount: number;
}> {
  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM schools");
    await client.query(`
      INSERT INTO schools (
        school_id, org_name, org_type, latitude, longitude, enrolment_scheme, location
      )
      SELECT
        school_id, org_name, org_type, latitude, longitude, enrolment_scheme, location
      FROM school_import_stage
    `);
    await client.query(`
      INSERT INTO school_zones (school_id, zone_name, zone_type, geom)
      SELECT school_id, zone_name, zone_type, geom
      FROM school_zone_import_stage
      ORDER BY school_id, zone_index
    `);
    const schoolCount = Number(
      (await client.query("SELECT COUNT(*)::int AS count FROM school_import_stage")).rows[0]
        .count,
    );
    const zoneCount = Number(
      (await client.query("SELECT COUNT(*)::int AS count FROM school_zone_import_stage")).rows[0]
        .count,
    );
    await client.query(
      `
        INSERT INTO school_data_sync (
          singleton_id, imported_school_count, imported_zone_count, imported_at
        )
        VALUES (1, $1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (singleton_id) DO UPDATE SET
          imported_school_count = EXCLUDED.imported_school_count,
          imported_zone_count = EXCLUDED.imported_zone_count,
          imported_at = EXCLUDED.imported_at
      `,
      [schoolCount, zoneCount],
    );
    await client.query("COMMIT");
    return { schoolCount, zoneCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function syncSchoolDataWithZones(
  pool: Pool,
  schools: AucklandSchoolRecord[],
  zones: SchoolZoneFeature[],
): Promise<void> {
  const zonedSchoolIds = new Set(
    schools.filter(({ enrolmentScheme }) => enrolmentScheme).map(({ schoolId }) => schoolId),
  );
  if (zones.some(({ schoolId }) => !zonedSchoolIds.has(schoolId))) {
    throw new Error("The zone endpoint returned geometry for a school without an enrolment scheme.");
  }
  const schoolsWithZoneGeometry = new Set(zones.map(({ schoolId }) => schoolId));
  const missingZoneCount = zonedSchoolIds.size - schoolsWithZoneGeometry.size;
  if (missingZoneCount > 0) {
    console.warn(
      `${missingZoneCount} schools report an enrolment scheme but returned no zone geometry.`,
    );
  }

  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query("SELECT pg_advisory_lock($1, $2)", [
      SCHOOL_LOCK_KEY,
      SCHOOL_LOCK_SUBKEY,
    ]);
    lockAcquired = true;
    await createStagingTables(client);
    await stageSchools(client, schools);
    await stageZones(client, zones);
    const counts = await replaceSchoolData(client);
    console.info(
      `School-data import complete: ${counts.schoolCount} Auckland schools and ${counts.zoneCount} zone polygons.`,
    );
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock($1, $2)", [
          SCHOOL_LOCK_KEY,
          SCHOOL_LOCK_SUBKEY,
        ]);
      }
    } finally {
      try {
        await client.query("DROP TABLE IF EXISTS pg_temp.school_zone_import_stage");
        await client.query("DROP TABLE IF EXISTS pg_temp.school_import_stage");
      } finally {
        client.release();
      }
    }
  }
}

export async function syncSchoolData(
  pool: Pool,
  fetchSchools: () => Promise<AucklandSchoolRecord[]>,
  fetchZones: (schools: AucklandSchoolRecord[]) => Promise<SchoolZoneFeature[]>,
): Promise<void> {
  const schools = await fetchSchools();
  const zones = await fetchZones(schools);
  await syncSchoolDataWithZones(pool, schools, zones);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL before importing Education Counts school data.");
  }

  const pool = new Pool({ connectionString });
  try {
    await syncSchoolData(
      pool,
      fetchAucklandSchools,
      (schools) => fetchSchoolZones(schools),
    );
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch((error: unknown) => {
    console.error("Education Counts school-data import failed:", error);
    process.exitCode = 1;
  });
}
