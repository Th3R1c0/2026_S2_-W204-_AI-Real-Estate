import SiteHeader from "./components/site-header";
import { PropertyGridSkeleton } from "./components/property-skeleton";
import {
  Building2,
  CalendarDays,
  Fence,
  House,
  LayoutGrid,
  Search,
  Trees,
} from "lucide-react";

const filterTypes = [
  { label: "Villa", icon: House },
  { label: "Townhouse", icon: Building2 },
  { label: "Apartment", icon: Building2 },
  { label: "House", icon: House },
  { label: "Lifestyle block", icon: Trees },
  { label: "Section", icon: Fence },
];

export default function Loading() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <h1>
              Find your kind of <em>home.</em>
            </h1>
            <div className="ai-search">
              <div className="search-input-group flex h-14 w-full items-center rounded-2xl border border-input bg-card px-4 text-muted-foreground shadow-sm">
                <Search className="size-5 shrink-0 opacity-50" />
                <span className="ml-3 text-sm opacity-60">
                  A character villa in Ponsonby under $2.5m…
                </span>
                <span className="ml-auto inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground opacity-90">
                  <Search className="mr-1.5 size-3.5" />
                  Search
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="discover-section" id="discover">
          <div className="airbnb-filter-bar mb-6" role="region" aria-label="Property search filters">
            <div className="filter-category-row">
              <div
                aria-label="Property type"
                className="type-grid inline-flex gap-1"
                role="group"
              >
                <div
                  aria-pressed="true"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-medium text-foreground"
                >
                  <LayoutGrid className="size-4" />
                  <span>All homes</span>
                </div>
                {filterTypes.map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground">
                <CalendarDays className="size-4" />
                <span>Open homes</span>
              </div>
            </div>
          </div>
          <div className="results-header">
            <h2>Explore Auckland homes</h2>
          </div>
          <PropertyGridSkeleton />
        </section>
      </main>
    </div>
  );
}
