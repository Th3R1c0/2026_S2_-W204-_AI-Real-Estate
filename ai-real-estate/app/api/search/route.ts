import { interpretPropertyQuery } from "../../../lib/gemini-search";
import { getPropertiesByStatus } from "../../../lib/db/properties";
import { properties as seedProperties } from "../../../lib/property-data";

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

  let properties = seedProperties;
  if (process.env.DATABASE_URL) {
    try {
      properties = await getPropertiesByStatus("active");
    } catch (error) {
      console.warn("[Database] Search fallback to local dataset:", error);
    }
  }
  const result = await interpretPropertyQuery(query, properties, {
    apiKey: process.env.GEMINI_API_KEY,
  });

  console.log("[POST /api/search] Returning interpreted search result:", JSON.stringify(result, null, 2));
  return Response.json(result);
}
