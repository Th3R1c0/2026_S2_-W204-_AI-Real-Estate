import type { Metadata } from "next";
import ComparisonDesigns from "../components/comparison-designs";
import { properties } from "../../lib/property-data";

export const metadata: Metadata = {
  title: "Comparison studio — Haven",
  robots: { index: false, follow: false },
};

export default function ComparisonDesignsPage() {
  const homes = ["linz-1881788", "linz-1501646", "oneroof-aiJJ3"].flatMap(
    (id) => {
      const home = properties.find((p) => p.id === id);
      return home ? [home] : [];
    },
  );
  return <ComparisonDesigns properties={homes} />;
}
