import { NextResponse } from "next/server";
import type { FloodHazardType } from "../../../lib/property-types";

const FLOOD_LAYERS: Array<{
  type: FloodHazardType;
  label: string;
  color: string;
  url: string;
}> = [
  {
    type: "flood_plains",
    label: "Flood plain (100-yr)",
    color: "#2563eb",
    url: "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Plains/FeatureServer/0",
  },
  {
    type: "flood_prone_areas",
    label: "Flood prone area",
    color: "#7c3aed",
    url: "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Prone_Areas/FeatureServer/0",
  },
  {
    type: "overland_flow_paths",
    label: "Overland flow path",
    color: "#0ea5e9",
    url: "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Overland_Flow_Paths/FeatureServer/0",
  },
  {
    type: "coastal_inundation",
    label: "Coastal inundation (100-yr)",
    color: "#0d9488",
    url: "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Coastal_Inundation_100_yr_return/FeatureServer/0",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid lat or lng" }, { status: 400 });
  }

  // ~450m bounding box around the property
  const delta = 0.004;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

  const layerResults = await Promise.all(
    FLOOD_LAYERS.map(async (layer) => {
      try {
        const query = new URL(`${layer.url}/query`);
        query.searchParams.set("geometry", bbox);
        query.searchParams.set("geometryType", "esriGeometryEnvelope");
        query.searchParams.set("inSR", "4326");
        query.searchParams.set("spatialRel", "esriSpatialRelIntersects");
        query.searchParams.set("outFields", "OBJECTID");
        query.searchParams.set("returnGeometry", "true");
        query.searchParams.set("outSR", "4326");
        query.searchParams.set("resultRecordCount", "60");
        query.searchParams.set("f", "geojson");

        const res = await fetch(query.toString(), {
          next: { revalidate: 3600 },
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data?.features)) return [];
        return data.features.map((feat: Record<string, unknown>) => ({
          ...feat,
          properties: {
            ...(typeof feat.properties === "object" && feat.properties ? feat.properties : {}),
            hazardType: layer.type,
            hazardLabel: layer.label,
            color: layer.color,
            sourceUrl: layer.url,
          },
        }));
      } catch {
        return [];
      }
    }),
  );

  return NextResponse.json(
    {
      type: "FeatureCollection",
      features: layerResults.flat(),
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
