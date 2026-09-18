import PropertyExplorer from "./components/property-explorer";
import { comparableSales, properties } from "../lib/property-data";

export default function Home() {
  return <PropertyExplorer comparableSales={comparableSales} properties={properties} />;
}
