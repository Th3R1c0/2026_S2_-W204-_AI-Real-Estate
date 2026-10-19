import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export function PropertyGridSkeleton() {
  return (
    <div
      className="property-grid"
      role="status"
      aria-label="Loading homes"
      aria-busy="true"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div className="property-card-skeleton" key={index}>
          <Skeleton className="aspect-[1.22] w-full rounded-2xl" />
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-3 h-4 w-1/3" />
        </div>
      ))}
      <span className="sr-only">Loading homes…</span>
    </div>
  );
}

export function PropertyPageSkeleton() {
  return (
    <main
      className="property-page-main"
      role="status"
      aria-label="Loading property"
      aria-busy="true"
    >
      <Link className="back-link" href="/">
        ← All homes
      </Link>
      <div className="property-page-header">
        <div className="flex-1">
          <p className="property-type-line">Auckland Residence</p>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
        <div className="property-page-price-block">
          <span className="property-page-price-label">Indicative Value</span>
          <Skeleton className="h-7 w-32" />
        </div>
      </div>

      <Skeleton className="mb-8 h-[380px] w-full rounded-2xl" />

      <div className="property-page-columns">
        <div className="property-page-left">
          <div className="property-key-specs">
            {["Bedrooms", "Bathrooms", "Parking", "Floor area", "Land area", "Year built"].map(
              (label) => (
                <div className="key-spec-item" key={label}>
                  <Skeleton className="h-5 w-12" />
                  <span>{label}</span>
                </div>
              ),
            )}
          </div>

          <section className="property-map-block">
            <div className="property-map-header">
              <h2>The neighbourhood</h2>
            </div>
            <Skeleton className="h-[340px] w-full rounded-xl" />
          </section>

          <section className="property-section-block">
            <div className="property-section-header">
              <h2>Market history & valuations</h2>
            </div>
            <div className="valuation-cards-grid">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          </section>

          <section className="property-section-block">
            <div className="property-section-header">
              <h2>Mortgage calculator</h2>
            </div>
            <Skeleton className="h-44 w-full rounded-xl" />
          </section>
        </div>

        <aside className="property-page-sidebar">
          <div className="property-sidebar-card">
            <div className="sidebar-open-homes">
              <h4>Open homes</h4>
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </aside>
      </div>
      <span className="sr-only">Loading property…</span>
    </main>
  );
}
