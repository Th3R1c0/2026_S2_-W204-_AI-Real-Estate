import { notFound } from "next/navigation";
import PropertyDetailPage from "../../components/property-detail-page";
import { loadPropertyCatalog } from "../../../lib/property-catalog";

export const revalidate = 300;

export async function generateStaticParams() {
  const { properties } = await loadPropertyCatalog(false);
  return properties.map((property) => ({
    id: encodeURIComponent(property.id),
  }));
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { properties } = await loadPropertyCatalog(false);

  const property = properties.find((item) => item.id === decodedId);
  if (!property) {
    notFound();
  }

  return <PropertyDetailPage property={property} />;
}
