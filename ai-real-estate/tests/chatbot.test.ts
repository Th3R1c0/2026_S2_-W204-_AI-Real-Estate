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
});
