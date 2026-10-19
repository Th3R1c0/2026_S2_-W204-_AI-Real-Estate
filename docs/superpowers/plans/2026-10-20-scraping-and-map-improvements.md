# Scraping and Map Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the OneRoof scraper & DB with real descriptions, property valuations/history, and verified public records (removing fake data and comparable sales), replace OpenStreetMap with a unified 3-mode Google Map (`@vis.gl/react-google-maps` for Schools, Commute, and Flood Assessment), modernize the Property Detail Page layout (spec icons, collapsible description, non-collapsible Market History & Mortgage Calculator), and eliminate full-page blocking skeletons.

**Architecture:** Extract OneRoof Next.js RSC stream data (`description`, `avm`, `publicRecords`, `overTime`, `histories`) into a pure parser module (`lib/oneroof-parser.ts`) used by the enrichment and dataset builder scripts, then persist to `reports/forsale-properties.json` and PostgreSQL (`properties.body`, `property_valuations`, `property_sales`). Build a unified Google Maps component using `@vis.gl/react-google-maps` (`internalUsageAttributionIds={['gmp_git_agentskills_v1']}`, `mapId="DEMO_MAP_ID"`) with mode tabs for Schools (`GraduationCap` markers + focusable list), Commute (Places lookup + `Route.computeRoutes` polyline & times), and Flood Assessment (Auckland Council ArcGIS GeoJSON polygon/polyline overlays).

**Tech Stack:** Next.js 16, React 19, TypeScript, `@vis.gl/react-google-maps`, Drizzle ORM / PostgreSQL, shadcn/ui, Lucide React, Vitest & React Testing Library.

## Global Constraints

- Must use `@vis.gl/react-google-maps` exclusively for React Google Maps integration.
- Must set `internalUsageAttributionIds={['gmp_git_agentskills_v1']}` on `<Map>` and supported GMP services.
- Must provide `mapId` (e.g., `"DEMO_MAP_ID"`) on `<Map>` for `<AdvancedMarker>`.
- Must read `GOOGLE_MAPS_API_KEY` (or `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) from `.env.local` and expose it to the client map component.
- Must delete Comparable Sales UI and remove synthetic/fake data (`sunlightHours`, `orientation`, fake `architecturalStyle`).

---

### Task 1: OneRoof RSC Parser & Real-Data Dataset + DB Ingestion

**Files:**
- Create: `ai-real-estate/lib/oneroof-parser.ts`
- Create: `ai-real-estate/tests/oneroof-parser.test.ts`
- Modify: `ai-real-estate/lib/property-types.ts`
- Modify: `ai-real-estate/scripts/enrich-flood-and-open-homes.mjs`
- Modify: `ai-real-estate/scripts/build-forsale-dataset.mjs`
- Modify: `ai-real-estate/scripts/seed.ts`
- Modify: `ai-real-estate/lib/db/properties.ts`
- Modify: `ai-real-estate/lib/property-catalog.ts`

- [ ] **Step 1: Write failing unit tests in `tests/oneroof-parser.test.ts`** testing extraction of multi-paragraph description, AVM estimate (`low`, `median`, `high`), public records (`landValue`, `improvementValue`, `capitalValue`, `legalDescription`, `unitaryPlanZone`, `contour`, `construction`, `titleNumber`, `decadeBuilt`), monthly AVM series (`overTime.avm`), RV reassessments (`histories` where `type === "cv"`), and past sales (`histories` where `type === "sale"`).
- [ ] **Step 2: Run `npm test tests/oneroof-parser.test.ts` to verify RED.**
- [ ] **Step 3: Implement `lib/oneroof-parser.ts` and update `lib/property-types.ts`**, then run the enrichment script to populate `reports/forsale-raw-harvest.json` and `reports/forsale-properties.json` (removing fake `sunlightHours`, `orientation`, and synthetic `architecturalStyle`).
- [ ] **Step 4: Update `scripts/seed.ts`, `lib/db/properties.ts`, and `lib/property-catalog.ts`** to persist and load `summary` (`properties.body`), `valuationHistory` (`property_valuations`), and `pastSales` (`property_sales`), and re-seed the database.
- [ ] **Step 5: Run `npm test tests/oneroof-parser.test.ts` to verify GREEN.**

### Task 2: Flood GeoJSON API Endpoint & Google Maps 3-Mode Component

**Files:**
- Create: `ai-real-estate/app/api/flood-zones/route.ts`
- Create: `ai-real-estate/tests/flood-zones-route.test.ts`
- Modify: `ai-real-estate/package.json` (install `@vis.gl/react-google-maps`)
- Modify: `ai-real-estate/next.config.ts` (expose `GOOGLE_MAPS_API_KEY` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- Modify: `ai-real-estate/app/components/property-location-map.tsx`
- Modify: `ai-real-estate/app/components/commute-planner.tsx`
- Create: `ai-real-estate/tests/property-location-map.test.tsx`

- [ ] **Step 1: Write failing tests in `tests/flood-zones-route.test.ts` and `tests/property-location-map.test.tsx`** for:
  - `/api/flood-zones` returning GeoJSON features per flood hazard layer (`flood_plains`, `flood_prone_areas`, `overland_flow_paths`, `coastal_inundation`).
  - `PropertyLocationMap` rendering the 3 mode tabs (`Schools`, `Commute`, `Flood assessment`) with icons, rendering school hat markers with school names underneath and focusing a school when selected from the list, calculating/displaying commute directions and mode toggles (`Driving`, `Public transport`, `Cycling`, `Walking`) with Google Maps lookup, and toggling flood assessment GeoJSON overlays and legend.
- [ ] **Step 2: Run `npm test tests/flood-zones-route.test.ts tests/property-location-map.test.tsx` to verify RED.**
- [ ] **Step 3: Install `@vis.gl/react-google-maps`, implement `/api/flood-zones/route.ts`, and build the 3-mode `PropertyLocationMap` and updated `CommutePlanner`.**
- [ ] **Step 4: Run `npm test tests/flood-zones-route.test.ts tests/property-location-map.test.tsx` to verify GREEN.**

### Task 3: Property Detail Page Redesign & Non-Blocking Loading

**Files:**
- Modify: `ai-real-estate/app/components/property-detail-page.tsx`
- Modify: `ai-real-estate/app/properties/[id]/page.tsx`
- Modify: `ai-real-estate/app/properties/[id]/loading.tsx`
- Modify: `ai-real-estate/app/page.tsx`
- Modify: `ai-real-estate/app/loading.tsx`
- Modify: `ai-real-estate/app/globals.css`
- Modify: `ai-real-estate/tests/ui-refresh.test.tsx`
- Modify: `ai-real-estate/tests/property-explorer.test.tsx`

- [ ] **Step 1: Write failing tests in `tests/ui-refresh.test.tsx`** verifying:
  - Key specs strip displays Lucide icons alongside Bedrooms, Bathrooms, Parking, Floor area, Land area, and Year built.
  - Scraped property description renders with a collapsible "Read more / Show less" toggle when long.
  - Fake data (`Orientation & Sunlight`, `hrs/day`) and `Comparable sales` are not rendered.
  - Schools, Commute, and Flood assessment are inside the Neighbourhood Map mode switcher instead of separate accordions.
  - Market history & price valuations and Mortgage calculator render directly as non-collapsible sections with rich valuation cards, AVM trend, RV reassessment history, and past sales.
  - Loading states render immediate page structure/text with targeted skeletons rather than blocking full-page skeletons.
- [ ] **Step 2: Run `npm test tests/ui-refresh.test.tsx` to verify RED.**
- [ ] **Step 3: Implement the updated `PropertyDetailPage`, non-blocking loading pages, and styles in `app/globals.css`.**
- [ ] **Step 4: Run the full test suite (`npm test`) and production build (`npm run build`) to verify everything passes cleanly.**
