import PropertyExplorer from "./components/property-explorer";
import { loadPropertyCatalog } from "../lib/property-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { properties, comparableSales } = await loadPropertyCatalog(true);
  return <PropertyExplorer comparableSales={comparableSales} properties={properties} />;
}
