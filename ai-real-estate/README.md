# Haven — AI-Powered Real Estate Discovery

Haven is a modern, responsive property-discovery web application built with **Next.js 16**, **React 19**, **FastAPI**, and **MySQL 8**. It reads current listings and sale history from the SQL schema, with natural-language search and side-by-side property comparisons.

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
  - **Property Type**: Filters types present in the active listing data.
  - Specialist filters such as style, flood risk, build year, and aspect appear when these fields are populated by the database.

### 3. Automated Comparable Sales (Comps)
- Located within the property details drawer.
- Analyzes nearby transactions matching property type, bedroom counts, and floor area.
- Uses the **Haversine formula** to calculate physical distance.
- **Adjustable Controls**: Customise distance radius (1–10 km) and timeframe (3–12 months, default 6 months) with real-time recalculation of local market averages.

### 4. Side-by-Side Property Comparison
- Select two or more properties to inspect specs side-by-side in parallel columns.
- Compare price, bedrooms, bathrooms, land area, floor area, build year, architectural style, flood risk, and sunlight hours.
- Toggle to **Highlight Differences** across rows or remove individual properties from the comparison modal.

### 5. Listing Data
- Listing facts are sourced from the MySQL schema and missing fields are shown as unavailable rather than inferred.

### 6. Interactive Mortgage Repayment Calculator
- Embedded directly into every listing view.
- Real-time calculations with adjustable **deposit percentage/amount**, **interest rate**, and **loan term**.
- Instant principal-and-interest monthly repayment estimates based on standard amortization formulas.

---

## 🏗️ Application Architecture

```
ai-real-estate/
├── app/
│   ├── api/properties/route.ts  # Same-origin proxy to FastAPI
│   ├── api/sales/route.ts       # Same-origin proxy to sale history
│   ├── api/search/route.ts      # Server-only natural-language search
│   ├── components/
│   │   ├── backend-property-explorer.tsx # Loads the FastAPI property data
│   │   └── property-explorer.tsx # Interactive UI: filters, cards, comps, compare, modal
│   ├── globals.css              # Custom responsive design system (light/dark palette)
│   ├── layout.tsx               # Root application layout with Geist fonts
│   └── page.tsx                 # Server-rendered entry point with initial dataset
├── docs/
│   ├── sprintone.md             # Sprint One user stories, acceptance criteria, and INVEST scores
│   └── sprint-one-implementation-summary.md # Architectural summary, test coverage, and decisions
├── lib/
│   ├── backend-proxy.ts         # FastAPI proxy helper
│   ├── gemini-search.ts         # Gemini API client, response schema, console logging & fallback
│   ├── property-engine.ts       # Filtering, distance math (Haversine), and mortgage formulas
│   └── property-types.ts        # TypeScript domain models and interfaces
├── public/
│   └── properties/              # Local property imagery
└── tests/
    ├── gemini-search.test.ts    # AI integration, schema validation, and fallback tests
    ├── property-engine.test.ts  # Filtering logic, comp matching, and mortgage math tests
    ├── property-explorer.test.tsx # Component integration and user interaction tests
    └── search-route.test.ts     # API route status and security verification tests
backend/
├── database.SQL                 # MySQL 8 schema
├── main.py                      # FastAPI listing, detail, and sale endpoints
├── requirements.txt
└── tests/test_main.py           # Database-to-API mapping test
```

---

## 🔒 AI Security & Privacy

- **Server-Only API Key**: `GEMINI_API_KEY` is read strictly on the server from `.env.local` and transmitted via HTTP headers (`x-goog-api-key`). It is never bundled into client-side code or exposed in URLs.
- **Constrained Schema**: Gemini is invoked with `responseMimeType: "application/json"` and an explicit schema, preventing arbitrary prompt injections or unstructured text outputs.
- **Thinking Level**: Utilizes minimal thinking configuration (`MINIMAL`) for rapid latency and low token usage.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/)
- Python 3.10+
- MySQL 8+
- `npm` or `pnpm`

### Installation

1. Create the schema from the repository root:
   ```bash
   mysql -u root -p < backend/database.SQL
   ```

2. Configure and start the FastAPI service:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
   Set `DATABASE_URL` in `backend/.env` to your MySQL credentials, then run:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

3. Install and configure the Next.js app in a second terminal:
   ```bash
   cd ai-real-estate
   npm install
   ```
   Create `ai-real-estate/.env.local`:
   ```env
   BACKEND_API_URL=http://127.0.0.1:8000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   `GEMINI_API_KEY` is optional; search uses the local parser when it is unset.

4. Run the React application:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

The API is documented at [http://localhost:8000/docs](http://localhost:8000/docs), and its database health check is `/healthz`. The UI reads `/api/v1/properties` and `/api/v1/sales` through same-origin Next.js proxy routes. Records do not receive fabricated style, flood, aspect, or sunlight values.

---

## 🧪 Testing & Verification

```bash
# Run unit and integration tests
npm test

# Run code linter
npm run lint

# Run production build & typecheck
npm run build
```

Run backend mapping tests from the `backend/` directory after installing the development requirements:
```bash
pip install -r requirements-dev.txt
pytest
```

---

## 📚 Documentation Links

Detailed specifications and sprint reports are maintained in the [`docs/`](docs/) directory:
- [**Sprint One User Stories (`docs/sprintone.md`)**](docs/sprintone.md): Complete backlog, user stories, acceptance tests, story points, and INVEST criteria.
- [**Sprint One Implementation Summary (`docs/sprint-one-implementation-summary.md`)**](docs/sprint-one-implementation-summary.md): Comprehensive review of implemented features, test cases, technical decisions, and data provenance.

---

## 📊 Dataset & Asset Credits

- **Property Listings & Sales**: Read from the configured MySQL database using `backend/database.SQL`.
- **Imagery**: Listing image URLs are read from `property_images`; listings without an image use a neutral placeholder.
