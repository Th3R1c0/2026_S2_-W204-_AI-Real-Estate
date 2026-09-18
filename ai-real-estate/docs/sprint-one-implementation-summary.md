# Sprint One implementation summary

## Outcome

Sprint One is implemented as a responsive Next.js 16 property-discovery experience called **Haven**. The application deliberately implements the stories in `docs/sprintone.md` and no account, saved-listing, enquiry, map, or administration features outside that scope.

The result combines a natural-language property search, unusual specialist filters, recent comparable sales, side-by-side comparison, sunlight analysis, and a live mortgage calculator in one modular interface.

## Sprint requirement coverage

### Must-have stories

| Story / acceptance criteria | Implementation |
| --- | --- |
| AI search by architectural style | The search route translates natural-language style requests into `architecturalStyles` filters. Character, Modernist, Contemporary, Craftsman, and Mid-Century are supported. The results grid updates to show matching records only. |
| AI search by style and location | Gemini receives both filter categories in a constrained response schema. The deterministic fallback also recognises dataset locations and supported styles, so queries such as “character villas in Auckland” apply both criteria. |
| Automatic comparable sales | Every property detail drawer has a **Comparable sales** tab. It identifies nearby records with a matching property type and similar bedroom/floor-area characteristics, limited to the selected sale window. Distance is calculated with the Haversine formula. |
| Comps inside six months, with similar specifications and prices | The default comp window is six months and the list shows address, beds, floor area, distance, sale price, and sale month. An average price is shown above the list. |
| Adjustable comp radius and timeframe | Radius (1–10 km) and timeframe (3–12 months) sliders update the comp list and average immediately. The default is 2 km / 6 months. |
| Natural-language property type, location, and price | Gemini can return property types, location, minimum/maximum price, bedrooms, style, flood risk, build-year range, and north-facing status. The UI applies these as ordinary filters so they remain visible and editable. |
| Unclear search guidance | A request without recognised property intent returns a refinement message rather than silently showing an arbitrary subset. |
| No matching listings message | Empty search/filter results show an explicit “No homes match these filters” state with a clear-filter action. |
| Specialist filters | The filter rail supports architecture, property type, Low/Moderate/High demo flood band, north-facing status, and building-year range. Results update immediately. |
| AI property-type filtering | Villa, Townhouse, Apartment, House, Lifestyle block, and Section are recognised in the AI schema. Type and location can be combined in one request. |
| Modular responsive interface | The experience uses a collapsible filter rail, responsive property grid, comparison modal, and tabbed property detail drawer. Desktop and 390 px mobile layouts were visually verified. |

### Should-have stories

| Story / acceptance criteria | Implementation |
| --- | --- |
| Manual property-type filter | Type buttons can be combined, cleared, and are covered by UI tests. Selecting Section demonstrates the required no-match state for the current dataset. |
| Side-by-side comparison | Two or more homes can be selected from the cards. The comparison view aligns price, bedrooms, bathrooms, land area, build year, style, flood risk, and sunlight in columns. Users can highlight differing rows or remove a home. |
| North-facing and sunlight | The north-facing toggle updates results immediately. Each detail drawer has a **Sunlight** tab with estimated daily hours, aspect, a 0–100 exposure score, and an explanatory disclaimer. |
| Mortgage calculator | Every detail drawer includes deposit, interest-rate, and term controls. Defaults are 20% deposit, 6.49% interest, and 30 years. The principal-and-interest estimate, deposit amount, and loan amount update immediately. The formula is also tested directly with an $800,000 example. |

## Application structure

- `app/page.tsx` is the server-rendered entry point and supplies the demo listings and comparable sales.
- `app/components/property-explorer.tsx` contains the interactive search, filter, result, comparison, detail, sunlight, comp, and mortgage interface.
- `app/api/search/route.ts` is the server-only natural-language search boundary. It validates requests and keeps the API key out of the browser bundle.
- `lib/gemini-search.ts` performs structured Gemini interpretation and sanitises the result before it reaches the UI.
- `lib/property-engine.ts` contains deterministic filtering, local query parsing, comparable-sale selection, distance calculation, and mortgage maths.
- `lib/property-data.ts` contains the demo catalogue and provenance notes.
- `lib/property-types.ts` contains the shared domain types.
- `app/globals.css` contains the responsive design system and component styling.

## AI implementation

The application reads `GEMINI_API_KEY` only from `.env.local` in the server route. The key is sent to Google in the `x-goog-api-key` request header and is never returned to the client or written into a URL.

The selected model is `gemini-3.5-flash-lite`, Google’s stable, cost-efficient Gemini model for high-volume and simple data-processing work. Calls use JSON output, an explicit response schema, and the model’s minimal thinking level. The model is asked to extract only criteria that the buyer stated or clearly implied.

If the key is absent, Gemini is unavailable, or a request fails, a deterministic local parser handles the core sprint criteria instead of breaking search. The interface labels results as either **Gemini interpreted** or **Local search**, making that state visible during development.

## Demo data and images

The user requested realistic fake data sourced online rather than invented addresses. Address, bedroom, bathroom, land-area, valuation, and coordinate fields were selected from the public [Auckland Housing Market dataset](https://github.com/Sakyawira/auckland-house-prices). This creates a coherent Auckland-area demo catalogue from an external dataset.

Property type, architectural style, floor area, construction year, flood band, orientation, sunlight hours, and demonstration sale dates are product-demo enrichments needed to exercise the Sprint One features. They are not represented as council, hazard, valuation, or live-listing facts. The interface labels price, flood, sunlight, and comparable-sale information as indicative/demo data.

Property photography is sourced from [Unsplash](https://unsplash.com/) and stored locally in `public/properties` for stable rendering. The photos are illustrative and are not photographs of the named addresses; accessible alternative text describes each image.

## Test-driven development

The implementation followed red–green–refactor cycles. Tests were written first for each behaviour group, confirmed failing against minimal stubs, and then made green with the smallest production implementation.

The 19 automated tests cover:

- natural-language style, property type, location, price, and unclear-query parsing;
- specialist filtering and empty results;
- comparable-sale distance/time/spec matching and recalculated averages;
- mortgage calculations and parameter changes;
- Gemini structured requests, server-only key handling, sanitised responses, and graceful fallback;
- route validation and fallback behaviour;
- rendered filter clearing, AI results, empty states, comparison, property removal, comp controls, sunlight analysis, and live mortgage updates.

Test files are in `tests/` and use Vitest, Testing Library, jest-dom, and user-event.

## Verification completed

- `npm test` — 4 test files, 19 tests passed.
- `npm run lint` — passed with no ESLint errors or warnings.
- `npm run build` — production Next.js build passed, including TypeScript checking and static page generation. The script uses Next.js’s supported webpack build mode because the isolated development host blocks the process/port operation used by Turbopack’s CSS worker.
- Browser smoke test — desktop hero, filters, property cards, detail drawer, and a 390 × 844 responsive viewport were visually inspected.
- Gemini API smoke test — the configured key, `gemini-3.5-flash-lite` model, OpenAPI-compatible response schema, and minimal thinking configuration returned HTTP 200 with the expected structured style and maximum-price filters.
- Search UI smoke test — “Modernist under $1.2m” was labelled **Gemini interpreted**, applied both criteria, and returned the expected Karaka townhouse.

## Running the project

1. Install dependencies with `npm install`.
2. Put the API key in `.env.local` as `GEMINI_API_KEY=your_key_here`. The file is ignored by Git.
3. Start development with `npm run dev`.
4. Run the test suite with `npm test`.
5. Run linting with `npm run lint`.
6. Create a production build with `npm run build`, then run it with `npm start`.

## Product limitations

This is a Sprint One demonstration, not a live property, lending, sunlight, flood, or valuation service. Production use would require licensed live listing and sales feeds, authoritative council/hazard layers, geospatial shadow modelling, and lender-supplied rates. These integrations were intentionally excluded because they are outside `docs/sprintone.md`.
