export const SCHOOL_DIRECTORY_RESOURCE_ID = "4b292323-9fcc-41f8-814b-3c7b19cf14b3";
export const SCHOOL_DIRECTORY_URL =
  "https://catalogue.data.govt.nz/api/3/action/datastore_search";
export const SCHOOL_ZONE_URL =
  "https://www.educationcounts.govt.nz/js-content/school-enrolment-zone-geo-data";
export const AUCKLAND_REGIONAL_COUNCIL = "Auckland Region";
export const SCHOOL_NEARBY_RADIUS_METRES = 2_500;

export type AucklandSchoolRecord = {
  schoolId: number;
  orgName: string;
  orgType: string;
  latitude: number | null;
  longitude: number | null;
  enrolmentScheme: boolean;
};

export type SchoolZoneFeature = {
  schoolId: number;
  zoneIndex: number;
  zoneName: string | null;
  zoneType: string | null;
  geometry: Record<string, unknown>;
};

function record(value: unknown, description: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${description} received from Education Counts.`);
  }
  return value as Record<string, unknown>;
}

function coordinate(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Invalid ${name} received from Education Counts.`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name} received from Education Counts.`);
  }
  return parsed;
}

function validateGeometryCoordinates(value: unknown, schoolId: number): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`School ${schoolId} returned invalid enrolment-zone coordinates.`);
  }
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const longitude = value[0];
    const latitude = value[1];
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error(`School ${schoolId} returned coordinates outside WGS84 ranges.`);
    }
    return;
  }
  for (const child of value) validateGeometryCoordinates(child, schoolId);
}

export function parseAucklandSchool(value: unknown): AucklandSchoolRecord | null {
  const input = record(value, "school directory record");
  if (input.Regional_Council !== AUCKLAND_REGIONAL_COUNCIL) return null;

  const schoolId = Number(input.School_Id);
  if (!Number.isSafeInteger(schoolId) || schoolId <= 0) {
    throw new Error("Invalid School_Id received from Education Counts.");
  }
  if (typeof input.Org_Name !== "string" || !input.Org_Name.trim()) {
    throw new Error(`School ${schoolId} has no valid Org_Name.`);
  }
  if (typeof input.Org_Type !== "string" || !input.Org_Type.trim()) {
    throw new Error(`School ${schoolId} has no valid Org_Type.`);
  }
  const latitude = coordinate(input.Latitude, "Latitude");
  const longitude = coordinate(input.Longitude, "Longitude");
  if ((latitude === null) !== (longitude === null)) {
    throw new Error(`School ${schoolId} has only one coordinate.`);
  }
  if (
    (latitude !== null && (latitude < -90 || latitude > 90)) ||
    (longitude !== null && (longitude < -180 || longitude > 180))
  ) {
    throw new Error(`School ${schoolId} has coordinates outside valid ranges.`);
  }

  const scheme = String(input.Enrolment_Scheme ?? "").trim().toLocaleLowerCase();
  if (scheme !== "yes" && scheme !== "no") {
    throw new Error(`School ${schoolId} has an unsupported Enrolment_Scheme value.`);
  }

  return {
    schoolId,
    orgName: input.Org_Name.trim(),
    orgType: input.Org_Type.trim(),
    latitude,
    longitude,
    enrolmentScheme: scheme === "yes",
  };
}

function findProperty(
  properties: Record<string, unknown>,
  requestedName: string,
): unknown {
  const key = Object.keys(properties).find(
    (candidate) => candidate.toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
  );
  return key ? properties[key] : undefined;
}

export function parseSchoolZoneResponse(
  value: unknown,
  schoolId: number,
): SchoolZoneFeature[] {
  const response = record(value, "school-zone response");
  if (!Array.isArray(response.schoolZones)) {
    throw new Error(`School ${schoolId} returned no schoolZones array.`);
  }

  return response.schoolZones.map((rawFeature, zoneIndex) => {
    const feature = record(rawFeature, `zone feature for school ${schoolId}`);
    if (feature.type !== undefined && feature.type !== "Feature") {
      throw new Error(`School ${schoolId} returned a non-GeoJSON feature.`);
    }
    const geometry = record(feature.geometry, `zone geometry for school ${schoolId}`);
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      throw new Error(`School ${schoolId} returned a non-polygon enrolment zone.`);
    }
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new Error(`School ${schoolId} returned an empty enrolment zone.`);
    }
    validateGeometryCoordinates(geometry.coordinates, schoolId);
    const properties =
      feature.properties === undefined || feature.properties === null
        ? {}
        : record(feature.properties, `zone properties for school ${schoolId}`);
    const featureSchoolId = findProperty(properties, "SchoolID");
    if (
      featureSchoolId !== undefined &&
      Number(featureSchoolId) !== schoolId
    ) {
      throw new Error(`School ${schoolId} received a zone for a different SchoolID.`);
    }
    const zoneName = findProperty(properties, "PolyName");
    const zoneType = findProperty(properties, "INSTTYPE");

    return {
      schoolId,
      zoneIndex,
      zoneName: typeof zoneName === "string" && zoneName.trim() ? zoneName.trim() : null,
      zoneType: typeof zoneType === "string" && zoneType.trim() ? zoneType.trim() : null,
      geometry,
    };
  });
}

export function parseBulkSchoolZoneGeoJson(
  value: unknown,
  schools: AucklandSchoolRecord[],
): SchoolZoneFeature[] {
  const collection = record(value, "bulk school-zone GeoJSON");
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("The bulk school-zone file did not produce a GeoJSON FeatureCollection.");
  }

  const eligibleSchoolIds = new Set(
    schools
      .filter(({ enrolmentScheme }) => enrolmentScheme)
      .map(({ schoolId }) => schoolId),
  );
  const zoneIndexes = new Map<number, number>();
  const zones: SchoolZoneFeature[] = [];

  for (const rawFeature of collection.features) {
    const feature = record(rawFeature, "bulk school-zone feature");
    const properties = record(feature.properties, "bulk school-zone properties");
    const schoolId = Number(findProperty(properties, "SchoolID"));
    if (!Number.isSafeInteger(schoolId) || schoolId <= 0) {
      throw new Error("The bulk school-zone file contains an invalid SchoolID.");
    }
    if (!eligibleSchoolIds.has(schoolId)) continue;

    const geometry = record(feature.geometry, `zone geometry for school ${schoolId}`);
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      throw new Error(`School ${schoolId} has a non-polygon geometry in the bulk zone file.`);
    }
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new Error(`School ${schoolId} has an empty geometry in the bulk zone file.`);
    }
    validateGeometryCoordinates(geometry.coordinates, schoolId);

    const zoneIndex = zoneIndexes.get(schoolId) ?? 0;
    zoneIndexes.set(schoolId, zoneIndex + 1);
    const zoneName = findProperty(properties, "PolyName");
    const zoneType = findProperty(properties, "INSTTYPE");
    zones.push({
      schoolId,
      zoneIndex,
      zoneName: typeof zoneName === "string" && zoneName.trim() ? zoneName.trim() : null,
      zoneType: typeof zoneType === "string" && zoneType.trim() ? zoneType.trim() : null,
      geometry,
    });
  }

  return zones;
}
