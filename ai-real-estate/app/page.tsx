import PropertyExplorer from "./components/property-explorer";
import {
  getAucklandSchoolOptions,
  getComparableSales,
  getPropertiesByStatus,
} from "../lib/db/properties";
import { comparableSales as seedSales, properties as seedProperties } from "../lib/property-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [properties, comparableSales, schoolCatalog] = process.env.DATABASE_URL
    ? await Promise.all([
        getPropertiesByStatus("active"),
        getComparableSales(),
        getAucklandSchoolOptions(),
      ])
    : [seedProperties, seedSales, { synced: false, schools: [] }];

  return (
    <PropertyExplorer
      comparableSales={comparableSales}
      properties={properties}
      schoolDataSynced={schoolCatalog.synced}
      schoolOptions={schoolCatalog.schools}
    />
  );
}
