import {
  generateChatbotResponse,
  type ChatMessage,
} from "../../../lib/chatbot-service";
import type { PropertyChatContext } from "../../../lib/chatbot-knowledge";

export async function POST(request: Request) {
  let body: { message?: unknown; history?: unknown; context?: unknown };

  try {
    body = (await request.json()) as {
      message?: unknown;
      history?: unknown;
      context?: unknown;
    };
  } catch {
    return Response.json({ error: "Please provide a valid question." }, { status: 400 });
  }

  if (typeof body.message !== "string" || !body.message.trim()) {
    return Response.json({ error: "Please enter a message to chat with the AI." }, { status: 400 });
  }

  const message = body.message.trim().slice(0, 1000);
  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is { role: "user" | "model"; text: string } =>
            item &&
            typeof item === "object" &&
            (item.role === "user" || item.role === "model") &&
            typeof item.text === "string",
        )
        .slice(-10)
    : [];

  const context = (body.context && typeof body.context === "object"
    ? body.context
    : undefined) as PropertyChatContext | undefined;

  const result = await generateChatbotResponse(message, history, {
    apiKey: process.env.GEMINI_API_KEY,
    context,
  });

  return Response.json(result);
}
