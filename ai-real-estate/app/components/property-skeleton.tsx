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
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-8 h-9 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/3" />
      <Skeleton className="mt-8 h-[45vh] w-full rounded-2xl" />
      <div className="mt-8 flex gap-8">
        <Skeleton className="h-40 flex-1" />
        <Skeleton className="h-40 w-1/3" />
      </div>
      <span className="sr-only">Loading property…</span>
    </main>
  );
}
