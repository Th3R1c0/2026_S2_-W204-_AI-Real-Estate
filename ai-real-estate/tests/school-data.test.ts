import { describe, expect, it, vi } from "vitest";

import {
  parseAucklandSchool,
  parseBulkSchoolZoneGeoJson,
  parseSchoolZoneResponse,
} from "../lib/school-data";
import { buildSchoolDataSql } from "../lib/school-data-sql";
import { fetchAucklandSchools, fetchSchoolZones } from "../scripts/sync-school-data";

const directoryRecord = {
  School_Id: 1327,
  Org_Name: "Kauri Park School",
  Org_Type: "Contributing",
  Latitude: -36.805482,
  Longitude: 174.69842,
  Enrolment_Scheme: "Yes",
  Regional_Council: "Auckland Region",
};

describe("Education Counts school data", () => {
  it("keeps only Auckland directory fields and parses enrolment scheme", () => {
    expect(parseAucklandSchool(directoryRecord)).toEqual({
      schoolId: 1327,
      orgName: "Kauri Park School",
      orgType: "Contributing",
      latitude: -36.805482,
      longitude: 174.69842,
      enrolmentScheme: true,
    });
    expect(
      parseAucklandSchool({
        ...directoryRecord,
        Regional_Council: "Wellington Region",
      }),
    ).toBeNull();
  });

  it("rejects invalid coordinates and unknown scheme values", () => {
    expect(() =>
      parseAucklandSchool({ ...directoryRecord, Latitude: 95 }),
    ).toThrow("outside valid ranges");
    expect(() =>
      parseAucklandSchool({ ...directoryRecord, Enrolment_Scheme: "Unknown" }),
    ).toThrow("unsupported Enrolment_Scheme");
  });

  it("rejects zone geometry returned for a different SchoolID", () => {
    expect(() =>
      parseSchoolZoneResponse(
        {
          schoolZones: [
            {
              properties: { SchoolID: 99 },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [174.69, -36.8],
                    [174.7, -36.8],
                    [174.7, -36.81],
                    [174.69, -36.8],
                  ],
                ],
              },
            },
          ],
        },
        1327,
      ),
    ).toThrow("different SchoolID");
  });

  it("extracts only the zone identifiers, labels, and polygon geometry", () => {
    expect(
      parseSchoolZoneResponse(
        {
          schoolZones: [
            {
              type: "Feature",
              properties: {
                SchoolID: 1327,
                PolyName: "Kauri Park School Zone",
                INSTTYPE: "Contributing",
                UnusedSourceValue: "not retained",
              },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [174.69, -36.8],
                    [174.7, -36.8],
                    [174.7, -36.81],
                    [174.69, -36.8],
                  ],
                ],
              },
            },
          ],
        },
        1327,
      ),
    ).toEqual([
      {
        schoolId: 1327,
        zoneIndex: 0,
        zoneName: "Kauri Park School Zone",
        zoneType: "Contributing",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [174.69, -36.8],
              [174.7, -36.8],
              [174.7, -36.81],
              [174.69, -36.8],
            ],
          ],
        },
      },
    ]);
  });

  it("matches bulk zone polygons only to Auckland schools with enrolment schemes", () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [174.69, -36.8],
          [174.7, -36.8],
          [174.7, -36.81],
          [174.69, -36.8],
        ],
      ],
    };
    const zones = parseBulkSchoolZoneGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              SchoolID: 1327,
              PolyName: "Kauri Park School",
              INSTTYPE: "Contributing",
              EffectiveDate: "ignored",
            },
            geometry,
          },
          {
            type: "Feature",
            properties: { SchoolID: 9999, PolyName: "Outside Auckland" },
            geometry,
          },
          {
            type: "Feature",
            properties: { SchoolID: 544, PolyName: "No Scheme School" },
            geometry,
          },
        ],
      },
      [
        {
          schoolId: 1327,
          orgName: "Kauri Park School",
          orgType: "Contributing",
          latitude: -36.8,
          longitude: 174.7,
          enrolmentScheme: true,
        },
        {
          schoolId: 544,
          orgName: "No Scheme School",
          orgType: "Composite",
          latitude: -36.9,
          longitude: 174.8,
          enrolmentScheme: false,
        },
      ],
    );

    expect(zones).toEqual([
      {
        schoolId: 1327,
        zoneIndex: 0,
        zoneName: "Kauri Park School",
        zoneType: "Contributing",
        geometry,
      },
    ]);
  });

  it("rejects invalid bulk zone GeoJSON and coordinates", () => {
    const schools = [
      {
        schoolId: 1327,
        orgName: "Kauri Park School",
        orgType: "Contributing",
        latitude: -36.8,
        longitude: 174.7,
        enrolmentScheme: true,
      },
    ];
    expect(() =>
      parseBulkSchoolZoneGeoJson({ type: "Feature" }, schools),
    ).toThrow("FeatureCollection");
    expect(() =>
      parseBulkSchoolZoneGeoJson(
        {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { SchoolID: 1327 },
              geometry: {
                type: "Polygon",
                coordinates: [[[200, -36], [174, -36], [174, -37], [200, -36]]],
              },
            },
          ],
        },
        schools,
      ),
    ).toThrow("outside WGS84 ranges");
  });

  it("builds a transactional SQL handoff for schools and matched zones", () => {
    const school = {
      schoolId: 1327,
      orgName: "Kauri Park School",
      orgType: "Contributing",
      latitude: -36.8,
      longitude: 174.7,
      enrolmentScheme: true,
    };
    const zone = {
      schoolId: 1327,
      zoneIndex: 0,
      zoneName: "Kauri Park's zone",
      zoneType: "Contributing",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[174.69, -36.8], [174.7, -36.8], [174.7, -36.81], [174.69, -36.8]]]],
      },
    };

    const sql = buildSchoolDataSql([school], [zone], "2026-10-19T03:00:00.000Z");

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("DELETE FROM schools;");
    expect(sql).toContain("'Kauri Park''s zone'");
    expect(sql).toContain("ST_GeomFromGeoJSON(");
    expect(sql).toContain("geometry(MultiPolygon, 4326)");
    expect(sql).toContain("VALUES (1, 1, 1, '2026-10-19T03:00:00.000Z')");
    expect(sql).toContain("COMMIT;");
  });

  it("rejects SQL export when zone data is incomplete or mismatched", () => {
    const school = {
      schoolId: 1327,
      orgName: "Kauri Park School",
      orgType: "Contributing",
      latitude: -36.8,
      longitude: 174.7,
      enrolmentScheme: true,
    };
    expect(() => buildSchoolDataSql([school], [])).toThrow("empty source data");
    expect(() =>
      buildSchoolDataSql([school], [
        {
          schoolId: 9999,
          zoneIndex: 0,
          zoneName: null,
          zoneType: null,
          geometry: { type: "MultiPolygon", coordinates: [] },
        },
      ]),
    ).toThrow("without a matching Auckland school");
  });

  it("fetches every directory page with the Auckland-only filter and whitelisted fields", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      const offset = Number(url.searchParams.get("offset"));
      const schoolId = offset === 0 ? 544 : 1327;
      return Response.json({
        success: true,
        result: {
          total: 2,
          records: [
            {
              ...directoryRecord,
              School_Id: schoolId,
              Org_Name: offset === 0 ? "Al-Madinah School" : "Kauri Park School",
              Regional_Council: "Auckland Region",
            },
          ],
        },
      });
    });

    const schools = await fetchAucklandSchools(fetchMock);
    expect(schools.map(({ schoolId }) => schoolId)).toEqual([544, 1327]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchMock.mock.calls[0][0].toString());
    expect(firstUrl.searchParams.get("fields")).toBe(
      "School_Id,Org_Name,Org_Type,Latitude,Longitude,Enrolment_Scheme,Regional_Council",
    );
    expect(firstUrl.searchParams.get("filters")).toBe(
      JSON.stringify({ Regional_Council: "Auckland Region" }),
    );
  });

  it("requests zone geometry only for schools with an enrolment scheme", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ schoolZones: [] }),
    );
    const zones = await fetchSchoolZones(
      [
        {
          schoolId: 1327,
          orgName: "Kauri Park School",
          orgType: "Contributing",
          latitude: -36.8,
          longitude: 174.7,
          enrolmentScheme: true,
        },
        {
          schoolId: 544,
          orgName: "Al-Madinah School",
          orgType: "Composite",
          latitude: -36.9,
          longitude: 174.8,
          enrolmentScheme: false,
        },
      ],
      fetchMock,
    );

    expect(zones).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("school")).toBe(
      "1327",
    );
  });
});
