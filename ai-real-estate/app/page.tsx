import PropertyExplorer from "./components/property-explorer";
import { loadPropertyCatalog } from "../lib/property-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { properties, comparableSales, schoolCatalog } = await loadPropertyCatalog(false);

  return (
    <PropertyExplorer
      comparableSales={comparableSales}
      properties={properties}
      schoolDataSynced={schoolCatalog.synced}
      schoolOptions={schoolCatalog.schools}
    />
  );
}
