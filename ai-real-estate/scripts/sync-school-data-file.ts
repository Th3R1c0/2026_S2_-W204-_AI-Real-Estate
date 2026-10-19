import { execFile as execFileCallback } from "node:child_process";
import { readdir, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  parseBulkSchoolZoneGeoJson,
  type AucklandSchoolRecord,
} from "../lib/school-data";
import { buildSchoolDataSql } from "../lib/school-data-sql";
import {
  fetchAucklandSchools,
  syncSchoolDataWithZones,
} from "./sync-school-data";

const execFile = promisify(execFileCallback);
const MAX_GEOJSON_BYTES = 256 * 1024 * 1024;

async function resolveMapInfoFile(inputPath: string): Promise<string> {
  const resolvedPath = resolve(inputPath);
  const inputStat = await stat(resolvedPath);
  if (inputStat.isFile()) {
    if (!resolvedPath.toLocaleLowerCase().endsWith(".tab")) {
      throw new Error("Pass the MapInfo .TAB file or its extracted folder.");
    }
    return resolvedPath;
  }
  if (!inputStat.isDirectory()) {
    throw new Error("The MapInfo input must be a .TAB file or an extracted folder.");
  }

  const tabFiles = (await readdir(resolvedPath))
    .filter((name) => name.toLocaleLowerCase().endsWith(".tab"))
    .map((name) => resolve(resolvedPath, name));
  if (tabFiles.length !== 1) {
    throw new Error(
      `Expected exactly one MapInfo .TAB file in ${resolvedPath}; found ${tabFiles.length}.`,
    );
  }
  return tabFiles[0];
}

export async function loadBulkSchoolZones(
  inputPath: string,
  schools: AucklandSchoolRecord[],
): Promise<ReturnType<typeof parseBulkSchoolZoneGeoJson>> {
  const eligibleSchoolIds = schools
    .filter(({ enrolmentScheme }) => enrolmentScheme)
    .map(({ schoolId }) => schoolId);
  if (eligibleSchoolIds.length === 0) {
    throw new Error("The Auckland school directory returned no schools with enrolment schemes.");
  }

  const mapInfoFile = await resolveMapInfoFile(inputPath);
  const whereClause = `SchoolID IN (${[...new Set(eligibleSchoolIds)].join(",")})`;
  const { stdout } = await execFile(
    "ogr2ogr",
    [
      "-f",
      "GeoJSON",
      "/vsistdout/",
      mapInfoFile,
      "-where",
      whereClause,
      "-t_srs",
      "EPSG:4326",
      "-nlt",
      "PROMOTE_TO_MULTI",
    ],
    { encoding: "utf8", maxBuffer: MAX_GEOJSON_BYTES },
  );

  let collection: unknown;
  try {
    collection = JSON.parse(stdout);
  } catch (error) {
    throw new Error("GDAL returned invalid GeoJSON for the selected Auckland school zones.", {
      cause: error,
    });
  }

  const zones = parseBulkSchoolZoneGeoJson(collection, schools);
  if (zones.length === 0) {
    throw new Error(
      "No zone polygons in the MapInfo file matched Auckland schools with enrolment schemes; existing data was not replaced.",
    );
  }
  return zones;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const exportIndex = args.indexOf("--export-sql");
  const exportPath = exportIndex === -1 ? undefined : args[exportIndex + 1];
  const paths = args.filter(
    (arg, index) =>
      arg !== "--dry-run" &&
      arg !== "--export-sql" &&
      (exportIndex === -1 || index !== exportIndex + 1),
  );
  if (
    paths.length !== 1 ||
    (dryRun && exportPath !== undefined) ||
    (exportIndex !== -1 && !exportPath)
  ) {
    throw new Error(
      "Usage: npm run db:sync-school-data-file -- <MapInfo .TAB file or extracted folder> [--dry-run | --export-sql <output.sql>]",
    );
  }

  const schools = await fetchAucklandSchools();
  const zones = await loadBulkSchoolZones(paths[0], schools);
  const schoolsWithZones = new Set(zones.map(({ schoolId }) => schoolId)).size;
  const schoolsWithScheme = schools.filter(({ enrolmentScheme }) => enrolmentScheme).length;
  if (exportPath) {
    const generatedAt = new Date().toISOString();
    const sql = buildSchoolDataSql(schools, zones, generatedAt);
    const outputPath = resolve(exportPath);
    await writeFile(outputPath, sql, { encoding: "utf8", flag: "wx" });
    console.info(
      `Created ${outputPath}: ${schools.length} Auckland schools, ${zones.length} zone polygons for ${schoolsWithZones} schools. ${schoolsWithScheme - schoolsWithZones} scheme schools have no polygon in this file.`,
    );
    return;
  }
  if (dryRun) {
    console.info(
      `Dry run complete: ${schools.length} Auckland schools; ${schoolsWithScheme} report an enrolment scheme; ${zones.length} zone polygons matched ${schoolsWithZones} schools; ${schoolsWithScheme - schoolsWithZones} scheme schools have no polygon in this file. No database changes made.`,
    );
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL before importing Education Counts school data.");
  }
  const pool = new Pool({ connectionString });
  try {
    await syncSchoolDataWithZones(pool, schools, zones);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error("Bulk Education Counts school-data import failed:", error);
    process.exitCode = 1;
  });
}
