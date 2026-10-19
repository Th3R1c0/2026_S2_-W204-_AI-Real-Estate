# Haven — AI-Powered Real Estate Discovery

Haven is a modern, responsive property-discovery web application built with **Next.js 16**, **React 19**, and **Google Gemini 3.5 Flash-Lite**. It combines natural-language conversational property search with specialist search criteria, automated comparable sales, side-by-side home comparisons, sunlight analysis, and an interactive mortgage calculator.

All features and acceptance criteria are aligned with the Sprint One user stories documented in [`docs/sprintone.md`](docs/sprintone.md) and summarized in [`docs/sprint-one-implementation-summary.md`](docs/sprint-one-implementation-summary.md).

---

## 🌟 Key Features

### 1. Natural-Language AI Search
- **Conversational Queries**: Search for properties using natural phrasing (e.g. *"Modern three-bedroom townhouse in Auckland under $900k"* or *"Character villas in Auckland"*).
- **Gemini 3.5 Flash-Lite Integration**: Translates unstructured search requests into precise, structured search filters via a strict OpenAPI-compatible response schema.
- **Console Transparency & Logging**: Automatically logs all outgoing payloads sent to Gemini and raw responses received back in both server and browser consoles.
- **Deterministic Offline Fallback**: If `GEMINI_API_KEY` is not provided or the Gemini API is unreachable, an intelligent local parser handles the query seamlessly, labeling results as **Local search** vs **Gemini interpreted**.

### 2. Specialist Property Filtering
- Search criteria not typically accessible on mainstream property platforms:
  - **Architectural Style**: Character, Modernist, Contemporary, Craftsman, Mid-Century.
  - **Property Type**: Villa, Townhouse, Apartment, House, Lifestyle block, Section.
  - **Mapped Flood Hazards**: Filter by Auckland Council flood plains, flood-prone areas, overland flow paths, coastal inundation, or properties with no mapped intersection.
  - **Schools**: Browse nearby Auckland schools by source school type, search properties within 2.5 km of a selected school, or search homes inside that school's mapped enrolment zone.
  - **Building Age**: Interactive slider filtering by construction era (e.g., pre-1920s villas to 2020s modern builds).
  - **North-Facing Orientation**: Instant toggle for homes oriented to the northern sun.

### 3. Automated Comparable Sales (Comps)
- Located within the property details drawer.
- Analyzes nearby transactions matching property type, bedroom counts, and floor area.
- Uses the **Haversine formula** to calculate physical distance.
- **Adjustable Controls**: Customise distance radius (1–10 km) and timeframe (3–12 months, default 6 months) with real-time recalculation of local market averages.

### Auckland Council Flood Hazard Data
- A developer-run importer stores only Council flood features intersecting the current property-coordinate extent (buffered by 1 km) in PostGIS. It imports Flood Plains, Flood Prone Areas, Overland Flow Paths, and Coastal Inundation (100-year return); source attributes and geometries are retained.
- PostGIS computes point/geometry intersections and records each matching property/hazard feature in `property_flood_hazards`. Hazard extents are not converted into a single risk rating.
- The property details panel includes a Flood risk tab with mapped hazard types, a brief explanation, and a research-use disclaimer. Flood filters use those imported hazard types rather than the legacy demo risk bands.
- The source Overland Flow Paths service contains over a million features, so the importer queries the Council services by the current property extent rather than downloading the entire regional service.
- There is no active automatic schedule. Run the import manually after applying migrations and seeding properties:
  ```bash
  npm run db:sync-flood-data
  ```
- To opt into a yearly run later, uncomment and adapt a local crontab entry:
  ```cron
  # 0 3 1 1 * cd /path/to/ai-real-estate && npm run db:sync-flood-data >> /path/to/flood-sync.log 2>&1
  ```
- Council sources: [Flood Plains](https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Plains/FeatureServer/0), [Flood Prone Areas](https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Prone_Areas/FeatureServer/0), [Overland Flow Paths](https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Overland_Flow_Paths/FeatureServer/0), and [Coastal Inundation](https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Coastal_Inundation_100_yr_return/FeatureServer/0).

### Education Counts School Data
- The developer-run importer reads the Ministry of Education Schools Directory API, retaining Auckland Region schools and only `School_Id`, `Org_Name`, `Org_Type`, `Latitude`, `Longitude`, and `Enrolment_Scheme`. Only school identity, `PolyName`, `INSTTYPE`, and geometry are stored for zones.
- PostGIS calculates nearby schools within 2.5 km and tests property points against enrolment-zone polygons. The interface lists school details and mapped zone membership; no school or flood maps are rendered.
- After applying migrations and seeding the application database, zone polygons are loaded from the Ministry's [Enrolment Scheme Master MapInfo download](https://www.educationcounts.govt.nz/__data/assets/file/0003/108606/Enrolmentschememaster.zip). Install GDAL (`ogr2ogr`), extract the ZIP, then preview the import with the extracted folder or `.TAB` file:
  ```bash
  npm run db:sync-school-data-file -- "/path/to/Enrolmentschememaster" --dry-run
  ```
  - To hand the school dataset to someone who will create the application database later, export a portable SQL file without connecting to PostgreSQL:
  ```bash
    npm run db:export-school-data-sql -- "/path/to/Enrolmentschememaster" --export-sql "/path/to/auckland-school-data.sql"
  ```
  - The SQL file inserts the current Auckland directory school rows, replaces `schools` and `school_zones` in one transaction, and updates `school_data_sync`. Your colleague can apply it after creating the database, installing PostGIS, and running the application migrations, for example with `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f auckland-school-data.sql`. It contains only Auckland schools and matched zone polygons, not the original nationwide MapInfo dataset.
  - Alternatively, to import directly into a prepared database, the file importer fetches current Auckland school IDs, selects matching schools with an enrolment scheme, reprojects the selected features from EPSG:2193 to EPSG:4326, then transactionally replaces the imported school data. It deliberately ignores `EffectiveDate` and does not trust the file's `Office` field to determine Auckland membership:
    ```bash
    npm run db:sync-school-data-file -- "/path/to/Enrolmentschememaster"
    ```
- The per-school API importer (`npm run db:sync-school-data`) remains available, but its zone requests were blocked by a Cloudflare challenge (HTTP 403) in the development environment. The local bulk file path avoids those zone downloads.
- The Ministry warns that the bulk polygons have limited spatial resolution and alignment integrity, and should not be used for spatial queries against other datasets. This application accepts that limitation: mapped membership is approximate and may be inaccurate. Confirm current enrolment eligibility directly with the school or Ministry of Education.
- The dry run reports scheme schools with no matching polygon; in the downloaded 2 October 2026 file, 6 of 393 Auckland schools marked with an enrolment scheme had no polygon. Such schools remain listed, but the interface reports their zone geometry as unavailable.
- These commands are manually run, not invoked on application startup, and have no automatic schedule. They download and validate source records before transactionally replacing imported data; failed imports leave existing data intact.
- Sources: [Schools Directory API](https://www.educationcounts.govt.nz/directories/school-directory-api) and [Enrolment Scheme Master MapInfo dataset](https://catalogue.data.govt.nz/dataset/school-enrolment-zones).

### 4. Side-by-Side Property Comparison
- Select two or more properties to inspect specs side-by-side in parallel columns.
- Compare price, bedrooms, bathrooms, land area, floor area, build year, architectural style, flood risk, and sunlight hours.
- Toggle to **Highlight Differences** across rows or remove individual properties from the comparison modal.

### 5. Sunlight & Aspect Analysis
- Each listing features an environmental sunlight assessment.
- Visualizes orientation (e.g. North-facing, East-facing), daily estimated sunlight hours, and a calculated 0–100 sunlight score.

### 6. Interactive Mortgage Repayment Calculator
- Embedded directly into every listing view.
- Real-time calculations with adjustable **deposit percentage/amount**, **interest rate**, and **loan term**.
- Instant principal-and-interest monthly repayment estimates based on standard amortization formulas.

---

## 🏗️ Application Architecture

```
ai-real-estate/
├── app/
│   ├── api/search/route.ts      # Server-only API endpoint for natural-language search
│   ├── components/
│   │   └── property-explorer.tsx # Interactive UI: filters, cards, comps, compare, modal
│   ├── globals.css              # Custom responsive design system (light/dark palette)
│   ├── layout.tsx               # Root application layout with Geist fonts
│   └── page.tsx                 # Server-rendered entry point with initial dataset
├── docs/
│   ├── sprintone.md             # Sprint One user stories, acceptance criteria, and INVEST scores
│   └── sprint-one-implementation-summary.md # Architectural summary, test coverage, and decisions
├── lib/
│   ├── db/
│   │   ├── index.ts            # PostgreSQL connection pool and Drizzle client
│   │   ├── properties.ts       # Server-side property and comparable-sale queries
│   │   └── schema.ts           # Drizzle schema for backend/schema.SQL
│   ├── gemini-search.ts         # Gemini API client, response schema, console logging & fallback
│   ├── property-data.ts         # Source records used to seed the database and tests
│   ├── property-engine.ts       # Filtering, distance math (Haversine), and mortgage formulas
│   └── property-types.ts        # TypeScript domain models and interfaces
├── public/
│   └── properties/              # Local property imagery
└── tests/
    ├── gemini-search.test.ts    # AI integration, schema validation, and fallback tests
    ├── property-engine.test.ts  # Filtering logic, comp matching, and mortgage math tests
    ├── property-explorer.test.tsx # Component integration and user interaction tests
    └── search-route.test.ts     # API route status and security verification tests
```

---

## 🔒 AI Security & Privacy

- **Server-Only API Key**: `GEMINI_API_KEY` is read strictly on the server from `.env.local` and transmitted via HTTP headers (`x-goog-api-key`). It is never bundled into client-side code or exposed in URLs.
- `DATABASE_URL` is used only by the server-side Drizzle client. Do not expose it through a `NEXT_PUBLIC_` variable.
- **Constrained Schema**: Gemini is invoked with `responseMimeType: "application/json"` and an explicit schema, preventing arbitrary prompt injections or unstructured text outputs.
- **Thinking Level**: Utilizes minimal thinking configuration (`MINIMAL`) for rapid latency and low token usage.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` or `pnpm`

### Installation

1. Clone the repository and navigate to the app directory:
   ```bash
   cd ai-real-estate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start PostgreSQL and create a local database, for example with `createdb real_estate`.
   Install PostGIS for the PostgreSQL server used by this database.

4. Set `DATABASE_URL` in `.env.local` to your PostgreSQL connection string, for example:
   ```dotenv
   DATABASE_URL=postgresql://your-postgres-user@localhost:5432/real_estate
   ```

   For a Vercel deployment without a connected database, leave `DATABASE_URL` unset. The app and search use the bundled listing snapshot. If the database is unreachable or has no active listings, they also fall back to that snapshot. Council flood hazard data requires a migrated and synced PostgreSQL database.

5. Apply migrations and seed the demo records:
   ```bash
   npm run db:setup-local
   ```
   This runs the PostgreSQL migrations, then imports demo records. The seed command refuses to run if the `properties` table already contains records. Existing MySQL data is not migrated automatically.

6. Optionally add `GEMINI_API_KEY=your_gemini_api_key_here` to `.env.local`. If no key is set, AI search uses the local parser.

7. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

After changing `lib/db/schema.ts`, generate a migration with:
```bash
npm run db:generate
```

The PostgreSQL SQL reference is maintained in [`../backend/schema.SQL`](../backend/schema.SQL). `lib/db/schema.ts` is its Drizzle representation, including PostGIS-backed school and flood geometries. Drizzle's PostgreSQL migrations are stored in `drizzle/postgres`; the original MySQL migration history in `drizzle/` is not applied.

---

## 🧪 Testing & Verification

The project is built following Test-Driven Development (TDD) principles. Unit and integration tests cover the application, including school-source import validation and school spatial filters:

```bash
# Run unit and integration tests
npm test

# Run code linter
npm run lint

# Run production build & typecheck
npm run build
```

---

## 📚 Documentation Links

Detailed specifications and sprint reports are maintained in the [`docs/`](docs/) directory:
- [**Sprint One User Stories (`docs/sprintone.md`)**](docs/sprintone.md): Complete backlog, user stories, acceptance tests, story points, and INVEST criteria.
- [**Sprint One Implementation Summary (`docs/sprint-one-implementation-summary.md`)**](docs/sprint-one-implementation-summary.md): Comprehensive review of implemented features, test cases, technical decisions, and data provenance.

---

## 📊 Dataset & Asset Credits

- **Property Listings & Comps**: Derived from public Auckland residential property records ([Auckland Housing Market dataset](https://github.com/Sakyawira/auckland-house-prices)) with demo enrichments for architectural styles, flood hazard bands, and orientation.
- **Imagery**: Curated illustrative photography from [Unsplash](https://unsplash.com/) stored locally in `public/properties/`.
