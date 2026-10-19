import { HAVEN_SYSTEM_KNOWLEDGE, findLocalKnowledgeAnswer } from "./chatbot-knowledge";

export type ChatMessage = {
  role: "user" | "model";
  text: string;
};

export type ChatbotResponse = {
  reply: string;
  source: "gemini" | "local";
};

const DEFAULT_GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function generateChatbotResponse(
  message: string,
  history: ChatMessage[] = [],
  options: { apiKey?: string; fetchImpl?: typeof fetch; endpoint?: string } = {},
): Promise<ChatbotResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      reply: "Please enter a question so I can help you.",
      source: "local",
    };
  }

  const apiKey = options.apiKey?.trim();

  // If no Gemini key is provided, answer using the embedded Haven knowledge base
  if (!apiKey) {
    return {
      reply: findLocalKnowledgeAnswer(trimmed),
      source: "local",
    };
  }

  try {
    const formattedHistory = history.slice(-6).map((item) => ({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: item.text }],
    }));

    const contents = [
      ...formattedHistory,
      {
        role: "user",
        parts: [{ text: trimmed }],
      },
    ];

    const endpoint = options.endpoint || DEFAULT_GEMINI_ENDPOINT;
    const fetchFunc = options.fetchImpl || fetch;

    const response = await fetchFunc(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: HAVEN_SYSTEM_KNOWLEDGE }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[AI Chatbot] Gemini endpoint returned ${response.status}, falling back to local.`);
      return {
        reply: findLocalKnowledgeAnswer(trimmed),
        source: "local",
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!replyText) {
      return {
        reply: findLocalKnowledgeAnswer(trimmed),
        source: "local",
      };
    }

    return {
      reply: replyText,
      source: "gemini",
    };
  } catch (error) {
    console.warn("[AI Chatbot] Error communicating with Gemini API, falling back:", error);
    return {
      reply: findLocalKnowledgeAnswer(trimmed),
      source: "local",
    };
  }
}
