import { proxyBackendRequest } from "../../../lib/backend-proxy";
import { interpretPropertyQuery } from "../../../lib/gemini-search";
import type { Property } from "../../../lib/property-types";

type PropertyResponse = { items: Property[] };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a property search to continue." }, { status: 400 });
  }

  const queryValue =
    typeof body === "object" && body !== null && "query" in body
      ? body.query
      : undefined;
  if (typeof queryValue !== "string" || !queryValue.trim()) {
    return Response.json({ error: "Enter a property search to continue." }, { status: 400 });
  }

  const query = queryValue.trim().slice(0, 500);
  const listingsResponse = await proxyBackendRequest("/api/v1/properties");
  if (!listingsResponse.ok) {
    return Response.json(
      { error: "Live property listings are unavailable. Please try again shortly." },
      { status: listingsResponse.status },
    );
  }
  const listingData = (await listingsResponse.json()) as PropertyResponse;
  if (!Array.isArray(listingData.items)) {
    return Response.json(
      { error: "The property service returned an invalid listing response." },
      { status: 502 },
    );
  }

  console.log(`[POST /api/search] Incoming query: "${query}"`);

  const result = await interpretPropertyQuery(query, listingData.items, {
    apiKey: process.env.GEMINI_API_KEY,
  });

  console.log("[POST /api/search] Returning interpreted search result:", JSON.stringify(result, null, 2));
  return Response.json(result);
}
