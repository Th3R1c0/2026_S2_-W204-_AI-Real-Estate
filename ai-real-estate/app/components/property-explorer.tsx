"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

import {
  calculateMonthlyMortgage,
  filterProperties,
  findComparableSales,
} from "../../lib/property-engine";
import type {
  ArchitecturalStyle,
  FloodRisk,
  Property,
  PropertyFilters,
  PropertyType,
} from "../../lib/property-types";

type AiSearchResult = {
  status: "ready" | "needs-clarification";
  filters: PropertyFilters;
  message: string;
  source: "gemini" | "local";
};

type PropertyExplorerProps = {
  properties: Property[];
  comparableSales: Property[];
  aiSearch?: (query: string) => Promise<AiSearchResult>;
};

type DetailTab = "overview" | "comps" | "sunlight" | "mortgage";

const propertyTypes: PropertyType[] = [
  "Villa",
  "Townhouse",
  "Apartment",
  "House",
  "Lifestyle block",
  "Section",
];

const architecturalStyles: ArchitecturalStyle[] = [
  "Character",
  "Modernist",
  "Contemporary",
  "Craftsman",
  "Mid-Century",
];

const floodRisks: FloodRisk[] = ["Low", "Moderate", "High"];

const numberFormatter = new Intl.NumberFormat("en-NZ");
const moneyFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value).replace("NZ", "");
}

async function searchWithApi(query: string): Promise<AiSearchResult> {
  console.log("[AI Search] Sending query to /api/search:", query);
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AI Search] API error status: ${response.status}`);
    throw new Error("Search is temporarily unavailable.");
  }
  const result = (await response.json()) as AiSearchResult;
  console.log("[AI Search] Response received from /api/search:", result);
  return result;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sparkle: <><path d="m12 3 1.25 3.75L17 8l-3.75 1.25L12 13l-1.25-3.75L7 8l3.75-1.25L12 3Z" /><path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z" /></>,
    sliders: <><path d="M4 6h7M15 6h5M4 12h2M10 12h10M4 18h9M17 18h3" /><circle cx="13" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="15" cy="18" r="2" /></>,
    bed: <><path d="M4 12V7M4 10h16a2 2 0 0 1 2 2v5H2v-3a2 2 0 0 1 2-2Z" /><path d="M7 10V7h5a2 2 0 0 1 2 2v1M2 20v-3M22 20v-3" /></>,
    bath: <><path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2ZM7 12V5a2 2 0 0 1 4 0" /><path d="M7 19v2M17 19v2" /></>,
    ruler: <><path d="m4 17 13-13 3 3L7 20l-3-3Z" /><path d="m14 7 3 3M11 10l2 2M8 13l3 3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
    compare: <><path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    house: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      {paths[name]}
    </svg>
  );
}

function PropertyCard({ property, selected, onCompare, onOpen }: { property: Property; selected: boolean; onCompare: () => void; onOpen: () => void }) {
  return (
    <article className="property-card">
      <div className="property-media">
        <Image alt={property.imageAlt} className="property-image" fill sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 380px" src={property.image} />
        <span className="style-badge">{property.architecturalStyle}</span>
        <label className={`compare-check ${selected ? "is-selected" : ""}`}>
          <input aria-label={`Compare ${property.address}`} checked={selected} onChange={onCompare} type="checkbox" />
          <Icon name="compare" size={15} />Compare
        </label>
      </div>
      <div className="property-body">
        <div className="property-heading">
          <div><p className="property-price">{formatMoney(property.price)}</p><h3>{property.address}</h3><p className="property-location">{property.suburb}, {property.city}</p></div>
          <span className={`risk-dot risk-${property.floodRisk.toLowerCase()}`} title={`${property.floodRisk} flood risk`} />
        </div>
        <div className="property-specs" aria-label="Property features">
          <span><Icon name="bed" size={17} />{property.bedrooms} beds</span>
          <span><Icon name="bath" size={17} />{property.bathrooms} baths</span>
          <span><Icon name="ruler" size={17} />{numberFormatter.format(property.landArea)} m²</span>
        </div>
        <div className="card-footer">
          <div className="sun-chip"><Icon name="sun" size={15} />{property.sunlightHours} hrs sunlight</div>
          <button aria-label={`View details for ${property.address}`} className="icon-button" onClick={onOpen} type="button"><Icon name="arrow" /></button>
        </div>
      </div>
    </article>
  );
}

function ComparisonDialog({ properties, onClose, onRemove }: { properties: Property[]; onClose: () => void; onRemove: (id: string) => void }) {
  const [highlight, setHighlight] = useState(false);
  const values = {
    Price: properties.map(({ price }) => formatMoney(price)),
    Bedrooms: properties.map(({ bedrooms }) => String(bedrooms)),
    Bathrooms: properties.map(({ bathrooms }) => String(bathrooms)),
    "Land area": properties.map(({ landArea }) => `${numberFormatter.format(landArea)} m²`),
    "Built in": properties.map(({ yearBuilt }) => String(yearBuilt)),
    Style: properties.map(({ architecturalStyle }) => architecturalStyle),
    "Flood risk": properties.map(({ floodRisk }) => floodRisk),
    Sunlight: properties.map(({ sunlightHours }) => `${sunlightHours} hrs/day`),
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label="Property comparison" aria-modal="true" className="modal comparison-modal" role="dialog">
        <div className="modal-header"><div><p className="eyebrow">Side-by-side view</p><h2>Compare your shortlist</h2></div><button aria-label="Close comparison" className="icon-button" onClick={onClose} type="button"><Icon name="close" /></button></div>
        <div className="comparison-toolbar"><p>{properties.length} homes selected</p><label className="switch-label"><input checked={highlight} onChange={(event) => setHighlight(event.target.checked)} type="checkbox" />Highlight differences</label></div>
        <div className="comparison-scroll">
          <div className="comparison-grid" style={{ gridTemplateColumns: `150px repeat(${properties.length}, minmax(190px, 1fr))` }}>
            <div />
            {properties.map((property) => (
              <div className="compare-property-head" key={property.id}>
                <button aria-label={`Remove ${property.address}`} className="remove-button" onClick={() => onRemove(property.id)} type="button"><Icon name="close" size={14} /></button>
                <div className="compare-thumb"><Image alt={property.imageAlt} fill sizes="200px" src={property.image} /></div>
                <strong>{property.address}</strong><span>{property.suburb}</span>
              </div>
            ))}
            {Object.entries(values).flatMap(([label, row]) => {
              const different = new Set(row).size > 1;
              return [
                <div className="compare-label" key={`${label}-label`}>{label}</div>,
                ...row.map((value, index) => <div className={highlight && different ? "compare-value is-different" : "compare-value"} key={`${label}-${properties[index]?.id}`}>{value}</div>),
              ];
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailDialog({ property, comparableSales, onClose }: { property: Property; comparableSales: Property[]; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [radius, setRadius] = useState(2);
  const [months, setMonths] = useState(6);
  const [deposit, setDeposit] = useState(20);
  const [rate, setRate] = useState(6.49);
  const [term, setTerm] = useState(30);
  const compResult = useMemo(() => findComparableSales(property, comparableSales, { radiusKm: radius, months, asOf: new Date("2026-09-18T00:00:00Z") }), [property, comparableSales, radius, months]);
  const monthlyPayment = calculateMonthlyMortgage(property.price, deposit, rate, term);
  const sunlightScore = Math.min(100, Math.round((property.sunlightHours / 9) * 100));
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "comps", label: "Comparable sales" },
    { id: "sunlight", label: "Sunlight" },
    { id: "mortgage", label: "Mortgage" },
  ];

  return (
    <div className="modal-backdrop detail-backdrop" role="presentation">
      <section aria-label="Property details" aria-modal="true" className="modal detail-modal" role="dialog">
        <div className="detail-hero">
          <Image alt={property.imageAlt} fill priority sizes="(max-width: 800px) 100vw, 720px" src={property.image} />
          <button aria-label="Close property details" className="icon-button modal-close" onClick={onClose} type="button"><Icon name="close" /></button>
          <div className="detail-hero-copy"><span>{property.propertyType} · {property.architecturalStyle}</span><h2>{property.address}</h2><p>{property.suburb}, {property.city}</p></div>
        </div>
        <nav aria-label="Property detail sections" className="detail-tabs">
          {tabs.map(({ id, label }) => <button className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}
        </nav>
        <div className="detail-content">
          {tab === "overview" && (
            <div className="overview-panel">
              <div className="overview-price"><p>Indicative price</p><strong>{formatMoney(property.price)}</strong><span>Demo valuation, not a live listing</span></div>
              <div className="stat-grid">
                <div><Icon name="bed" /><strong>{property.bedrooms}</strong><span>Bedrooms</span></div><div><Icon name="bath" /><strong>{property.bathrooms}</strong><span>Bathrooms</span></div><div><Icon name="ruler" /><strong>{property.floorArea} m²</strong><span>Floor area</span></div><div><Icon name="house" /><strong>{property.yearBuilt}</strong><span>Year built</span></div>
              </div>
              <div className="insight-note"><Icon name="sparkle" /><div><strong>Why it stands out</strong><p>{property.architecturalStyle} design, {property.floodRisk.toLowerCase()} demo flood band and {property.sunlightHours} estimated sunlight hours.</p></div></div>
            </div>
          )}

          {tab === "comps" && (
            <div className="tool-panel">
              <div className="tool-heading"><div><p className="eyebrow">Recent market evidence</p><h3>Nearby comparable sales</h3></div><div className="average-pill">{compResult.averagePrice ? `${formatMoney(compResult.averagePrice)} average` : "No average"}</div></div>
              <div className="range-grid">
                <label>Search radius <strong>{radius} km</strong><input aria-label="Search radius" max="10" min="1" onChange={(event) => setRadius(Number(event.target.value))} type="range" value={radius} /></label>
                <label>Sale timeframe <strong>{months} months</strong><input aria-label="Sale timeframe" max="12" min="3" onChange={(event) => setMonths(Number(event.target.value))} step="3" type="range" value={months} /></label>
              </div>
              <div className="comp-list">
                {compResult.comps.length ? compResult.comps.map(({ property: comp, distanceKm }) => (
                  <article className="comp-row" key={comp.id}><div><strong>{comp.address}</strong><span>{comp.bedrooms} bed · {comp.floorArea} m² · {distanceKm.toFixed(1)} km away</span></div><div><strong>{formatMoney(comp.price)}</strong><span>Sold {new Date(comp.soldDate!).toLocaleDateString("en-NZ", { month: "short", year: "numeric" })}</span></div></article>
                )) : <div className="empty-inline">No similar sales fit this radius and timeframe. Try widening either control.</div>}
              </div>
              <p className="disclaimer">Demo comparable sales are indicative only and are not a registered valuation.</p>
            </div>
          )}

          {tab === "sunlight" && (
            <div className="sunlight-panel">
              <div className="sun-orbit"><div className="sun-core"><Icon name="sun" size={38} /></div></div>
              <div className="sunlight-copy"><p className="eyebrow">Estimated daily exposure</p><h3>{property.sunlightHours} hours/day</h3><p>This {property.orientation.toLowerCase()}-facing home has a demo sunlight score of {sunlightScore}/100, based on orientation and an indicative site profile.</p><div className="score-track"><span style={{ width: `${sunlightScore}%` }} /></div><div className="sun-facts"><span><strong>{property.orientation}-facing</strong> primary aspect</span><span><strong>{sunlightScore}/100</strong> exposure score</span></div></div>
            </div>
          )}

          {tab === "mortgage" && (
            <div className="mortgage-panel">
              <div className="payment-card"><p>Estimated monthly repayment</p><strong data-testid="monthly-repayment">{formatMoney(monthlyPayment)}</strong><span>Principal & interest · {term}-year term</span></div>
              <div className="mortgage-controls">
                <label><span>Deposit <strong>{deposit}%</strong></span><input aria-label="Deposit percentage" max="60" min="5" onChange={(event) => setDeposit(Number(event.target.value))} step="5" type="range" value={deposit} /></label>
                <label><span>Interest rate <strong>{rate.toFixed(2)}%</strong></span><input aria-label="Interest rate" max="10" min="2" onChange={(event) => setRate(Number(event.target.value))} step="0.01" type="range" value={rate} /></label>
                <label><span>Loan term <strong>{term} years</strong></span><input aria-label="Loan term" max="30" min="10" onChange={(event) => setTerm(Number(event.target.value))} step="5" type="range" value={term} /></label>
              </div>
              <div className="loan-summary"><span>Deposit amount<strong>{formatMoney((property.price * deposit) / 100)}</strong></span><span>Estimated loan<strong>{formatMoney(property.price * (1 - deposit / 100))}</strong></span></div>
              <p className="disclaimer">Estimate only. Rates, fees, insurance and lender criteria are not included.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function PropertyExplorer({ properties, comparableSales, aiSearch = searchWithApi }: PropertyExplorerProps) {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [query, setQuery] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiSource, setAiSource] = useState<"gemini" | "local" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filteredProperties = useMemo(() => filterProperties(properties, filters), [properties, filters]);
  const selectedProperties = properties.filter(({ id }) => selectedIds.includes(id));
  const detailProperty = properties.find(({ id }) => id === detailId);
  const hasFilters = Object.keys(filters).length > 0;

  function togglePropertyType(type: PropertyType) {
    setFilters((current) => ({ ...current, propertyTypes: current.propertyTypes?.includes(type) ? undefined : [type] }));
    setAiMessage("");
  }

  function toggleStyle(style: ArchitecturalStyle) {
    setFilters((current) => {
      const styles = current.architecturalStyles ?? [];
      const nextStyles = styles.includes(style) ? styles.filter((item) => item !== style) : [...styles, style];
      return { ...current, architecturalStyles: nextStyles.length ? nextStyles : undefined };
    });
  }

  function clearFilters() { setFilters({}); setAiMessage(""); setAiSource(null); }
  function toggleCompare(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  async function submitAiSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const result = await aiSearch(query.trim());
      setFilters(result.filters);
      setAiMessage(result.message);
      setAiSource(result.source);
    } catch {
      setAiMessage("Search is temporarily unavailable. Please try the filters below.");
      setAiSource(null);
    } finally { setIsSearching(false); }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Haven home"><span className="brand-mark"><Icon name="house" size={20} /></span><span>haven<span className="brand-dot">.</span></span></a>
        <nav aria-label="Main navigation" className="main-nav"><a className="active" href="#discover">Discover</a><a href="#how-it-works">How it works</a></nav>
        <button className="shortlist-button" disabled={selectedIds.length < 2} onClick={() => setComparisonOpen(true)} type="button"><Icon name="compare" size={17} />{selectedIds.length >= 2 ? `Compare ${selectedIds.length} homes` : "Compare homes"}</button>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-grid" />
          <div className="hero-copy">
            <div className="hero-kicker"><span><Icon name="sparkle" size={14} /></span>AI-powered property discovery</div>
            <h1>Find more than a house.<br /><em>Find your fit.</em></h1>
            <p>Search homes the way you think—by architecture, sunlight, flood risk, building age and the details that actually matter.</p>
            <form className="ai-search" onSubmit={submitAiSearch}>
              <span className="ai-search-icon"><Icon name="sparkle" size={21} /></span>
              <label className="sr-only" htmlFor="ai-property-search">Describe your ideal property</label>
              <input aria-label="Describe your ideal property" id="ai-property-search" onChange={(event) => setQuery(event.target.value)} placeholder="Try “a north-facing character villa in Auckland”" value={query} />
              <button disabled={isSearching} type="submit"><span>{isSearching ? "Thinking…" : "Search"}</span><Icon name="arrow" size={17} /></button>
            </form>
            <div className="prompt-row"><span>Try asking:</span>{["Modernist under $1.2m", "Low flood risk", "North-facing homes"].map((prompt) => <button key={prompt} onClick={() => setQuery(prompt)} type="button">{prompt}</button>)}</div>
            {aiMessage && <div className="ai-response" role="status"><Icon name="sparkle" size={16} /><span>{aiMessage}</span>{aiSource && <small>{aiSource === "gemini" ? "Gemini interpreted" : "Local search"}</small>}</div>}
          </div>
          <div className="hero-aside" aria-hidden="true">
            <div className="hero-stat hero-stat-top"><span>Matching your brief</span><strong>98%</strong><small>AI confidence</small></div>
            <div className="hero-home-visual"><div className="home-sun" /><div className="home-shape"><span /><span /><span /></div><div className="home-ground" /></div>
            <div className="hero-stat hero-stat-bottom"><Icon name="sun" size={18} /><div><strong>7.8 hrs</strong><span>daily sunlight</span></div></div>
          </div>
        </section>

        <section className="discover-section" id="discover">
          <aside className="filter-panel">
            <div className="filter-title"><div><Icon name="sliders" /><h2>Refine search</h2></div>{hasFilters && <button onClick={clearFilters} type="button">Clear all filters</button>}</div>
            <div className="filter-group"><h3>Property type</h3><div className="type-grid">{propertyTypes.map((type) => <button aria-label={type} className={filters.propertyTypes?.includes(type) ? "selected" : ""} key={type} onClick={() => togglePropertyType(type)} type="button"><Icon name="house" size={18} />{type}</button>)}</div></div>
            <details className="filter-details" open><summary>Architecture <span>{filters.architecturalStyles?.length || ""}</span></summary><div className="check-list">{architecturalStyles.map((style) => <label key={style}><input checked={filters.architecturalStyles?.includes(style) ?? false} onChange={() => toggleStyle(style)} type="checkbox" /><span>{style}</span></label>)}</div></details>
            <details className="filter-details" open>
              <summary>Risk & environment</summary><label className="field-label" htmlFor="flood-risk">Flood risk</label>
              <select id="flood-risk" onChange={(event) => setFilters((current) => ({ ...current, floodRisks: event.target.value ? [event.target.value as FloodRisk] : undefined }))} value={filters.floodRisks?.[0] ?? ""}><option value="">Any flood band</option>{floodRisks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select>
              <label className="north-check"><input checked={filters.northFacingOnly ?? false} onChange={(event) => setFilters((current) => ({ ...current, northFacingOnly: event.target.checked || undefined }))} type="checkbox" /><Icon name="sun" size={18} /><span><strong>North-facing only</strong><small>Higher sunlight potential</small></span></label>
            </details>
            <details className="filter-details"><summary>Building age</summary><div className="year-fields"><label>Built from<input inputMode="numeric" onChange={(event) => setFilters((current) => ({ ...current, yearBuiltFrom: Number(event.target.value) || undefined }))} placeholder="1900" value={filters.yearBuiltFrom ?? ""} /></label><label>Built to<input inputMode="numeric" onChange={(event) => setFilters((current) => ({ ...current, yearBuiltTo: Number(event.target.value) || undefined }))} placeholder="2026" value={filters.yearBuiltTo ?? ""} /></label></div></details>
            <div className="data-note"><Icon name="map" size={18} /><p><strong>Demo data</strong><span>Source records are enriched with indicative specialist attributes.</span></p></div>
          </aside>

          <div className="results-panel">
            <div className="results-header"><div><p className="eyebrow">Curated for your criteria</p><h2>{filteredProperties.length} {filteredProperties.length === 1 ? "property" : "properties"} found</h2></div><div className="view-note"><span className="live-dot" />Filters update instantly</div></div>
            {filteredProperties.length ? <div className="property-grid">{filteredProperties.map((property) => <PropertyCard key={property.id} onCompare={() => toggleCompare(property.id)} onOpen={() => setDetailId(property.id)} property={property} selected={selectedIds.includes(property.id)} />)}</div> : <div className="empty-state"><span><Icon name="search" size={28} /></span><h3>No matching listings were found</h3><p>Try widening your location, budget, style or specialist filters.</p><button onClick={clearFilters} type="button">Reset filters</button></div>}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <p className="eyebrow">Search differently</p><h2>Details the big portals leave buried.</h2>
          <div className="how-grid"><article><span>01</span><Icon name="sparkle" /><h3>Ask naturally</h3><p>Describe the home you want in plain language. Gemini translates it into precise property filters.</p></article><article><span>02</span><Icon name="sun" /><h3>See what matters</h3><p>Explore architecture, flood bands, age, aspect and estimated sunlight in one calm workspace.</p></article><article><span>03</span><Icon name="compare" /><h3>Decide with context</h3><p>Compare homes, recent nearby sales and repayments without losing your shortlist.</p></article></div>
        </section>
      </main>

      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark"><Icon name="house" size={18} /></span><span>haven<span className="brand-dot">.</span></span></a><p>Smarter property discovery for Aotearoa buyers.</p><span>Demo experience · 2026</span></footer>

      {selectedIds.length > 0 && !comparisonOpen && <div className="compare-dock"><div className="compare-avatars">{selectedProperties.slice(0, 3).map((property) => <span key={property.id}><Image alt="" fill sizes="44px" src={property.image} /></span>)}</div><div><strong>{selectedIds.length} {selectedIds.length === 1 ? "home" : "homes"} selected</strong><span>{selectedIds.length < 2 ? "Choose one more to compare" : "Ready for a side-by-side view"}</span></div><button disabled={selectedIds.length < 2} onClick={() => setComparisonOpen(true)} type="button">Compare {selectedIds.length >= 2 ? `${selectedIds.length} homes` : ""}<Icon name="arrow" size={16} /></button></div>}
      {comparisonOpen && <ComparisonDialog onClose={() => setComparisonOpen(false)} onRemove={(id) => setSelectedIds((current) => current.filter((item) => item !== id))} properties={selectedProperties} />}
      {detailProperty && <DetailDialog comparableSales={comparableSales} onClose={() => setDetailId(null)} property={detailProperty} />}
    </div>
  );
}
