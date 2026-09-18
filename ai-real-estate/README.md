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
  - **Flood Risk Bands**: Low, Moderate, High demo hazard bands.
  - **Building Age**: Interactive slider filtering by construction era (e.g., pre-1920s villas to 2020s modern builds).
  - **North-Facing Orientation**: Instant toggle for homes oriented to the northern sun.

### 3. Automated Comparable Sales (Comps)
- Located within the property details drawer.
- Analyzes nearby transactions matching property type, bedroom counts, and floor area.
- Uses the **Haversine formula** to calculate physical distance.
- **Adjustable Controls**: Customise distance radius (1–10 km) and timeframe (3–12 months, default 6 months) with real-time recalculation of local market averages.

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
│   ├── gemini-search.ts         # Gemini API client, response schema, console logging & fallback
│   ├── property-data.ts         # Auckland Housing Market dataset listings & comps
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

3. Configure environment variables:
   Create a `.env.local` file in the `ai-real-estate/` directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Note: If no key is set, the application automatically falls back to its deterministic local natural-language parser).*

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

The project is built following Test-Driven Development (TDD) principles. 19 unit and integration tests verify all requirements:

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
