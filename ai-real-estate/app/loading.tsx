import SiteHeader from "./components/site-header";
import { PropertyGridSkeleton } from "./components/property-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <Skeleton className="mx-auto h-12 w-2/3" />
          <Skeleton className="mx-auto mt-6 h-14 w-3/4" />
        </section>
        <section className="discover-section">
          <Skeleton className="mb-8 h-24 w-full" />
          <PropertyGridSkeleton />
        </section>
      </main>
    </div>
  );
}
