import SiteHeader from "./components/site-header";
import { PropertyGridSkeleton } from "./components/property-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-location">Auckland, New Zealand</p>
            <h1>
              Find your kind of <em>home.</em>
            </h1>
            <div className="ai-search">
              <Skeleton
                aria-label="Loading search bar"
                className="mx-auto h-14 w-full rounded-2xl"
              />
            </div>
          </div>
        </section>
        <section className="discover-section" id="discover">
          <div className="results-header">
            <h2>Explore Auckland homes</h2>
          </div>
          <PropertyGridSkeleton />
        </section>
      </main>
    </div>
  );
}
