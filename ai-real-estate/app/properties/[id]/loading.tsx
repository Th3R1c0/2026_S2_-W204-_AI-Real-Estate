import SiteHeader from "../../components/site-header";
import { PropertyPageSkeleton } from "../../components/property-skeleton";

export default function Loading() {
  return (
    <div className="site-shell property-page-shell">
      <SiteHeader />
      <PropertyPageSkeleton />
    </div>
  );
}
