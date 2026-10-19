import { notFound } from "next/navigation";
import PropertyDetailPage from "../../components/property-detail-page";
import { loadPropertyCatalog } from "../../../lib/property-catalog";

export const dynamic = "force-dynamic";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { properties, comparableSales } = await loadPropertyCatalog(true);

  const property = properties.find((item) => item.id === decodedId);
  if (!property) {
    notFound();
  }

  return (
    <PropertyDetailPage
      comparableSales={comparableSales}
      property={property}
    />
  );
}
