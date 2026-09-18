import { properties } from "../../../lib/property-data";
import { interpretPropertyQuery } from "../../../lib/gemini-search";

export async function POST(request: Request) {
  let body: { query?: unknown };

  try {
    body = (await request.json()) as { query?: unknown };
  } catch {
    return Response.json({ error: "Enter a property search to continue." }, { status: 400 });
  }

  if (typeof body.query !== "string" || !body.query.trim()) {
    return Response.json({ error: "Enter a property search to continue." }, { status: 400 });
  }

  const query = body.query.trim().slice(0, 500);
  console.log(`[POST /api/search] Incoming query: "${query}"`);

  const result = await interpretPropertyQuery(query, properties, {
    apiKey: process.env.GEMINI_API_KEY,
  });

  console.log("[POST /api/search] Returning interpreted search result:", JSON.stringify(result, null, 2));
  return Response.json(result);
}
