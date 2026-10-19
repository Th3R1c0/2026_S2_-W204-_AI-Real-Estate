import type { AucklandSchoolRecord, SchoolZoneFeature } from "./school-data";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullableString(value: string | null): string {
  return value === null ? "NULL" : sqlString(value);
}

function sqlNumber(value: number | null): string {
  return value === null ? "NULL" : String(value);
}

export function buildSchoolDataSql(
  schools: AucklandSchoolRecord[],
  zones: SchoolZoneFeature[],
  generatedAt = new Date().toISOString(),
): string {
  if (schools.length === 0 || zones.length === 0) {
    throw new Error("Refusing to generate a school-data SQL import with empty source data.");
  }
  if (new Set(schools.map(({ schoolId }) => schoolId)).size !== schools.length) {
    throw new Error("Refusing to generate SQL for duplicate Auckland school IDs.");
  }
  const schoolIds = new Set(schools.map(({ schoolId }) => schoolId));
  const schoolsById = new Map(schools.map((school) => [school.schoolId, school]));
  if (zones.some(({ schoolId }) => !schoolIds.has(schoolId))) {
    throw new Error("Refusing to generate SQL for a zone without a matching Auckland school.");
  }
  if (zones.some(({ schoolId }) => !schoolsById.get(schoolId)?.enrolmentScheme)) {
    throw new Error("Refusing to generate SQL for a school without an enrolment scheme.");
  }

  const lines = [
    "-- Auckland school directory and enrolment-zone import.",
    "-- Source zones: Ministry of Education Enrolment Scheme Master MapInfo file.",
    "-- The Office and EffectiveDate fields are intentionally ignored.",
    "-- Zone geometries are approximate; the source warns of limited resolution and alignment.",
    `-- Generated at: ${generatedAt}`,
    "-- Requires the application PostgreSQL migrations and PostGIS extension to be applied.",
    "BEGIN;",
    "DELETE FROM schools;",
    "",
    "INSERT INTO schools (",
    "  school_id, org_name, org_type, latitude, longitude, enrolment_scheme, location",
    ")",
    "VALUES",
  ];

  lines.push(
    schools
      .map((school) => {
        const location =
          school.latitude === null || school.longitude === null
            ? "NULL"
            : `ST_SetSRID(ST_MakePoint(${school.longitude}, ${school.latitude}), 4326)::geography(Point, 4326)`;
        return `  (${school.schoolId}, ${sqlString(school.orgName)}, ${sqlString(school.orgType)}, ${sqlNumber(school.latitude)}, ${sqlNumber(school.longitude)}, ${school.enrolmentScheme}, ${location})`;
      })
      .join(",\n") + ";",
  );
  lines.push("", "-- Zones with no polygon in the source file are represented by no row.");

  for (const zone of zones) {
    const geometry = JSON.stringify(zone.geometry);
    if (!geometry) throw new Error(`School ${zone.schoolId} has unserializable zone geometry.`);
    lines.push(
      `INSERT INTO school_zones (school_id, zone_name, zone_type, geom) VALUES (${zone.schoolId}, ${sqlNullableString(zone.zoneName)}, ${sqlNullableString(zone.zoneType)}, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(${sqlString(geometry)})), 3))::geometry(MultiPolygon, 4326));`,
    );
  }

  lines.push(
    "",
    `INSERT INTO school_data_sync (singleton_id, imported_school_count, imported_zone_count, imported_at) VALUES (1, ${schools.length}, ${zones.length}, ${sqlString(generatedAt)})`,
    "ON CONFLICT (singleton_id) DO UPDATE SET",
    "  imported_school_count = EXCLUDED.imported_school_count,",
    "  imported_zone_count = EXCLUDED.imported_zone_count,",
    "  imported_at = EXCLUDED.imported_at;",
    "",
    "COMMIT;",
    "",
  );
  return lines.join("\n");
}
