# Haven AI Real Estate — Release Version

[![Release Branch](https://img.shields.io/badge/Branch-Release-success?logo=git)](https://github.com/Th3R1c0/2026_S2_-W204-_AI-Real-Estate/tree/Release)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.1-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?logo=postgresql)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F)](https://orm.drizzle.team/)
[![Vitest](https://img.shields.io/badge/Tests-231%20Passed-green?logo=vitest)](https://vitest.dev/)

Haven AI Real Estate is an intelligent property discovery and buyer intelligence platform engineered for the Auckland, New Zealand residential market. Developed for **COMP602 Software Development Practice (Team W204)**, this repository on the **`Release`** branch contains the complete, verified release version of our software, accompanied by full UML architectural artifacts, test-driven development (TDD) suites, and deployment guides.

---

## 1. Project Overview & Problem Statement

### The Problem
First-home buyers and property investors in New Zealand face a fragmented, stressful discovery process. Critical decision-making data is scattered across incompatible silos:
- Council GIS flood hazard layers and overland flow paths are isolated from listing websites.
- Ministry of Education enrolment zone catchments require manual school-by-school cross-referencing.
- Complex 50+ page Land Information Memorandum (LIM) PDFs hide critical drainage easements, unconsented building work, and site requisitions behind dense legal jargon.
- Keyword-based search engines fail to understand conversational buyer intent (e.g., *"3-bedroom sunny villa in Ponsonby under $1.5M with double garage"*).
- Financial feasibility tools on standard portals are disconnected from live listing prices and lack compound interest/deposit stress-testing.

### The Haven Solution
Haven unifies property discovery, geospatial hazard mapping, financial feasibility, and AI-assisted document intelligence into a single cohesive platform:
- **Conversational Natural Language Search**: Primary intent parsing via **TypeSafe AI (Jev System One)** with fallback to **Google Gemini 3.5 Flash-Lite**.
- **Interactive Geospatial Intelligence**: 3-mode Google Maps engine mapping Ministry of Education school zones, commute durations, and live Auckland Council flood overlays.
- **AI Helpdesk & LIM PDF Analysis**: Conversational assistant extracting key insights, easements, and consents from uploaded LIM reports with page-level citations.
- **TDD-Engineered Mortgage Calculator**: Real-time compound amortization calculator built with rigorous unit test coverage.
- **Buyer Workspace**: Persistent session-authenticated shortlists, inspection notes, and campaign criteria.

---

## 2. Completed Sprint 2 Features (With Developer & Tester Attributions)

In accordance with COMP602 Assessment 2 deliverables, all 22 features below are **Done**, verified via automated tests and peer code reviews:

| # | Feature / User Story | Developer (DEV) | Tester (TESTER) | Status & Verification |
|:---:|:---|:---|:---|:---|
| 1 | **Relational Database & Fallback** | Yasser | Rico | Done & Verified (PostgreSQL + PostGIS schema, Drizzle ORM, local JSON fallback) |
| 2 | **Account Sign-Up, Login & Logout** | Rico | Alister | Done & Verified (Session cookie auth, SHA-256 token hashing, password validation) |
| 3 | **Save Listings Shortlist** | Praneel | Lucas | Done & Verified (Multi-item shortlist, guest localStorage and account database sync) |
| 4 | **Property Inspection Notes** | Rico | Lucas | Done & Verified (Categorized notes: General, Offer, Inspection, Finance with full CRUD) |
| 5 | **Search Campaign Notes** | Rico | Lucas | Done & Verified (Workspace-level buyer search briefs and requirement management) |
| 6 | **Sales & Valuation History** | Praneel | Rico | Done & Verified (Capital value breakdowns, rating valuation splits, sales timeline) |
| 7 | **Listing Agent & Source Enquiry** | Lucas | Rico | Done & Verified (Agent cards, direct phone/email links, external source verification) |
| 8 | **Open Homes Schedules** | Rico | Alister | Done & Verified (Upcoming inspection calendar dates and filterable listing badges) |
| 9 | **AI Chatbot & Helpdesk** | Rico | Alister | Done & Verified (Domain knowledge base covering NZ property terms and procedures) |
| 10 | **Chatbot Context Awareness** | Rico | Yasser | Done & Verified (Injects active listing and compared properties into conversational prompt) |
| 11 | **LIM Report PDF Summaries** | Rico | Alister | Done & Verified (Upload PDFs up to 15MB, automated text extraction and risk analysis) |
| 12 | **Source Citations** | Alister | Rico | Done & Verified (Inline verifiable citation badges opening original source provenance modals) |
| 13 | **Interactive Mortgage Calculator** | Praneel | Lucas | Done & Verified (Built via TDD: monthly repayments, loan terms, deposit ratios) |
| 14 | **Natural-Language Search** | Rico | Alister | Done & Verified (TypeSafe Jev + Gemini dual NLP pipeline resolving criteria) |
| 15 | **Filter by Architectural Style** | Rico | Alister | Done & Verified (Character, Modernist, Contemporary, Craftsman, Mid-Century) |
| 16 | **Filter by Flood Hazard** | Yasser | Praneel | Done & Verified (Auckland Council Flood Plains, Flow Paths, Coastal Inundation) |
| 17 | **Filter by Year Built** | Rico | Lucas | Done & Verified (Construction era sliders from pre-1920 heritage to 2026 builds) |
| 18 | **Reset Filters** | Rico | Yasser | Done & Verified (One-click instant search and filter state reset to default) |
| 19 | **Flood Risk Map Overlays** | Yasser | Alister | Done & Verified (Auckland Council ArcGIS REST bounding-box GeoJSON vector layers) |
| 20 | **Custom Locations & Distance** | Alister | Rico | Done & Verified (Preserved buyer destinations, Haversine straight-line distance math) |
| 21 | **School Zones & Nearby Schools** | Yasser | Alister | Done & Verified (Ministry of Education school catchments, 2.5 km radius, in-zone badges) |
| 22 | **Mobile-Responsive Website** | Lucas | Rico | Done & Verified (Responsive CSS grid/flex breakpoints, mobile drawers, touch targets) |

---

## 3. Architecture & UML Class Diagrams

The architectural design reflects a clean, modular multi-tier architecture adhering to separation of concerns:

- **Presentation Tier**: Next.js 16 (App Router), React 19 Server & Client Components, Tailwind CSS, Radix UI.
- **Application & Domain Tier**: Domain services (`jev-search.ts`, `gemini-search.ts`, `property-engine.ts`, `mortgage-calculation.ts`, `chatbot-service.ts`).
- **Persistence Tier**: PostgreSQL with PostGIS extensions, Drizzle ORM schemas (`schema.ts`, `properties.ts`), and bundled offline JSON fixtures.
- **External API Gateways**: Auckland Council ArcGIS REST Services, TypeSafe AI Jev System One, Google Gemini 3.5, Google Maps JS SDK.

### Deliverables & Artifact Links:
- **Interactive UML Dashboard (Web)**: Accessible at [`/uml-diagram.html`](ai-real-estate/public/uml-diagram.html) in the running application (pan, zoom, fullscreen, SVG/PDF export).
- **Sprint 2 UML Class Diagram (PDF)**: Located at [`docs/Sprint 2 Class Diagram.pdf`](docs/Sprint%202%20Class%20Diagram.pdf) and [`ai-real-estate/public/Sprint 2 Class Diagram.pdf`](ai-real-estate/public/Sprint%202%20Class%20Diagram.pdf).
- **PlantUML Architecture Source**: [`docs/architecture-uml.puml`](docs/architecture-uml.puml).
- **Database Schema Class Diagram**: [`backend/schema-class-diagram.puml`](backend/schema-class-diagram.puml).

---

## 4. Technology Stack & Dependencies

| Layer | Technologies & Libraries |
|:---|:---|
| **Frontend Framework** | Next.js 16.3.1 (Turbopack / Webpack), React 19.0.0 |
| **Language & Tooling** | TypeScript 5.0+ (Strict Type Checking), ESLint |
| **Styling & Components** | Tailwind CSS 4, Radix UI Primitives, Lucide React Icons |
| **Database & ORM** | PostgreSQL 14+, PostGIS 3+, Drizzle ORM 0.40+ |
| **AI & NLP Services** | TypeSafe AI (Jev System One), Google Gemini 3.5 Flash-Lite |
| **Geospatial & Mapping** | `@vis.gl/react-google-maps`, Auckland Council ArcGIS REST APIs |
| **Document Processing** | `pdf-parse` (LIM Report PDF text extraction) |
| **Testing Framework** | Vitest 3.2.7, Testing Library React, `@testing-library/user-event`, jsdom |

---

## 5. Setup, Build & Run Instructions

### Prerequisites
- **Node.js**: v18.18+ or v20+
- **npm**: v9+ (or pnpm / yarn)
- **PostgreSQL**: v14+ with PostGIS extension (optional for local demo; app includes bundled offline fallbacks)

### 1. Installation
```bash
git checkout Release
cd ai-real-estate
npm install
```

### 2. Environment Configuration
Create a `.env.local` file inside the `ai-real-estate/` directory:
```env
# Database Connection (PostgreSQL + PostGIS)
DATABASE_URL="postgres://postgres:postgres@localhost:5432/real_estate"

# AI Services
TYPESAFE_API_KEY="your-typesafe-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```
*(Note: If API keys are omitted, the application operates in resilient demo mode with deterministic local fallbacks.)*

### 3. Database Migration & Seeding (Optional)
```bash
npm run db:push
npm run db:seed
```

### 4. Running the Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running the Automated Test Suite (TDD)
```bash
npm test
```
Executes all **231 Vitest unit and integration tests** across **36 test suites**.

### 6. Production Build & Start
```bash
npm run build
npm run start
```

---

## 6. Testing & Quality Assurance (TDD Evidence)

Quality was enforced throughout Sprint 2 using **Test-Driven Development (TDD)** and continuous regression testing:
- **Mortgage Calculator (`tests/mortgage-calculator.test.tsx`)**: Developed using strict Red-Green-Refactor cycles covering compound amortization, zero-interest bounds, 100% deposits, and boundary validation.
- **Natural Language Query Pipeline (`tests/jev-search.test.ts`, `tests/gemini-search.test.ts`)**: Evaluated against boundary queries, multi-criteria filtering, and fallback mechanisms.
- **Geospatial & Map Integration (`tests/property-location-map.test.tsx`)**: Verifies council flood hazard category rendering, school zone match evaluations, and distance calculations.
- **Auth & Session Security (`tests/account-auth.test.ts`)**: Validates SHA-256 session tokens, user registrations, and secure account deletion.
- **Suite Result**: **36 test suites passed, 231 tests passed, 0 failures**.

---

## 7. Authors & Team Members

Engineered and delivered for **COMP602 Software Development Practice** by **Team W204**:

- **Rico Saunders (Team Lead)** — Full-Stack Development, System Architecture, Natural-Language Search (Jev/Gemini), AI Chatbot & LIM PDF Extraction, Auth Engine, QA Testing.
- **Lucas McKinney** — Frontend UI Engineering, Listing Agent Enquiries, Mobile-Responsive Layouts, Map Scraper Integration, Scrum Master & Burn-Down Tracking.
- **Praneel Kumar** — Domain Services, Mortgage Calculator (TDD), Sales & Valuation History, Saved Listings Sync, API Engineering.
- **Yasser Saeed** — Database Architecture, PostgreSQL & PostGIS Integration, Auckland Council Flood Hazard Overlays, School Zones, Schema Migrations.
- **Alister Martin Repasa** — UI Components, Side-by-Side Comparison Matrix, Source Citations, Commute Pins, Quality Assurance & Test Verification.

---

## 8. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
