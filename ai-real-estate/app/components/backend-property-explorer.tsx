"use client";

import { useEffect, useState } from "react";

import type { Property } from "../../lib/property-types";
import PropertyExplorer from "./property-explorer";

type PropertyResponse = { items: Property[] };

export default function BackendPropertyExplorer() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [sales, setSales] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadListings() {
      try {
        const [propertyResponse, salesResponse] = await Promise.all([
          fetch("/api/properties", { signal: controller.signal }),
          fetch("/api/sales", { signal: controller.signal }),
        ]);
        if (!propertyResponse.ok || !salesResponse.ok) {
          throw new Error("The live property listings could not be loaded.");
        }

        const [propertyData, salesData] = (await Promise.all([
          propertyResponse.json(),
          salesResponse.json(),
        ])) as [PropertyResponse, PropertyResponse];
        setProperties(propertyData.items);
        setSales(salesData.items);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The live property listings could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadListings();
    return () => controller.abort();
  }, []);

  if (isLoading) {
    return <p className="backend-status" role="status">Loading live property listings…</p>;
  }
  if (error) {
    return <p className="backend-status" role="alert">{error} Check the FastAPI and MySQL services, then refresh.</p>;
  }

  return <PropertyExplorer properties={properties} comparableSales={sales} />;
}
