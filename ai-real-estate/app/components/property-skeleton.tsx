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
        <div className="property-card property-card-skeleton" key={index}>
          <div className="property-media">
            <Skeleton className="h-full w-full rounded-[14px]" />
          </div>
          <div className="property-body">
            <Skeleton className="h-4 w-3/4 rounded-sm" />
            <Skeleton className="mt-1.5 h-3.5 w-1/2 rounded-sm" />
            <Skeleton className="mt-3 h-3.5 w-2/3 rounded-sm" />
            <div className="mt-2.5 flex items-center gap-2">
              <Skeleton className="h-5 w-2/5 rounded-sm" />
              <Skeleton className="h-4 w-16 rounded-sm" />
            </div>
          </div>
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
          <Skeleton className="h-9 w-2/3 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-1/3 rounded-md" />
        </div>
        <div className="property-page-price-block">
          <span className="property-page-price-label">Indicative Value</span>
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
      </div>

      <div className="property-mosaic-section">
        <div className="property-mosaic-grid">
          <Skeleton className="mosaic-main-item h-full w-full" />
          <Skeleton className="mosaic-sub-item h-full w-full" />
          <Skeleton className="mosaic-sub-item h-full w-full" />
          <Skeleton className="mosaic-sub-item h-full w-full" />
          <Skeleton className="mosaic-sub-item h-full w-full" />
        </div>
      </div>

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
            <div className="property-location-map">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
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
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </aside>
      </div>
      <span className="sr-only">Loading property…</span>
    </main>
  );
}
