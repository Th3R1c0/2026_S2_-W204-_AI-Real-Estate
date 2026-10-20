import { afterEach, expect, it, vi } from "vitest";
import { properties } from "../lib/property-data";
import { generateChatbotResponse } from "../lib/chatbot-service";

vi.mock("../lib/db/properties", async () => {
  const { properties } = await import("../lib/property-data");
  return { getPropertiesByStatus: vi.fn(async () => properties) };
});
import { POST } from "../app/api/chatbot/route";

afterEach(() => vi.unstubAllEnvs());

it("answers about the current page using the catalog property without requiring a save", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const response = await POST(
    new Request("http://localhost/api/chatbot", {
      method: "POST",
      body: JSON.stringify({
        message: "Tell me about this property",
        currentPropertyId: properties[0].id,
      }),
    }),
  );
  expect((await response.json()).reply).toContain(properties[0].address);
});

it("sends the current property facts to Gemini separately from the shortlist", async () => {
  let instruction = "";
  await generateChatbotResponse("Does this house have parking?", [], {
    apiKey: "test-key",
    context: {
      currentProperty: { ...properties[0], floodHazards: [], parkingSpaces: 4 },
    },
    fetchImpl: async (_url, init) => {
      instruction = JSON.parse(String(init?.body)).systemInstruction.parts[0]
        .text;
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Four spaces." }] } }],
      });
    },
  });
  expect(instruction).toContain("Currently viewed property");
  expect(instruction).toContain(properties[0].address);
  expect(instruction).toContain("Parking: 4");
});
