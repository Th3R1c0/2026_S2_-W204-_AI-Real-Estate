import {
  generateChatbotResponse,
  type ChatMessage,
} from "../../../lib/chatbot-service";
import type { PropertyChatContext } from "../../../lib/chatbot-knowledge";
import { loadPropertyCatalog } from "../../../lib/property-catalog";

export async function POST(request: Request) {
  let body: { message?: unknown; history?: unknown; context?: unknown; currentPropertyId?: unknown };

  try {
    body = (await request.json()) as {
      message?: unknown;
      history?: unknown;
      context?: unknown;
      currentPropertyId?: unknown;
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

  const rawContext =
    body.context && typeof body.context === "object"
      ? (body.context as Record<string, unknown>)
      : undefined;

  let context: PropertyChatContext | undefined;
  if (rawContext) {
    const rawLim = rawContext.limReport as Record<string, unknown> | undefined;
    context = {
      savedProperties: Array.isArray(rawContext.savedProperties)
        ? (rawContext.savedProperties as PropertyChatContext["savedProperties"])
        : undefined,
      comparedProperties: Array.isArray(rawContext.comparedProperties)
        ? (rawContext.comparedProperties as PropertyChatContext["comparedProperties"])
        : undefined,
      limReport:
        rawLim &&
        typeof rawLim.filename === "string" &&
        typeof rawLim.text === "string"
          ? {
              filename: rawLim.filename,
              text: rawLim.text,
              pageCount:
                typeof rawLim.pageCount === "number" ? rawLim.pageCount : undefined,
            }
          : undefined,
    };
  }

  if (typeof body.currentPropertyId === "string" && body.currentPropertyId.length <= 300) {
    const { properties } = await loadPropertyCatalog(false);
    const property = properties.find(({ id }) => id === body.currentPropertyId);
    if (property) {
      context = {
        ...context,
        currentProperty: {
          ...property,
          floodHazards: property.floodHazards?.map(({ type }) => type),
        },
      };
    }
  }

  const result = await generateChatbotResponse(message, history, {
    apiKey: process.env.GEMINI_API_KEY,
    context,
  });

  return Response.json(result);
}
