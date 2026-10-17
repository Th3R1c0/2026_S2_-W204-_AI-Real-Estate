import PropertyExplorer from "./components/property-explorer";
import { getComparableSales, getPropertiesByStatus } from "../lib/db/properties";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [properties, comparableSales] = await Promise.all([
    getPropertiesByStatus("active"),
    getComparableSales(),
  ]);

  return <PropertyExplorer comparableSales={comparableSales} properties={properties} />;
}
