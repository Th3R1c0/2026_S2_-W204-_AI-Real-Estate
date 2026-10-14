import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getProperties } from "../app/api/properties/route";
import { GET as getSales } from "../app/api/sales/route";

afterEach(() => vi.unstubAllGlobals());

describe("FastAPI proxy routes", () => {
  it("forwards property requests and query parameters to FastAPI", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await getProperties(
      new Request("http://localhost/api/properties?city=Auckland"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      `${(process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")}/api/v1/properties?city=Auckland`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
  });

  it("forwards sale requests and reports backend connection failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("connection refused");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getSales(new Request("http://localhost/api/sales"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      detail: "The property service is unavailable. Please try again shortly.",
    });
  });
});
