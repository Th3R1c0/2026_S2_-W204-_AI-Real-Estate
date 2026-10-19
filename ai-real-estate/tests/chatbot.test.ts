import { describe, expect, it } from "vitest";
import { generateChatbotResponse } from "../lib/chatbot-service";
import { POST } from "../app/api/chatbot/route";

describe("Chatbot service (TDD)", () => {
  it("uses local knowledge base when GEMINI_API_KEY is not provided", async () => {
    const result = await generateChatbotResponse(
      "What is Haven?",
      [],
      { apiKey: "" },
    );

    expect(result.source).toBe("local");
    expect(result.reply.toLowerCase()).toContain("haven");
  });

  it("answers common questions about LIM reports and mortgage calculators in local fallback", async () => {
    const limResult = await generateChatbotResponse(
      "What is a LIM report?",
      [],
      { apiKey: "" },
    );
    expect(limResult.source).toBe("local");
    expect(limResult.reply.toLowerCase()).toContain("land information memorandum");

    const mortgageResult = await generateChatbotResponse(
      "How does the mortgage calculator work?",
      [],
      { apiKey: "" },
    );
    expect(mortgageResult.source).toBe("local");
    expect(mortgageResult.reply.toLowerCase()).toContain("mortgage");
  });

  it("calls Gemini API when apiKey is provided", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("generateContent");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("test-api-key");

      const body = JSON.parse(String(init?.body));
      expect(body.contents).toBeDefined();

      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: "Haven is your AI-powered property discovery assistant." }],
            },
          },
        ],
      });
    };

    const result = await generateChatbotResponse(
      "Tell me about Haven",
      [],
      { apiKey: "test-api-key", fetchImpl: fakeFetch },
    );

    expect(result.source).toBe("gemini");
    expect(result.reply).toBe("Haven is your AI-powered property discovery assistant.");
  });

  it("falls back to local knowledge when Gemini API fails", async () => {
    const fakeFetch: typeof fetch = async () => new Response("Error", { status: 500 });

    const result = await generateChatbotResponse(
      "What is Haven?",
      [],
      { apiKey: "test-api-key", fetchImpl: fakeFetch },
    );

    expect(result.source).toBe("local");
    expect(result.reply.toLowerCase()).toContain("haven");
  });

  it("injects compared and saved properties into Gemini systemInstruction", async () => {
    let capturedBody: {
      systemInstruction?: { parts: Array<{ text: string }> };
      contents?: unknown;
    } | null = null;
    const fakeFetch: typeof fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: "Analysis of your compared homes." }],
            },
          },
        ],
      });
    };

    const mockContext = {
      comparedProperties: [
        {
          id: "comp-1",
          address: "2/30 Hardington Street",
          suburb: "Onehunga",
          city: "Auckland",
          price: 740_000,
          bedrooms: 3,
          bathrooms: 2,
          propertyType: "Townhouse",
          floodHazards: ["flood_plains" as const],
          sunlightHours: 7.8,
        },
        {
          id: "comp-2",
          address: "54 Kelmarna Avenue",
          suburb: "Ponsonby",
          city: "Auckland",
          price: 2_525_000,
          bedrooms: 3,
          bathrooms: 1,
          propertyType: "Villa",
          floodHazards: ["coastal_inundation" as const],
          sunlightHours: 5.4,
        },
      ],
      savedProperties: [
        {
          id: "comp-1",
          address: "2/30 Hardington Street",
          suburb: "Onehunga",
          city: "Auckland",
          price: 740_000,
          bedrooms: 3,
          bathrooms: 2,
          propertyType: "Townhouse",
        },
      ],
    };

    await generateChatbotResponse(
      "Compare these homes for me",
      [],
      { apiKey: "test-key", fetchImpl: fakeFetch, context: mockContext },
    );

    expect(capturedBody).toBeDefined();
    const body = capturedBody as unknown as {
      systemInstruction?: { parts: Array<{ text: string }> };
    };
    const systemInstruction = body?.systemInstruction?.parts[0].text;
    expect(systemInstruction).toContain("2/30 Hardington Street");
    expect(systemInstruction).toContain("54 Kelmarna Avenue");
    expect(systemInstruction).toContain("User's Currently Compared Properties");
  });

  it("answers questions about compared properties in local knowledge fallback", async () => {
    const mockContext = {
      comparedProperties: [
        {
          id: "comp-1",
          address: "2/30 Hardington Street",
          suburb: "Onehunga",
          city: "Auckland",
          price: 740_000,
          bedrooms: 3,
          bathrooms: 2,
          propertyType: "Townhouse",
          floodHazards: ["flood_plains" as const],
          sunlightHours: 7.8,
        },
        {
          id: "comp-2",
          address: "54 Kelmarna Avenue",
          suburb: "Ponsonby",
          city: "Auckland",
          price: 2_525_000,
          bedrooms: 3,
          bathrooms: 1,
          propertyType: "Villa",
          floodHazards: ["coastal_inundation" as const],
          sunlightHours: 5.4,
        },
      ],
    };

    const result = await generateChatbotResponse(
      "Compare my selected homes",
      [],
      { apiKey: "", context: mockContext },
    );

    expect(result.source).toBe("local");
    expect(result.reply).toContain("2/30 Hardington Street");
    expect(result.reply).toContain("54 Kelmarna Avenue");
    expect(result.reply).toContain("Best Price Value");
    expect(result.reply).toContain("Mapped Council flood hazards: Flood plains");
    expect(result.reply).toContain("Mapped Council flood hazards: Coastal inundation");
  });

  it("answers questions about saved shortlist in local knowledge fallback", async () => {
    const mockContext = {
      savedProperties: [
        {
          id: "prop-1",
          address: "12 Karaka Street",
          suburb: "Takapuna",
          city: "Auckland",
          price: 1_850_000,
          bedrooms: 4,
          bathrooms: 2,
          propertyType: "House",
          floodHazards: [],
        },
      ],
    };

    const result = await generateChatbotResponse(
      "What are my saved properties?",
      [],
      { apiKey: "", context: mockContext },
    );

    expect(result.source).toBe("local");
    expect(result.reply).toContain("12 Karaka Street");
    expect(result.reply).toContain("1,850,000");
    expect(result.reply).toContain("No mapped Council flood hazard");
  });

  it("provides search campaign planning advice", async () => {
    const mockContext = {
      savedProperties: [
        {
          id: "prop-1",
          address: "12 Karaka Street",
          suburb: "Takapuna",
          city: "Auckland",
          price: 1_850_000,
          bedrooms: 4,
          bathrooms: 2,
          propertyType: "House",
        },
      ],
    };

    const result = await generateChatbotResponse(
      "Help me think about my search campaign and organize my strategy",
      [],
      { apiKey: "", context: mockContext },
    );

    expect(result.source).toBe("local");
    expect(result.reply.toLowerCase()).toContain("campaign");
    expect(result.reply).toContain("LIM");
  });
});

describe("POST /api/chatbot (TDD)", () => {
  it("rejects an empty message with 400", async () => {
    const response = await POST(
      new Request("http://localhost/api/chatbot", {
        method: "POST",
        body: JSON.stringify({ message: "   " }),
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns a valid reply for a valid message", async () => {
    const response = await POST(
      new Request("http://localhost/api/chatbot", {
        method: "POST",
        body: JSON.stringify({ message: "Hello, what can you do?" }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.reply).toBeDefined();
    expect(typeof data.reply).toBe("string");
  });

  it("accepts property context in POST request", async () => {
    const response = await POST(
      new Request("http://localhost/api/chatbot", {
        method: "POST",
        body: JSON.stringify({
          message: "Compare my selected homes",
          context: {
            comparedProperties: [
              {
                id: "1",
                address: "10 Queen St",
                suburb: "Auckland CBD",
                city: "Auckland",
                price: 800_000,
                bedrooms: 2,
                bathrooms: 1,
                propertyType: "Apartment",
              },
              {
                id: "2",
                address: "20 Custom St",
                suburb: "Auckland CBD",
                city: "Auckland",
                price: 950_000,
                bedrooms: 2,
                bathrooms: 2,
                propertyType: "Apartment",
              },
            ],
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.reply).toContain("10 Queen St");
    expect(data.reply).toContain("20 Custom St");
  });
});
