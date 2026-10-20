# Haven AI Real Estate — Release Version

[![Release Branch](https://img.shields.io/badge/Branch-Release-success?logo=git)](https://github.com/Th3R1c0/2026_S2_-W204-_AI-Real-Estate/tree/Release)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.1-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?logo=postgresql)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F)](https://orm.drizzle.team/)
[![Vitest](https://img.shields.io/badge/Tests-231%20Passed-green?logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Haven AI Real Estate is an intelligent property discovery and buyer intelligence platform engineered for the Auckland, New Zealand residential market. Developed for **COMP602 Software Development Practice (Team W204)**, this repository on the **`Release`** branch contains the complete, verified release version of our software, accompanied by full UML architectural artifacts, test-driven development (TDD) suites, and local execution guides.

---

## Table of Contents
1. [Project Overview & Problem Statement](#1-project-overview--problem-statement)
2. [Key Features](#2-key-features)
3. [Architecture & UML Class Diagrams](#3-architecture--uml-class-diagrams)
4. [Technology Stack & Dependencies](#4-technology-stack--dependencies)
5. [How to Run Locally (Step-by-Step)](#5-how-to-run-locally-step-by-step)
6. [Available NPM Scripts](#6-available-npm-scripts)
7. [Repository Structure](#7-repository-structure)
8. [Application Routes & Walkthrough](#8-application-routes--walkthrough)
9. [Testing & Quality Assurance (TDD Evidence)](#9-testing--quality-assurance-tdd-evidence)
10. [Troubleshooting & FAQs](#10-troubleshooting--faqs)
11. [Authors & Team Members](#11-authors--team-members)
12. [License](#12-license)

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

## 2. Key Features

- **Natural-Language Conversational Search**: Search listings using natural everyday phrasing (e.g., *"3-bedroom townhouse near Grey Lynn under $1.2M"*). The query engine combines **TypeSafe AI (Jev System One)** with automated fallback to **Google Gemini 3.5 Flash-Lite** to extract typed search criteria.
- **Geospatial Location Maps (Google Maps SDK)**: Integrated interactive maps featuring Ministry of Education school zones (2.5 km radius with in-zone catchment detection) and Auckland Council flood hazard overlays (Flood Plains, Overland Flow Paths, Coastal Inundation).
- **Interactive Mortgage Repayment Calculator**: Developed using **Test-Driven Development (TDD)** with standard compound amortization formulas, real-time monthly repayment estimation, adjustable deposit ratios, and interest rate modeling.
- **AI Helpdesk & LIM PDF Analysis**: Conversational assistant capable of ingesting Auckland Council Land Information Memorandum (LIM) PDFs (up to 15MB) via `pdf-parse` to extract and cite key property findings, drainage easements, and unconsented works.
- **Side-by-Side Property Comparison Matrix**: Compare shortlisted properties simultaneously with sticky attribute labels, difference highlighting, and numeric maxima badges.
- **Buyer Workspace & Private Notes**: Secure user authentication with SHA-256 session tokens, saved listings shortlist, and categorized inspection notes (General, Offer, Inspection, Finance).
- **Sales & Valuation History**: Past sale records, valuation estimates, OneRoof estimate ranges, and Council capital value breakdowns.

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

## 5. How to Run Locally (Step-by-Step)

Follow these steps to run the application on your local machine.

### Prerequisites
Make sure you have the following installed:
- **Node.js**: v18.18+ or v20+ (Check with `node -v`)
- **npm**: v9+ (or `pnpm` / `yarn`)
- **Git** (Check with `git --version`)
- *(Optional)* **PostgreSQL**: v14+ with PostGIS extension (The application includes bundled offline property fixtures, so markers can run the app immediately with zero database setup).

---

### Step 1: Clone the Repository & Check Out `Release`
```bash
git clone https://github.com/Th3R1c0/2026_S2_-W204-_AI-Real-Estate.git
cd 2026_S2_-W204-_AI-Real-Estate
git checkout Release
```

---

### Step 2: Navigate to App Directory & Install Dependencies
```bash
cd ai-real-estate
npm install
```

---

### Step 3: Configure Environment Variables
Create a `.env.local` file inside the `ai-real-estate/` directory:

```bash
# In ai-real-estate/ directory
touch .env.local
```

Add the following keys to `.env.local`:
```env
# Database Connection (Optional for local review; bundled mock catalog is used if omitted)
DATABASE_URL="postgres://postgres:postgres@localhost:5432/real_estate"

# AI Natural-Language Search & Chatbot (Optional; local rule-based fallback used if omitted)
TYPESAFE_API_KEY="your-typesafe-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# Google Maps API Key (Optional; static coordinates & mock cards used if omitted)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

> **Note on Resilient Fallbacks for Markers**:  
> You do **not** need paid API keys or a running PostgreSQL server to evaluate this software. The system is engineered with automatic local fallbacks:
> - If `DATABASE_URL` is unset, properties load from verified bundled local fixtures.
> - If AI keys are unset, natural language search falls back to deterministic local parsing, and the chatbot uses its built-in knowledge base.
> - If Google Maps keys are unset, location modes display formatted school lists and council risk data.

---

### Step 4: Database Setup & Seeding (Optional)
If you wish to run against a live PostgreSQL + PostGIS database:
```bash
# Push database schema tables
npm run db:push

# Seed property listings, address data, open homes, and pricing
npm run db:seed

# Optional: Synchronize Auckland Council flood hazard geometries
npm run db:sync-flood-data
```

---

### Step 5: Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to:  
👉 **[http://localhost:3000](http://localhost:3000)**

---

### Step 6: Run in Production Mode (Optional)
To verify the optimized production build and SSR/SSG route generation:
```bash
# Build the application
npm run build

# Start the production server
npm start
```
Then visit **[http://localhost:3000](http://localhost:3000)**.

---

### Step 7: Run the Automated Test Suite (TDD)
To run all 231 unit, integration, and UI tests:
```bash
npm test
```
To run tests interactively in watch mode during development:
```bash
npm run test:watch
```

---

## 6. Available NPM Scripts

All commands should be executed from the `ai-real-estate/` directory:

| Command | Description |
|:---|:---|
| `npm run dev` | Starts the Next.js development server on port 3000. |
| `npm run build` | Compiles and builds the production application (`next build --webpack`). |
| `npm start` | Launches the compiled production server. |
| `npm test` | Runs the full Vitest automated test suite once (`vitest run`). |
| `npm run test:watch` | Starts Vitest in interactive file-watching mode. |
| `npm run lint` | Runs ESLint to check for code quality and standards. |
| `npm run db:seed` | Populates the database with Auckland property listings and pricing history. |
| `npm run db:push` | Synchronizes Drizzle schema migrations directly into PostgreSQL. |
| `npm run db:sync-flood-data` | Ingests Auckland Council GIS flood hazard geometries into PostGIS. |
| `npm run db:sync-school-data` | Synchronizes Ministry of Education school directory records and zone shapes. |

---

## 7. Repository Structure

```
2026_S2_-W204-_AI-Real-Estate/
├── ai-real-estate/                     # Main Next.js 16 / React 19 Application
│   ├── app/                            # App Router (Pages, Layouts, API Routes)
│   │   ├── api/                        # Serverless API Endpoints
│   │   │   ├── account/workspace/      # Buyer workspace sync (JSONB)
│   │   │   ├── auth/                   # Session auth & SHA-256 tokens
│   │   │   ├── chatbot/                # Conversational AI assistant
│   │   │   │   └── upload-lim/         # LIM PDF parsing endpoint
│   │   │   ├── comparable-sales/       # Haversine comp valuation API
│   │   │   ├── flood-zones/            # Council GIS GeoJSON API
│   │   │   └── search/                 # Natural language search endpoint
│   │   ├── components/                 # Reusable UI & Domain Components
│   │   │   ├── account-panel.tsx       # Auth modal (Sign in / Sign up)
│   │   │   ├── ai-chatbot.tsx          # Real estate assistant drawer
│   │   │   ├── comparison-matrix.tsx   # Side-by-side comparison modal
│   │   │   ├── mortgage-calculator.tsx # Compound amortization calculator (TDD)
│   │   │   ├── property-detail-page.tsx# Single property inspection view
│   │   │   ├── property-explorer.tsx   # Catalog & filter controller
│   │   │   ├── property-location-map.tsx# 3-mode Google Map (Schools/Commute/Flood)
│   │   │   └── site-header.tsx         # Navigation header & shortlist indicator
│   │   ├── profile/                    # Buyer workspace (/profile)
│   │   └── properties/[id]/            # Dynamic listing pages (/properties/:id)
│   ├── lib/                            # Core Services, Types & Utilities
│   │   ├── flood-hazards.ts            # Council flood layer definitions
│   │   ├── jev-search.ts               # TypeSafe Jev AI query parser
│   │   ├── gemini-search.ts            # Google Gemini query fallback
│   │   ├── mortgage-calculation.ts     # Amortization math engine
│   │   ├── property-data.ts            # Seed catalog fixtures & mock data
│   │   └── school-data.ts              # Ministry of Education zone lookups
│   ├── public/                         # Static Assets & Documentation Exports
│   │   ├── Sprint 2 Class Diagram.pdf  # Exported Sprint 2 UML Class Diagram
│   │   └── uml-diagram.html            # Interactive UML Architecture Dashboard
│   ├── tests/                          # 36 Vitest Unit & Integration Test Files
│   ├── package.json                    # Dependencies & npm scripts
│   └── tsconfig.json                   # Strict TypeScript configuration
├── docs/                               # Sprint 2 Deliverables & Scrum Artifacts
│   ├── Sprint 2 Class Diagram.pdf      # Complete UML Class Diagram
│   ├── uml-architecture.html           # Standalone UML Dashboard Source
│   ├── architecture-uml.puml           # PlantUML Architecture Diagram
│   └── superpowers/plans/              # Implementation & Engineering Plans
└── readme.md                           # This Release Documentation File
```

---

## 8. Application Routes & Walkthrough

| Route | View | Description |
|:---|:---|:---|
| **`/`** | **Discovery & Search** | Full catalog with conversational search, price sliders, building age ranges, and property cards. |
| **`/properties/[id]`** | **Property Inspection** | Comprehensive property detail view with photo gallery, valuation history, 3-mode map, and mortgage calculator. |
| **`/profile`** | **Buyer Workspace** | Personal dashboard showing saved homes, categorized inspection notes, and account settings. |
| **`/uml-diagram.html`**| **UML Dashboard** | Interactive architectural dashboard with System Architecture, Database Schema, and Sequence Flows. |
| **`/Sprint 2 Class Diagram.pdf`** | **Class Diagram PDF** | Official exported Sprint 2 UML Class Diagram ready for marker review. |

---

## 9. Testing & Quality Assurance (TDD Evidence)

Quality was enforced throughout Sprint 2 using **Test-Driven Development (TDD)** and continuous regression testing:
- **Mortgage Calculator (`tests/mortgage-calculator.test.tsx`)**: Developed using strict Red-Green-Refactor cycles covering compound amortization, zero-interest bounds, 100% deposits, and boundary validation.
- **Natural Language Query Pipeline (`tests/jev-search.test.ts`, `tests/gemini-search.test.ts`)**: Evaluated against boundary queries, multi-criteria filtering, and fallback mechanisms.
- **Geospatial & Map Integration (`tests/property-location-map.test.tsx`)**: Verifies council flood hazard category rendering, school zone match evaluations, and distance calculations.
- **Auth & Session Security (`tests/account-auth.test.ts`)**: Validates SHA-256 session tokens, user registrations, and secure account deletion.
- **Suite Result**: **36 test suites passed, 231 tests passed, 0 failures**.

---

## 10. Troubleshooting & FAQs

#### Q: Port 3000 is already in use.
**A**: Stop any existing processes using port 3000, or run:
```bash
npm run dev -- -p 3001
```

#### Q: Do I need a PostgreSQL database to run the app?
**A**: No. The app automatically detects if `DATABASE_URL` is missing or unreachable and seamlessly switches to the bundled property catalog.

#### Q: How do I test the LIM report analysis?
**A**: Open the Haven Chatbot in the bottom-right corner, click the attach button, and upload any PDF file (under 15 MB). The system will extract the text and answer questions citing specific pages.

---

## 11. Authors & Team Members

Engineered and delivered for **COMP602 Software Development Practice** by **Team W204**:

- **Rico Saunders (Team Lead)** — Full-Stack Development, System Architecture, Natural-Language Search (Jev/Gemini), AI Chatbot & LIM PDF Extraction, Auth Engine, QA Testing.
- **Lucas McKinney** — Frontend UI Engineering, Listing Agent Enquiries, Mobile-Responsive Layouts, Map Scraper Integration, Scrum Master & Burn-Down Tracking.
- **Praneel Kumar** — Domain Services, Mortgage Calculator (TDD), Sales & Valuation History, Saved Listings Sync, API Engineering.
- **Yasser Saeed** — Database Architecture, PostgreSQL & PostGIS Integration, Auckland Council Flood Hazard Overlays, School Zones, Schema Migrations.
- **Alister Martin Repasa** — UI Components, Side-by-Side Comparison Matrix, Source Citations, Commute Pins, Quality Assurance & Test Verification.

---

## 12. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
