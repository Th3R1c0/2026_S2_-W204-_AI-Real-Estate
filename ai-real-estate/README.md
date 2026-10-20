# Haven — Real Estate Discovery & Buyer Intelligence Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.1-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?logo=postgresql)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F)](https://orm.drizzle.team/)
[![Vitest](https://img.shields.io/badge/Tests-231%20Passed-green?logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

Haven is an intelligent, high-performance real estate discovery web application tailored for the Auckland, New Zealand property market. Built from the ground up for **COMP602 Software Development Practice (Team W204)**, Haven empowers prospective homebuyers with conversational natural-language property search, live Auckland Council flood hazard overlays, Ministry of Education school zones, side-by-side comparison matrices, automated comparable sales valuations, interactive mortgage repayment modelling, and Land Information Memorandum (LIM) PDF report analysis.

---

## 📸 Application Screenshots

### 1. Natural-Language Property Discovery & Specialist Filtering
![Haven Property Discovery](../docs/assets/screenshot-home.png)
*Real-time debounced conversational search, specialist architectural filters (Character, Modernist, Contemporary), building age sliders, and verified property cards.*

---

### 2. Detailed Property Inspection, Unified 3-Mode Location Map & Mortgage Calculator
![Property Inspection & Location Map](../docs/assets/screenshot-property-details.png)
*Detailed property overview featuring Auckland Council flood hazard assessment, Ministry of Education school enrolment zones (2.5 km radius), commute directions, comparable sales, and live mortgage calculations.*

---

### 3. Side-by-Side Property Comparison Matrix
![Property Comparison Matrix](../docs/assets/screenshot-comparison.png)
*Side-by-side comparison of shortlisted properties with sticky attribute labels, difference highlighting, and tinted numeric maxima across pricing, floor area, land area, and build year.*

---

### 4. Buyer Workspace, Private Notes & Shortlist
![Buyer Workspace](../docs/assets/screenshot-workspace.png)
*Authenticated buyer dashboard featuring saved property shortlists, categorized private inspection notes (general, offer, inspection, finance), and commute destination presets.*

---

### 5. Interactive UML Architecture & System Class Diagram Dashboard
![UML Architecture Dashboard](../docs/assets/screenshot-uml.png)
*Interactive UML dashboard featuring System Architecture, Database Class Schema, and Sequence Flows with pan-zoom controls, SVG export, and one-click PDF generation.*

---

## 🗺️ UML Diagrams & Architecture Documentation

All architectural designs, database schemas, and sequence flows are documented and available in multiple formats:

- **Interactive UML Dashboard (HTML)**: [`../docs/uml-architecture.html`](../docs/uml-architecture.html) & [`public/uml-diagram.html`](public/uml-diagram.html)
  - Accessible directly in the web app at `/uml-diagram.html`.
  - Features interactive pan & zoom, theme toggling, fullscreen mode, SVG vector download, and one-click all-in-one PDF export.
- **Sprint 2 Complete Class Diagram & Architecture (PDF)**:
  - [`../docs/Sprint 2 Class Diagram.pdf`](../docs/Sprint%202%20Class%20Diagram.pdf)
  - [`../docs/presentation/Sprint 2 Class Diagram.pdf`](../docs/presentation/Sprint%202%20Class%20Diagram.pdf)
  - [`public/Sprint 2 Class Diagram.pdf`](public/Sprint%202%20Class%20Diagram.pdf)
- **PlantUML Architecture Source**: [`../docs/architecture-uml.puml`](../docs/architecture-uml.puml)
- **Database Schema Class Diagram**: [`../backend/schema-class-diagram.puml`](../backend/schema-class-diagram.puml)

---

## 🌟 Key Features Overview

### 1. Conversational Natural-Language Property Search
- **Natural Phrasing Interpretation**: Search for homes using everyday language (e.g., *"Modern 3-bedroom townhouse in Ponsonby under $1.2M with garage"* or *"Character villas near Grey Lynn School"*).
- **Dual Interpretation Pipeline**: Powered by **TypeSafe AI (Jev System One model)** as the primary intent classifier, resolving unstructured user queries into validated TypeScript filter criteria with automatic fallback to **Google Gemini 3.5 Flash-Lite**.
- **Transparency & Diagnostics**: Explains active search filters directly to the user in the UI, provides fallback clarity for boundary queries, and displays match tags.

### 2. Specialist Property & Environmental Filtering
- Search parameters beyond standard real estate portals:
  - **Architectural Style**: Character, Modernist, Contemporary, Craftsman, Mid-Century.
  - **Property Type**: Villa, Townhouse, Apartment, House, Lifestyle Block, Section.
  - **Building Era Slider**: Fine-grained construction age filtering (from pre-1920s heritage villas to 2020s contemporary developments).
  - **Bathroom & Parking Filtering**: Strict numeric bounds for bathrooms, off-street parking, and land size.

### 3. Unified 3-Mode Location Map (Google Maps SDK)
- Embedded interactive Google Map with three purpose-built modes:
  1. **Nearby Schools Mode**: Visualizes Auckland schools within a 2.5 km radius, displays school types (Primary, Intermediate, Secondary), and tests property location against Ministry of Education enrolment zone boundaries.
  2. **Commute Directions Mode**: Calculates driving and public transit routes and durations between the property and custom buyer destinations (e.g., Auckland CBD, workplaces).
  3. **Auckland Council Flood Hazard Mode**: Queries Auckland Council GIS REST endpoints (`/api/flood-zones`) for real-time bounding-box GeoJSON overlays representing Flood Plains, Flood Prone Areas, Overland Flow Paths, and 100-year Coastal Inundation.

### 4. Automated Comparable Sales (Comps)
- Located in the property details panel.
- Evaluates recent neighborhood property transactions matching property type, bedroom count, and floor area.
- Uses the **Haversine formula** to calculate physical distance.
- **Adjustable Scope**: Dynamic radius slider (1–10 km) and timeframe filter (3–12 months) with real-time recalculation of local market price-per-square-meter averages.

### 5. Side-by-Side Property Comparison Matrix
- Compare up to 4 shortlisted properties simultaneously in a dedicated comparison matrix.
- Evaluates pricing, bedrooms, bathrooms, land area, floor area, building age, architectural style, flood hazards, and sunlight exposure.
- Interactive controls: **Highlight Differences** toggle, tinted numeric maxima for instant scanning, and sticky column/row labels.

### 6. Haven Chatbot & LIM Report PDF Analysis
- Conversational real estate helpdesk drawer available across all pages.
- **Auckland Council LIM PDF Ingestion**: Upload Land Information Memorandum (LIM) reports (up to 15MB) via `/api/chatbot/upload-lim`.
- Uses `pdf-parse` for automated text extraction, injecting document context into the conversational RAG model.
- Answering buyer queries regarding drainage easements, unconsented works, resource consents, and rates with exact document page citations.

### 7. Buyer Workspace & Private Notes
- Secure user registration and session-based authentication with SHA-256 token hashing.
- **Saved Listings Shortlist**: Bookmark favorite properties to review later or monitor status updates.
- **Categorized Private Notes**: Save private notes for any property categorized into **General**, **Offer Strategy**, **Property Inspection**, or **Finance/Mortgage**.
- **Commute Presets**: Save daily destinations to easily check travel times on any property.

### 8. Interactive Mortgage Repayment Calculator
- Developed using **Test-Driven Development (TDD)** with complete Vitest unit test coverage.
- Real-time monthly repayment estimation using standard compound annuity amortization formulas.
- Adjustable sliders and numeric inputs for property purchase price, deposit percentage ($ and %), annual interest rate, and loan term (5–30 years).
- Built-in guard rails for zero-interest calculations, 100% deposit equity, and boundary validation.

### 9. Real Estate Agent Contact & Open Homes
- Direct agent contact cards with phone, email, and agency details.
- Upcoming open home inspection schedules with date, time range, and calendar integration.

---

## 🛠️ Technology Stack & Dependencies

| Category | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode) |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) spatial extensions, [Drizzle ORM](https://orm.drizzle.team/) |
| **AI & NLP Engines** | [TypeSafe AI](https://typesafe.ai/) (Jev System One), [Google Gemini 3.5 Flash-Lite](https://ai.google.dev/) |
| **Maps & Spatial** | [Google Maps JavaScript SDK](https://developers.google.com/maps), Auckland Council ArcGIS REST APIs |
| **Document Parsing** | [pdf-parse](https://www.npmjs.com/package/pdf-parse) for LIM PDF extraction |
| **Diagramming & Docs** | [Mermaid.js](https://mermaid.js.org/), [PlantUML](https://plantuml.com/), [jsPDF](https://github.com/parallax/jsPDF) |
| **Testing** | [Vitest 3](https://vitest.dev/), Testing Library React, jsdom |

---

## 🚀 Setup, Build & Run Instructions

### Prerequisites
- **Node.js**: v18.18+ or v20+ installed
- **npm**: v9+ (or `pnpm`)
- **PostgreSQL**: v14+ with the **PostGIS** extension installed

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in this directory (`ai-real-estate`):

```env
# PostgreSQL Database Connection String (with PostGIS enabled)
DATABASE_URL="postgres://postgres:postgres@localhost:5432/real_estate"

# Google Gemini API Key (for conversational chatbot & search fallback)
GEMINI_API_KEY="your-gemini-api-key"

# TypeSafe AI API Key (for primary Jev System One search engine)
TYPESAFE_API_KEY="your-typesafe-api-key"

# Google Maps JavaScript API Key (for 3-mode map rendering)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

> **Note on Fallbacks**: The application is built with resilient offline and keyword fallbacks. If API keys are not supplied, the platform falls back gracefully to local deterministic search parsing and demo mock data.

### 3. Database Setup & Seeding
Push the Drizzle ORM schema to your PostgreSQL database and populate the property catalog:

```bash
# Push database schema tables
npm run db:push

# Seed property listings, address data, open homes, and pricing
npm run db:seed

# Optional: Synchronize Auckland Council flood hazard geometries into PostGIS
npm run db:sync-flood-data
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 5. Run the Test Suite
```bash
npm test
```
All **231 tests** run via Vitest.

### 6. Production Build
```bash
npm run build
npm run start
```

---

## 👥 Authors & Team Members

This project was engineered and delivered for **COMP602 Software Development Practice** by **Team W204**:

- **Rico Saunders** — Full-Stack Development, System Architecture, Natural Language Search Pipeline & Database Engineering
- **Lucas McKinney** — Frontend UI Engineering, Scraper Ingestion, Map Mode Enhancements & Testing
- **Praneel Kumar** — Domain Logic, Mortgage Calculation Engine (TDD), Code Quality & API Implementation
- **Yasser Saeed** — Backend API Routes, Database Schema Migrations, Session Auth & Integration Testing
- **Alister Martin Repasa** — UI Components, Comparison Matrix, Mobile Responsiveness & Quality Assurance

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](../LICENSE) file for details.
