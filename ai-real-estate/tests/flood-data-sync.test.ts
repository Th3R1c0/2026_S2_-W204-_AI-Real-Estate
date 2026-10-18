import { describe, expect, it } from "vitest";
import {
  createFeatureQueryUrl,
  FLOOD_DATASETS,
  parseFeaturePage,
} from "../scripts/sync-flood-data";

describe("Auckland Council flood-data importer", () => {
  it("targets only the four requested Council hazard layers", () => {
    expect(FLOOD_DATASETS.map((dataset) => dataset.hazardType)).toEqual([
      "flood_plains",
      "flood_prone_areas",
      "overland_flow_paths",
      "coastal_inundation",
    ]);
    expect(
      FLOOD_DATASETS.every((dataset) => dataset.serviceName.length > 0),
    ).toBe(true);
  });

  it("queries a layer as paginated GeoJSON in the property extent", () => {
    const url = createFeatureQueryUrl(
      FLOOD_DATASETS[0],
      { xmin: 174.7, ymin: -36.9, xmax: 174.8, ymax: -36.8 },
      500,
    );

    expect(url.pathname).toContain("/Flood_Plains/FeatureServer/0/query");
    expect(url.searchParams.get("f")).toBe("geojson");
    expect(url.searchParams.get("outSR")).toBe("4326");
    expect(url.searchParams.get("geometry")).toBe("174.7,-36.9,174.8,-36.8");
    expect(url.searchParams.get("resultOffset")).toBe("500");
    expect(url.searchParams.get("resultRecordCount")).toBe("500");
  });

  it("retains source attributes, geometry, type, and stable object ID", () => {
    const [feature] = parseFeaturePage(
      {
        features: [
          {
            properties: { objectid: 42, Hazard: "Flood plain" },
            geometry: { type: "Polygon", coordinates: [] },
          },
        ],
      },
      FLOOD_DATASETS[0],
      "OBJECTID",
    );

    expect(feature).toMatchObject({
      hazard_type: "flood_plains",
      source_feature_id: "42",
      source_attributes: { objectid: 42, Hazard: "Flood plain" },
      geometry: { type: "Polygon" },
    });
    expect(feature.source_url).toContain("/Flood_Plains/FeatureServer/0");
  });

  it("fails explicitly when an ArcGIS result lacks a source object ID", () => {
    expect(() =>
      parseFeaturePage(
        {
          features: [
            {
              properties: { Hazard: "Flood plain" },
              geometry: { type: "Polygon", coordinates: [] },
            },
          ],
        },
        FLOOD_DATASETS[0],
        "OBJECTID",
      ),
    ).toThrow("has no OBJECTID");
  });
});
