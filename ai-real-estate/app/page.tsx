import PropertyExplorer from "./components/property-explorer";
import { getComparableSales, getPropertiesByStatus } from "../lib/db/properties";
import { comparableSales as seedSales, properties as seedProperties } from "../lib/property-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [properties, comparableSales] = process.env.DATABASE_URL
    ? await Promise.all([getPropertiesByStatus("active"), getComparableSales()])
    : [seedProperties, seedSales];

  return <PropertyExplorer comparableSales={comparableSales} properties={properties} />;
}
