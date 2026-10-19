# Scraping and Map Improvements — Design Specification

**Date:** 2026-10-20
**Branch:** `scraping-and-map-improvements`

## 1. Overview & Goals

Enhance the Haven real estate platform across four cohesive areas while preserving the minimalistic Airbnb x Notion aesthetic and shadcn UI component system:

1. **OneRoof Scraper & Database Ingestion (Real Data Only)**:
   - Extract full multi-paragraph property descriptions (`summary` / `properties.body`), historical rating valuations (`property_valuations`), monthly OneRoof AVM estimates + low/high bands (`property_valuations`), verified past sales (`property_sales`), and real public record facts (land value, improvement value, legal description, unitary plan zone, wall/roof construction, contour, title number, decade built) directly from OneRoof's Next.js RSC stream without requiring browser clicks.
   - Remove all synthetic/fake data (`sunlightHours`, `orientation`, invented `architecturalStyle`).
   - Seed and query all new fields in PostgreSQL (`properties.body`, `property_valuations`, `property_sales`).
2. **Unified Google Maps Component (`@vis.gl/react-google-maps`) with 3 Interactive Modes**:
   - Replace OpenStreetMap/Leaflet with Google Maps Platform (`@vis.gl/react-google-maps`) following all `google-maps-platform` skill rules (`internalUsageAttributionIds={['gmp_git_agentskills_v1']}`, `mapId="DEMO_MAP_ID"`, `AdvancedMarker`, `useMapsLibrary('routes')`, `useMapsLibrary('places')`).
   - Consolidate **Schools**, **Commute**, and **Flood Assessment** into three interactive modes inside the Neighbourhood Map block with icon toggles (`GraduationCap`, `Car`/`Route`, `Waves`), removing their standalone page sections/accordions.
3. **Property Detail Page Cleanup & Visual Hierarchy**:
   - Add Lucide icons to the key specs strip (`Bed`, `Bath`, `Car`, `Maximize2`, `LandPlot`, `Calendar`).
   - Render the scraped property description above the attributes grid with a clean shadcn `Collapsible` "Read more / Show less" toggle for long descriptions.
   - Show only verified property attributes (no fake sunlight/orientation).
   - Remove Comparable Sales completely.
   - Replace the bottom research accordions with two always-visible, mobile-optimized sections: **Market History & Valuations** (visualizing AVM estimate band, CV breakdown, AVM trend, RV reassessment timeline, and past sales) followed by the **Mortgage Calculator** at the bottom.
4. **Fast, Non-Blocking Loading**:
   - Render available text/layout immediately on both the Home page and Property Detail page without blocking the entire page behind full-screen skeletons; use targeted `<Skeleton>` placeholders only for async media/map/route widgets.

---

## 2. Component & Data Architecture

### 2.1 Scraper & Data Pipeline
- **`scripts/enrich-flood-and-open-homes.mjs`** (or dedicated OneRoof enrichment pass):
  - Fetches each OneRoof listing URL in `reports/forsale-raw-harvest.json`.
  - Reconstructs the Next.js RSC stream (`self.__next_f.push([1, "..."])`) and extracts:
    - Full HTML/text description from RSC text chunk (`description: "$<id>"`) or DOM fallback, stripped to clean paragraphs.
    - `avm` object: `avm` (median), `low`, `high`, `confidenceScore`, `rv`, `rvTime`.
    - `publicRecords` object: `landValue`, `improvementValue`, `rateableValue`, `valuationAt`, `rateableValueChange`, plus `data` array items (`Property Type`, `Floor Area`, `Decade Built`, `Title`, `Title Number`, `Contour`, `Broadband`, `Construction`, `Condition`, `Estate Description`, `Council`, `Legal Description`, `Unitary Plan`).
    - `overTime.avm`: array of `{ date, month, avm }` monthly AVM valuations.
    - `histories`: array of `{ type: "list" | "cv" | "sale" | "build", label, labelTime, labelValue, labelExtra, saleTypeDes }`.
- **`scripts/build-forsale-dataset.mjs`**:
  - Maps the enriched OneRoof data into `reports/forsale-properties.json`:
    - `summary`: full scraped description.
    - `valuationHistory`: structured valuation records including OneRoof Estimate (with `lowEstimate`, `medianEstimate`, `highEstimate`), Council RV reassessments (with `capitalValue`, `landValue`, `improvementValue`), and monthly AVM series.
    - `pastSales`: verified past sales from OneRoof `histories` (`type === "sale"`) and Homes/PropertyValue records.
    - `publicRecordFacts` / real attributes (`landValue`, `improvementValue`, `legalDescription`, `unitaryPlanZone`, `construction`, `contour`, `titleNumber`, `yearBuilt` from real building age/decade).
    - Removes synthetic `orientation`, `sunlightHours`, and invented `architecturalStyle`.
- **Database (`scripts/seed.ts` & `lib/db/properties.ts`)**:
  - `scripts/seed.ts`:
    - Stores `property.summary` in `properties.body`.
    - Inserts `property.valuationHistory` rows into `property_valuations`.
    - Inserts `property.pastSales` rows into `property_sales` for active properties as well.
  - `lib/db/properties.ts`:
    - Selects `properties.body` as `summary`.
    - Queries `property_valuations` and `property_sales` for all loaded properties and maps them to `valuationHistory` and `pastSales`.

### 2.2 Unified Google Map (`app/components/property-location-map.tsx`)
- Uses `@vis.gl/react-google-maps`:
  - `<APIProvider apiKey={googleMapsApiKey}>`
  - `<Map mapId="DEMO_MAP_ID" internalUsageAttributionIds={["gmp_git_agentskills_v1"]} defaultCenter={{ lat: latitude, lng: longitude }} defaultZoom={15} gestureHandling="cooperative">`
- **Mode Switcher (`ToggleGroup` inside Map Header)**:
  - **Schools Mode (`schools`)**:
    - Renders `<AdvancedMarker>` for each school in `nearbySchools` (or fallback `schoolZones`) with a custom pill/pin containing a `<GraduationCap />` icon and the school's name label directly underneath.
    - Clicking a marker or a row in the selectable schools list below the map sets `selectedSchoolId`, smoothly pans/focuses the Google Map to that school's coordinates, and displays the school's full details (type, distance, enrolment zone status, in-zone badge).
  - **Commute Mode (`commute`)**:
    - Integrates destination lookup using `useMapsLibrary("places")` (`AutocompleteSuggestion` / `PlaceAutocompleteElement` or `Place.searchByText` with `internalUsageAttributionIds: ["gmp_git_agentskills_v1"]`) so users can search and save locations in Google Maps.
    - Travel mode selector with icons: Driving (`Car`), Public Transport (`TrainFront`), Cycling (`Bike`), Walking (`Footprints`).
    - Uses `useMapsLibrary("routes")` (`new routesLib.Route().computeRoutes(...)`) to compute real travel time and distance from the property to each saved destination and draw the route polyline on the Google Map.
  - **Flood Assessment Mode (`flood`)**:
    - Fetches GeoJSON features from `/api/flood-zones?lat=...&lng=...` (which queries Auckland Council's ArcGIS FeatureServers for `flood_plains`, `flood_prone_areas`, `overland_flow_paths`, and `coastal_inundation` within a bounding envelope around the property).
    - Overlays the polygons and polylines onto the Google Map via `map.data` with distinct colors:
      - Flood plains (`#2563eb` blue fill/stroke)
      - Flood-prone areas (`#d97706` amber fill/stroke)
      - Overland flow paths (`#0891b2` cyan stroke)
      - Coastal inundation (`#7c3aed` purple fill/stroke)
    - Displays layer visibility pills, color legend, and council flood provenance/links right inside the map card.

### 2.3 Property Detail Page (`app/components/property-detail-page.tsx`)
- **Key Specs Strip**: Uses Lucide icons (`Bed`, `Bath`, `Car`, `Maximize2`, `LandPlot`, `Calendar`) next to each real stat; omits any missing/zero stat gracefully.
- **Description Section**: Renders `property.summary` paragraphs above the attributes grid, with a clean shadcn `Collapsible` "Read more / Show less" button when longer than ~280 characters.
- **Attributes Grid**: Displays only verified attributes (`Property Type`, `Title / Ownership`, `Council Capital Value (CV)`, `Land Value`, `Improvement Value`, `Estimated Weekly Rent`).
- **Neighbourhood Google Map Card**: Houses the unified 3-mode Google Map (Schools, Commute, Flood Assessment).
- **Market History & Valuations Section**: Non-collapsible section using shadcn `Badge`, `Table`, and cards to present:
  - Valuation summary cards (OneRoof Estimate + Low/High range, Council CV + Land/Improvement split, Last Sold price & date).
  - Monthly OneRoof AVM Estimate visual bar/sparkline trend when available.
  - Complete Property History timeline (Council RV reassessments, verified sales, listing & build events).
- **Mortgage Calculator Section**: Non-collapsible section at the bottom of the main column.

### 2.4 Non-Blocking Loading (`app/loading.tsx`, `app/properties/[id]/loading.tsx`, `lib/property-catalog.ts`)
- Avoid blocking page navigation with full-screen skeleton walls when bundled data is already available in memory; render property text/headers immediately and show localized `<Skeleton>` placeholders only inside the map canvas or async sub-panels while they initialize.

---

## 3. Error Handling & Testing Strategy
- **Google Maps Graceful Fallback**: If `googleMapsApiKey` is missing or the SDK is still initializing, render a clean `<Skeleton>` / informative card without crashing tests or SSR.
- **TDD & Vitest Suite**:
  - Unit tests for OneRoof RSC description & valuation history extraction.
  - Component tests for `PropertyDetailPage` (key spec icons, collapsible description, no fake sunlight/orientation, no comparable sales, unified map mode tabs for Schools / Commute / Flood assessment, non-collapsible Market History & Mortgage Calculator).
  - Component tests for `PropertyLocationMap` (mode switching, school selection/focusing, commute route calculation, flood GeoJSON overlay).
