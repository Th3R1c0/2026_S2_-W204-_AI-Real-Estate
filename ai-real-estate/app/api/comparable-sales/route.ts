import { getNearbyComparableSales } from "../../../lib/db/properties";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyKey = searchParams.get("propertyKey");
  const radiusKm = Number(searchParams.get("radiusKm"));
  const months = Number(searchParams.get("months"));

  if (
    !propertyKey ||
    propertyKey.length > 80 ||
    !Number.isFinite(radiusKm) ||
    radiusKm < 1 ||
    radiusKm > 10 ||
    ![3, 6, 9, 12].includes(months)
  ) {
    return Response.json({ error: "Invalid comparable-sales search parameters." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "Comparable sales require a configured PostgreSQL database with PostGIS enabled." },
      { status: 503 },
    );
  }

  const result = await getNearbyComparableSales(propertyKey, radiusKm, months);
  return Response.json(result);
}
