import { generateChatbotResponse, type ChatMessage } from "../../../lib/chatbot-service";

export async function POST(request: Request) {
  let body: { message?: unknown; history?: unknown };

  try {
    body = (await request.json()) as { message?: unknown; history?: unknown };
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

  const result = await generateChatbotResponse(message, history, {
    apiKey: process.env.GEMINI_API_KEY,
  });

  return Response.json(result);
}
