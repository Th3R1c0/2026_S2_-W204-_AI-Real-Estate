import { describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/flood-zones/route";

describe("GET /api/flood-zones", () => {
  it("returns 400 when lat or lng are invalid", async () => {
    const req = new Request("http://localhost:3001/api/flood-zones?lat=invalid&lng=174.76");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("queries Auckland Council ArcGIS flood layers and returns combined GeoJSON FeatureCollection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 101,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [174.76, -36.85],
                  [174.77, -36.85],
                  [174.77, -36.86],
                  [174.76, -36.85],
                ],
              ],
            },
            properties: { OBJECTID: 101 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost:3001/api/flood-zones?lat=-36.85&lng=174.76");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("FeatureCollection");
    expect(Array.isArray(body.features)).toBe(true);
    expect(body.features.length).toBeGreaterThan(0);
    expect(body.features[0].properties.hazardType).toBeDefined();

    vi.unstubAllGlobals();
  });
});
