import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/comparable-sales/route";

describe("comparable sales route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects invalid search parameters", async () => {
    const response = await GET(
      new Request("http://localhost/api/comparable-sales?propertyKey=home&radiusKm=0&months=6"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid comparable-sales search parameters.",
    });
  });

  it("requires a PostgreSQL database for spatial calculations", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const response = await GET(
      new Request(
        "http://localhost/api/comparable-sales?propertyKey=home&radiusKm=2&months=6",
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Comparable sales require a configured PostgreSQL database with PostGIS enabled.",
    });
  });
});
