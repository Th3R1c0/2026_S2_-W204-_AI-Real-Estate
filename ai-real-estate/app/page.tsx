import PropertyExplorer from "./components/property-explorer";
import { getComparableSales, getPropertiesByStatus } from "../lib/db/properties";
import { comparableSales as seedSales, properties as seedProperties } from "../lib/property-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  let properties = seedProperties;
  let comparableSales = seedSales;

  if (process.env.DATABASE_URL) {
    try {
      const [dbProperties, dbSales] = await Promise.all([
        getPropertiesByStatus("active"),
        getComparableSales(),
      ]);
      properties = dbProperties;
      comparableSales = dbSales;
    } catch (error) {
      console.warn("[Database] Connection unavailable, falling back to local dataset:", error);
    }
  }

  return <PropertyExplorer comparableSales={comparableSales} properties={properties} />;
}
