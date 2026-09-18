import { describe, expect, it } from "vitest";

import { POST } from "../app/api/search/route";

describe("POST /api/search", () => {
  it("rejects an empty property query", async () => {
    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ query: "  " }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Enter a property search to continue.",
    });
  });

  it("returns interpreted filters without exposing server configuration", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const response = await POST(
        new Request("http://localhost/api/search", {
          method: "POST",
          body: JSON.stringify({ query: "character villas in Auckland" }),
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.filters).toEqual({
        architecturalStyles: ["Character"],
        propertyTypes: ["Villa"],
        location: "Auckland",
      });
      expect(body).not.toHaveProperty("apiKey");
    } finally {
      if (previousKey) process.env.GEMINI_API_KEY = previousKey;
    }
  });
});
