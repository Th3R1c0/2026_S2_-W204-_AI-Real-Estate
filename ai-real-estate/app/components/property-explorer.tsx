"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import MortgageCalculator from "./mortgage-calculator";

import {
  calculateMonthlyMortgage,
  filterProperties,
  findComparableSales,
  generateSampleNotifications,
} from "../../lib/property-engine";
import type {
  ArchitecturalStyle,
  FloodRisk,
  Property,
  PropertyFilters,
  PropertyNotification,
  PropertySource,
  PropertySourceField,
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

type DetailTab = "overview" | "comps" | "sunlight" | "family" | "mortgage";
type SourceSelection = {
  source: PropertySource;
  field: PropertySourceField;
  property: Property;
};

const sourceFieldLabels: Record<PropertySourceField, string> = {
  address: "address",
  price: "indicative value",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  landArea: "land area",
};

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

function SourceCitations({
  property,
  field,
  onOpen,
}: {
  property: Property;
  field: PropertySourceField;
  onOpen: (source: PropertySource, field: PropertySourceField) => void;
}) {
  const sources = property.sources?.filter((source) => source.fields.includes(field)) ?? [];

  if (!sources.length) return null;

  return (
    <span className="source-citations">
      {sources.map((source, index) => (
        <button
          aria-label={`View source ${index + 1} for ${sourceFieldLabels[field]}`}
          className="source-citation"
          key={source.id}
          onClick={() => onOpen(source, field)}
          type="button"
        >
          [{index + 1}]
        </button>
      ))}
    </span>
  );
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
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.25 3.75L17 8l-3.75 1.25L12 13l-1.25-3.75L7 8l3.75-1.25L12 3Z" />
        <path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h7M15 6h5M4 12h2M10 12h10M4 18h9M17 18h3" />
        <circle cx="13" cy="6" r="2" />
        <circle cx="8" cy="12" r="2" />
        <circle cx="15" cy="18" r="2" />
      </>
    ),
    bed: (
      <>
        <path d="M4 12V7M4 10h16a2 2 0 0 1 2 2v5H2v-3a2 2 0 0 1 2-2Z" />
        <path d="M7 10V7h5a2 2 0 0 1 2 2v1M2 20v-3M22 20v-3" />
      </>
    ),
    bath: (
      <>
        <path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2ZM7 12V5a2 2 0 0 1 4 0" />
        <path d="M7 19v2M17 19v2" />
      </>
    ),
    ruler: (
      <>
        <path d="m4 17 13-13 3 3L7 20l-3-3Z" />
        <path d="m14 7 3 3M11 10l2 2M8 13l3 3" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </>
    ),
    compare: (
      <>
        <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    house: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    heart: (
      <>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.04 3 5.5l7 7Z" />
      </>
    ),
    bell: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.33 21a1.94 1.94 0 0 0 3.34 0" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function PropertyCard({
  property,
  selected,
  isSaved,
  onCompare,
  onSave,
  onOpen,
  onOpenSource,
}: {
  property: Property;
  selected: boolean;
  isSaved: boolean;
  onCompare: () => void;
  onSave: () => void;
  onOpen: () => void;
  onOpenSource: (source: PropertySource, field: PropertySourceField) => void;
}) {
  return (
    <article className="property-card">
      <div className="property-media">
        <Image
          alt={property.imageAlt}
          className="property-image"
          fill
          sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 380px"
          src={property.image}
        />
        <span className="style-badge">{property.architecturalStyle}</span>
        <button
          aria-label={isSaved ? "Remove from saved listings" : "Save property"}
          className={`save-button ${isSaved ? "is-saved" : ""}`}
          onClick={onSave}
          type="button"
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: isSaved ? "#ef4444" : "rgba(0,0,0,0.6)",
            border: "none",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <Icon name="heart" size={18} />
        </button>
        <label className={`compare-check ${selected ? "is-selected" : ""}`}>
          <input
            aria-label={`Compare ${property.address}`}
            checked={selected}
            onChange={onCompare}
            type="checkbox"
          />
          <Icon name="compare" size={15} />
          Compare
        </label>
      </div>
      <div className="property-body">
        <div className="property-heading">
          <div>
            <p className="property-price">
              {formatMoney(property.price)}
              <SourceCitations field="price" onOpen={onOpenSource} property={property} />
            </p>
            <h3>
              {property.address}
              <SourceCitations field="address" onOpen={onOpenSource} property={property} />
            </h3>
            <p className="property-location">
              {property.suburb}, {property.city}
            </p>
          </div>
          {property.floodRisk ? (
            <span
              className={`risk-dot risk-${property.floodRisk.toLowerCase()}`}
              title={`${property.floodRisk} flood risk`}
            />
          ) : (
            <span className="risk-dot" title="Flood risk not provided" />
          )}
        </div>
        <div className="property-specs" aria-label="Property features">
          <span>
            <Icon name="bed" size={17} />
            {property.bedrooms} beds
            <SourceCitations field="bedrooms" onOpen={onOpenSource} property={property} />
          </span>
          <span>
            <Icon name="bath" size={17} />
            {property.bathrooms} baths
            <SourceCitations field="bathrooms" onOpen={onOpenSource} property={property} />
          </span>
          <span>
            <Icon name="ruler" size={17} />
            {numberFormatter.format(property.landArea)} m²
            <SourceCitations field="landArea" onOpen={onOpenSource} property={property} />
          </span>
        </div>
        <div className="card-footer">
          <div className="sun-chip">
            <Icon name="sun" size={15} />
            {property.sunlightHours === undefined
              ? "Sunlight not provided"
              : `${property.sunlightHours} hrs sunlight`}
          </div>
          <button
            aria-label={`View details for ${property.address}`}
            className="icon-button"
            onClick={onOpen}
            type="button"
          >
            <Icon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  );
}

function SavedListingsDialog({
  savedProperties,
  notifications,
  onClose,
  onRemoveSave,
  onOpenDetail,
  onMarkNotificationRead,
}: {
  savedProperties: Property[];
  notifications: PropertyNotification[];
  onClose: () => void;
  onRemoveSave: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onMarkNotificationRead: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"listings" | "notifications">("listings");

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="Saved listings and notifications dashboard"
        aria-modal="true"
        className="modal comparison-modal"
        role="dialog"
        style={{ maxWidth: "720px" }}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Your Shortlist & Alerts</p>
            <h2>Saved Listings & Notifications</h2>
          </div>
          <button
            aria-label="Close saved listings"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="comparison-toolbar" style={{ display: "flex", gap: "1rem" }}>
          <button
            className={`detail-tabs button ${activeTab === "listings" ? "active" : ""}`}
            onClick={() => setActiveTab("listings")}
            style={{
              padding: "0.5rem 1rem",
              fontWeight: activeTab === "listings" ? "bold" : "normal",
              borderBottom: activeTab === "listings" ? "2px solid currentColor" : "none",
              background: "none",
              cursor: "pointer",
            }}
            type="button"
          >
            Saved Homes ({savedProperties.length})
          </button>
          <button
            className={`detail-tabs button ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
            style={{
              padding: "0.5rem 1rem",
              fontWeight: activeTab === "notifications" ? "bold" : "normal",
              borderBottom: activeTab === "notifications" ? "2px solid currentColor" : "none",
              background: "none",
              cursor: "pointer",
            }}
            type="button"
          >
            Notifications ({notifications.filter((n) => !n.read).length} unread)
          </button>
        </div>
        <div className="comparison-scroll" style={{ padding: "1rem 0" }}>
          {activeTab === "listings" ? (
            savedProperties.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {savedProperties.map((prop) => (
                  <div
                    key={prop.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      border: "1px solid var(--border-color, #e5e7eb)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                      <div style={{ position: "relative", width: "60px", height: "60px", borderRadius: "6px", overflow: "hidden" }}>
                        <Image alt={prop.imageAlt} fill sizes="60px" src={prop.image} />
                      </div>
                      <div>
                        <strong>{prop.address}</strong>
                        <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", opacity: 0.8 }}>
                          {prop.suburb} · {formatMoney(prop.price)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="button"
                        onClick={() => {
                          onClose();
                          onOpenDetail(prop.id);
                        }}
                        type="button"
                        style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", cursor: "pointer" }}
                      >
                        View
                      </button>
                      <button
                        className="button"
                        onClick={() => onRemoveSave(prop.id)}
                        type="button"
                        style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", background: "#fee2e2", color: "#b91c1c", border: "none", cursor: "pointer", borderRadius: "4px" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline" style={{ textAlign: "center", padding: "2rem" }}>
                <p>You haven't saved any listings yet. Click the heart icon on any property card to save it here.</p>
              </div>
            )
          ) : (
            notifications.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color, #e5e7eb)",
                      background: notif.read ? "transparent" : "rgba(59, 130, 246, 0.05)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: "600", padding: "0.1rem 0.4rem", borderRadius: "4px", background: "#e0e7ff", color: "#3730a3" }}>
                          {notif.type.replace("_", " ").toUpperCase()}
                        </span>
                        <small style={{ opacity: 0.7 }}>{notif.date}</small>
                      </div>
                      <h4 style={{ margin: "0.2rem 0", fontSize: "0.95rem" }}>{notif.title}</h4>
                      <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => onMarkNotificationRead(notif.id)}
                        type="button"
                        style={{ fontSize: "0.75rem", background: "none", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline" style={{ textAlign: "center", padding: "2rem" }}>
                <p>No notifications at this time. Updates for your saved properties will appear here.</p>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function ComparisonDialog({
  properties,
  onClose,
  onRemove,
}: {
  properties: Property[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [highlight, setHighlight] = useState(false);
  const values = {
    Price: properties.map(({ price }) => formatMoney(price)),
    Bedrooms: properties.map(({ bedrooms }) => String(bedrooms)),
    Bathrooms: properties.map(({ bathrooms }) => String(bathrooms)),
    "Land area": properties.map(({ landArea }) => `${numberFormatter.format(landArea)} m²`),
    "Built in": properties.map(({ yearBuilt }) => String(yearBuilt)),
    Style: properties.map(({ architecturalStyle }) => architecturalStyle ?? "N/A"),
    "Flood risk": properties.map(({ floodRisk }) => floodRisk ?? "N/A"),
    Sunlight: properties.map(({ sunlightHours }) =>
      sunlightHours === undefined ? "N/A" : `${sunlightHours} hrs/day`
    ),
    Walkability: properties.map(({ walkability }) =>
      walkability?.score === undefined ? "N/A" : `${walkability.score}/100`
    ),
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="Property comparison"
        aria-modal="true"
        className="modal comparison-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Side-by-side view</p>
            <h2>Compare your shortlist</h2>
          </div>
          <button
            aria-label="Close comparison"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="comparison-toolbar">
          <p>{properties.length} homes selected</p>
          <label className="switch-label">
            <input
              checked={highlight}
              onChange={(event) => setHighlight(event.target.checked)}
              type="checkbox"
            />
            Highlight differences
          </label>
        </div>
        <div className="comparison-scroll">
          <div
            className="comparison-grid"
            style={{
              gridTemplateColumns: `150px repeat(${properties.length}, minmax(190px, 1fr))`,
            }}
          >
            <div />
            {properties.map((property) => (
              <div className="compare-property-head" key={property.id}>
                <button
                  aria-label={`Remove ${property.address}`}
                  className="remove-button"
                  onClick={() => onRemove(property.id)}
                  type="button"
                >
                  <Icon name="close" size={14} />
                </button>
                <div className="compare-thumb">
                  <Image alt={property.imageAlt} fill sizes="200px" src={property.image} />
                </div>
                <strong>{property.address}</strong>
                <span>{property.suburb}</span>
              </div>
            ))}
            {Object.entries(values).flatMap(([label, row]) => {
              const different = new Set(row).size > 1;
              return [
                <div className="compare-label" key={`${label}-label`}>
                  {label}
                </div>,
                ...row.map((value, index) => (
                  <div
                    className={highlight && different ? "compare-value is-different" : "compare-value"}
                    key={`${label}-${properties[index]?.id}`}
                  >
                    {value}
                  </div>
                )),
              ];
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailDialog({
  property,
  comparableSales,
  isSaved,
  onSave,
  onClose,
  onOpenSource,
}: {
  property: Property;
  comparableSales: Property[];
  isSaved: boolean;
  onSave: () => void;
  onClose: () => void;
  onOpenSource: (source: PropertySource, field: PropertySourceField) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [radius, setRadius] = useState(2);
  const [months, setMonths] = useState(6);
  const compResult = useMemo(
    () =>
      findComparableSales(property, comparableSales, {
        radiusKm: radius,
        months,
        asOf: new Date("2026-09-18T00:00:00Z"),
      }),
    [property, comparableSales, radius, months]
  );
  const sunlightScore =
    property.sunlightHours === undefined
      ? undefined
      : Math.min(100, Math.round((property.sunlightHours / 9) * 100));
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "comps", label: "Comparable sales" },
    { id: "sunlight", label: "Sunlight" },
    { id: "family", label: "Schools & Walkability" },
    { id: "mortgage", label: "Mortgage" },
  ];

  return (
    <div className="modal-backdrop detail-backdrop" role="presentation">
      <section
        aria-label="Property details"
        aria-modal="true"
        className="modal detail-modal"
        role="dialog"
      >
        <div className="detail-hero">
          <Image
            alt={property.imageAlt}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 720px"
            src={property.image}
          />
          <button
            aria-label="Close property details"
            className="icon-button modal-close"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
          <button
            aria-label={isSaved ? "Remove from saved listings" : "Save property"}
            onClick={onSave}
            type="button"
            style={{
              position: "absolute",
              top: "16px",
              right: "60px",
              background: isSaved ? "#ef4444" : "rgba(0,0,0,0.6)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              cursor: "pointer",
              zIndex: 3,
            }}
          >
            <Icon name="heart" size={20} />
          </button>
          <div className="detail-hero-copy">
            <span>
              {property.propertyType} · {property.architecturalStyle ?? "Style not provided"}
            </span>
            <h2>{property.address}</h2>
            <p>
              {property.suburb}, {property.city}
            </p>
          </div>
        </div>
        <nav aria-label="Property detail sections" className="detail-tabs">
          {tabs.map(({ id, label }) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="detail-content">
          {tab === "overview" && (
            <div className="overview-panel">
              <div className="overview-price">
                <p>Indicative price</p>
                <strong>
                  {formatMoney(property.price)}
                  <SourceCitations field="price" onOpen={onOpenSource} property={property} />
                </strong>
                <span>Demo valuation, not a live listing</span>
              </div>
              <div className="stat-grid">
                <div>
                  <Icon name="bed" />
                  <strong>{property.bedrooms}</strong>
                  <span>Bedrooms</span>
                  <SourceCitations field="bedrooms" onOpen={onOpenSource} property={property} />
                </div>
                <div>
                  <Icon name="bath" />
                  <strong>{property.bathrooms}</strong>
                  <span>Bathrooms</span>
                  <SourceCitations field="bathrooms" onOpen={onOpenSource} property={property} />
                </div>
                <div>
                  <Icon name="ruler" />
                  <strong>{numberFormatter.format(property.landArea)} m²</strong>
                  <span>Land area</span>
                  <SourceCitations field="landArea" onOpen={onOpenSource} property={property} />
                </div>
                <div>
                  <Icon name="house" />
                  <strong>{property.yearBuilt}</strong>
                  <span>Demo year built</span>
                </div>
              </div>
              <div className="insight-note">
                <Icon name="sparkle" />
                <div>
                  <strong>Why it stands out</strong>
                  <p>
                    {[
                      property.architecturalStyle
                        ? `${property.architecturalStyle} design`
                        : undefined,
                      property.floodRisk
                        ? `${property.floodRisk.toLowerCase()} demo flood band`
                        : undefined,
                      property.sunlightHours === undefined
                        ? undefined
                        : `${property.sunlightHours} estimated sunlight hours`,
                    ]
                      .filter(Boolean)
                      .join("; ") || "Additional property details are not available yet."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "comps" && (
            <div className="tool-panel">
              <div className="tool-heading">
                <div>
                  <p className="eyebrow">Recent market evidence</p>
                  <h3>Nearby comparable sales</h3>
                </div>
                <div className="average-pill">
                  {compResult.averagePrice ? `${formatMoney(compResult.averagePrice)} average` : "No average"}
                </div>
              </div>
              <div className="range-grid">
                <label>
                  Search radius <strong>{radius} km</strong>
                  <input
                    aria-label="Search radius"
                    max="10"
                    min="1"
                    onChange={(event) => setRadius(Number(event.target.value))}
                    type="range"
                    value={radius}
                  />
                </label>
                <label>
                  Sale timeframe <strong>{months} months</strong>
                  <input
                    aria-label="Sale timeframe"
                    max="12"
                    min="3"
                    onChange={(event) => setMonths(Number(event.target.value))}
                    step="3"
                    type="range"
                    value={months}
                  />
                </label>
              </div>
              <div className="comp-list">
                {compResult.comps.length ? (
                  compResult.comps.map(({ property: comp, distanceKm }) => (
                    <article className="comp-row" key={comp.id}>
                      <div>
                        <strong>{comp.address}</strong>
                        <span>
                          {comp.bedrooms} bed · {comp.floorArea} m² · {distanceKm.toFixed(1)} km away
                        </span>
                      </div>
                      <div>
                        <strong>{formatMoney(comp.price)}</strong>
                        <span>
                          Sold{" "}
                          {new Date(comp.soldDate!).toLocaleDateString("en-NZ", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-inline">
                    No similar sales fit this radius and timeframe. Try widening either control.
                  </div>
                )}
              </div>
              <p className="disclaimer">
                Demo comparable sales are indicative only and are not a registered valuation.
              </p>
            </div>
          )}

          {tab === "sunlight" && (
            <div className="sunlight-panel">
              <div className="sun-orbit">
                <div className="sun-core">
                  <Icon name="sun" size={38} />
                </div>
              </div>
              <div className="sunlight-copy">
                <p className="eyebrow">Estimated daily exposure</p>
                <h3>
                  {property.sunlightHours === undefined
                    ? "Sunlight estimate not provided"
                    : `${property.sunlightHours} hours/day`}
                </h3>
                <p>
                  {property.orientation
                    ? `This ${property.orientation.toLowerCase()}-facing home has an indicative site profile.`
                    : "Orientation information is not available for this property."}
                  {sunlightScore === undefined
                    ? ""
                    : ` Its demo sunlight score is ${sunlightScore}/100.`}
                </p>
                {sunlightScore !== undefined && (
                  <div className="score-track">
                    <span style={{ width: `${sunlightScore}%` }} />
                  </div>
                )}
                <div className="sun-facts">
                  {property.orientation && (
                    <span>
                      <strong>{property.orientation}-facing</strong> primary aspect
                    </span>
                  )}
                  {sunlightScore !== undefined && (
                    <span>
                      <strong>{sunlightScore}/100</strong> exposure score
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "family" && (
            <div className="family-panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="insight-note" style={{ padding: "1rem", borderRadius: "8px" }}>
                <Icon name="sparkle" />
                <div>
                  <strong>Walkability Score: {property.walkability?.score ?? 75}/100</strong>
                  <p style={{ margin: "0.25rem 0" }}>{property.walkability?.label ?? "Somewhat Walkable"}</p>
                  <small style={{ opacity: 0.8 }}>
                    Nearby: {property.walkability?.parksNearby ?? 2} parks · {property.walkability?.cafesNearby ?? 4} cafes · {property.walkability?.supermarketsNearby ?? 1} supermarket
                  </small>
                </div>
              ) : (
                <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                  Walkability information is not available for this property.
                </p>
              )}

              <div>
                <h4 style={{ marginBottom: "0.75rem", fontWeight: "600" }}>School Catchments</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {property.schoolZones?.length ? (
                    property.schoolZones.map((school) => (
                      <div
                        key={school.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem",
                          border: "1px solid var(--border-color, #e5e7eb)",
                          borderRadius: "6px",
                        }}
                      >
                        <div>
                          <strong>{school.name}</strong>
                          <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.7 }}>
                            {school.type} · {school.distanceKm} km away
                          </span>
                        </div>
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            backgroundColor: school.isInZone ? "#dcfce7" : "#f3f4f6",
                            color: school.isInZone ? "#166534" : "#4b5563",
                          }}
                        >
                          {school.isInZone ? "In Zone" : "Out of Zone"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                      No direct school zone information available for this property.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "mortgage" && (
            <div className="mortgage-panel">
              <MortgageCalculator defaultPrice={property.price} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SourceDetailsDialog({
  selection,
  onClose,
}: {
  selection: SourceSelection;
  onClose: () => void;
}) {
  const { field, property, source } = selection;
  const claimValue = {
    address: property.address,
    price: formatMoney(property.price),
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    landArea: `${numberFormatter.format(property.landArea)} m²`,
  }[field];

  return (
    <div className="modal-backdrop source-backdrop" role="presentation">
      <section
        aria-label="Source details"
        aria-modal="true"
        className="modal source-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Reference for {sourceFieldLabels[field]}</p>
            <h2>{source.title}</h2>
          </div>
          <button
            aria-label="Close source details"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="source-content">
          <dl className="source-claim">
            <div>
              <dt>Property claim</dt>
              <dd>{claimValue}</dd>
            </div>
            <div>
              <dt>Property</dt>
              <dd>{property.address}</dd>
            </div>
          </dl>
          <div className="source-publication">
            <p className="eyebrow">Published by {source.publisher}</p>
            <p>{source.reference}</p>
          </div>
          <div className="source-material">
            <h3>Reference material</h3>
            <blockquote>{source.material}</blockquote>
          </div>
          <a className="source-link" href={source.url} rel="noreferrer" target="_blank">
            Open original source <Icon name="arrow" size={16} />
          </a>
          <p className="source-caveat">
            This dataset reports Capital Value (CV), not a current asking price. Demo property records
            and enriched details should be independently verified.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function PropertyExplorer({
  properties,
  comparableSales,
  aiSearch = searchWithApi,
}: PropertyExplorerProps) {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [query, setQuery] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiSource, setAiSource] = useState<"gemini" | "local" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sourceSelection, setSourceSelection] = useState<SourceSelection | null>(null);
  const [notifications, setNotifications] = useState<PropertyNotification[]>([]);

  const filteredProperties = useMemo(() => filterProperties(properties, filters), [properties, filters]);
  const selectedProperties = properties.filter(({ id }) => selectedIds.includes(id));
  const savedProperties = properties.filter(({ id }) => savedIds.includes(id));
  const detailProperty = properties.find(({ id }) => id === detailId);
  const hasFilters = Object.keys(filters).length > 0;

  // Initialize sample notifications when saved IDs change
  useEffect(() => {
    const generated = generateSampleNotifications(savedProperties);
    setNotifications((curr) => {
      return generated.map((gen) => {
        const existing = curr.find((c) => c.id === gen.id);
        return existing ? { ...gen, read: existing.read } : gen;
      });
    });
  }, [savedIds]);

  function togglePropertyType(type: PropertyType) {
    setFilters((current) => ({
      ...current,
      propertyTypes: current.propertyTypes?.includes(type) ? undefined : [type],
    }));
    setAiMessage("");
  }

  function toggleStyle(style: ArchitecturalStyle) {
    setFilters((current) => {
      const styles = current.architecturalStyles ?? [];
      const nextStyles = styles.includes(style)
        ? styles.filter((item) => item !== style)
        : [...styles, style];
      return { ...current, architecturalStyles: nextStyles.length ? nextStyles : undefined };
    });
  }

  function clearFilters() {
    setFilters({});
    setAiMessage("");
    setAiSource(null);
  }

  function toggleCompare(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleSave(id: string) {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function markNotificationRead(id: string) {
    setNotifications((curr) =>
      curr.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

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
    } finally {
      setIsSearching(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Haven home">
          <span className="brand-mark">
            <Icon name="house" size={20} />
          </span>
          <span>
            haven<span className="brand-dot">.</span>
          </span>
        </a>

        <nav aria-label="Main navigation" className="main-nav">
          <a className="active" href="#discover">
            Discover
          </a>
          <a href="#calculator">Calculator</a>
          <a href="#how-it-works">How it works</a>
        </nav>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            className="shortlist-button"
            onClick={() => setSavedModalOpen(true)}
            type="button"
            style={{ position: "relative" }}
          >
            <Icon name="bell" size={17} />
            Alerts & Saved ({savedIds.length})
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  fontSize: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <button
            className="shortlist-button"
            disabled={selectedIds.length < 2}
            onClick={() => setComparisonOpen(true)}
            type="button"
          >
            <Icon name="compare" size={17} />
            {selectedIds.length >= 2 ? `Compare ${selectedIds.length} homes` : "Compare homes"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-grid" />
          <div className="hero-copy">
            <div className="hero-kicker">
              <span>
                <Icon name="sparkle" size={14} />
              </span>
              AI-powered property discovery
            </div>
            <h1>
              Find more than a house.
              <br />
              <em>Find your fit.</em>
            </h1>
            <p>
              Search homes the way you think—by architecture, sunlight, flood risk, building age and the details that actually matter.
            </p>
            <form className="ai-search" onSubmit={submitAiSearch}>
              <span className="ai-search-icon">
                <Icon name="sparkle" size={21} />
              </span>
              <label className="sr-only" htmlFor="ai-property-search">
                Describe your ideal property
              </label>
              <input
                aria-label="Describe your ideal property"
                id="ai-property-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “a north-facing character villa in Auckland”"
                value={query}
              />
              <button disabled={isSearching} type="submit">
                <span>{isSearching ? "Thinking…" : "Search"}</span>
                <Icon name="arrow" size={17} />
              </button>
            </form>
            <div className="prompt-row">
              <span>Try asking:</span>
              {["Modernist under \$1.2m", "Low flood risk", "North-facing homes"].map((prompt) => (
                <button key={prompt} onClick={() => setQuery(prompt)} type="button">
                  {prompt}
                </button>
              ))}
            </div>
            {aiMessage && (
              <div className="ai-response" role="status">
                <Icon name="sparkle" size={16} />
                <span>{aiMessage}</span>
                {aiSource && (
                  <small>{aiSource === "gemini" ? "Gemini interpreted" : "Local search"}</small>
                )}
              </div>
            )}
          </div>
          <div className="hero-aside" aria-hidden="true">
            <div className="hero-stat hero-stat-top">
              <span>Matching your brief</span>
              <strong>98%</strong>
              <small>AI confidence</small>
            </div>
            <div className="hero-home-visual">
              <div className="home-sun" />
              <div className="home-shape">
                <span />
                <span />
                <span />
              </div>
              <div className="home-ground" />
            </div>
            <div className="hero-stat hero-stat-bottom">
              <Icon name="sun" size={18} />
              <div>
                <strong>7.8 hrs</strong>
                <span>daily sunlight</span>
              </div>
            </div>
          </div>
        </section>

        <section className="discover-section" id="discover">
          <aside className="filter-panel">
            <div className="filter-title">
              <div>
                <Icon name="sliders" />
                <h2>Refine search</h2>
              </div>
              {hasFilters && (
                <button onClick={clearFilters} type="button">
                  Clear all filters
                </button>
              )}
            </div>
            <div className="filter-group">
              <h3>Property type</h3>
              <div className="type-grid">
                {propertyTypes.map((type) => (
                  <button
                    aria-label={type}
                    className={filters.propertyTypes?.includes(type) ? "selected" : ""}
                    key={type}
                    onClick={() => togglePropertyType(type)}
                    type="button"
                  >
                    <Icon name="house" size={18} />
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <details className="filter-details" open>
              <summary>
                Architecture <span>{filters.architecturalStyles?.length || ""}</span>
              </summary>
              <div className="check-list">
                {architecturalStyles.map((style) => (
                  <label key={style}>
                    <input
                      checked={filters.architecturalStyles?.includes(style) ?? false}
                      onChange={() => toggleStyle(style)}
                      type="checkbox"
                    />
                    <span>{style}</span>
                  </label>
                ))}
              </div>
            </details>
            <details className="filter-details" open>
              <summary>Risk & environment</summary>
              <label className="field-label" htmlFor="flood-risk">
                Flood risk
              </label>
              <select
                id="flood-risk"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    floodRisks: event.target.value ? [event.target.value as FloodRisk] : undefined,
                  }))
                }
                value={filters.floodRisks?.[0] ?? ""}
              >
                <option value="">Any flood band</option>
                {floodRisks.map((risk) => (
                  <option key={risk} value={risk}>
                    {risk}
                  </option>
                ))}
              </select>
              <label className="north-check">
                <input
                  checked={filters.northFacingOnly ?? false}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      northFacingOnly: event.target.checked || undefined,
                    }))
                  }
                  type="checkbox"
                />
                <Icon name="sun" size={18} />
                <span>
                  <strong>North-facing only</strong>
                  <small>Higher sunlight potential</small>
                </span>
              </label>
            </details>
            <details className="filter-details">
              <summary>Building age</summary>
              <div className="year-fields">
                <label>
                  Built from
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        yearBuiltFrom: Number(event.target.value) || undefined,
                      }))
                    }
                    placeholder="1900"
                    value={filters.yearBuiltFrom ?? ""}
                  />
                </label>
                <label>
                  Built to
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        yearBuiltTo: Number(event.target.value) || undefined,
                      }))
                    }
                    placeholder="2026"
                    value={filters.yearBuiltTo ?? ""}
                  />
                </label>
              </div>
            </details>

            {/* Family & Community Filters */}
            <details className="filter-details" open>
              <summary>Family & Community</summary>
              <div className="filter-group" style={{ marginTop: "8px" }}>
                <label className="field-label" htmlFor="walk-score">
                  Min walk score: <strong>{filters.minWalkScore ?? 0}</strong>
                </label>
                <input
                  id="walk-score"
                  max="100"
                  min="0"
                  onChange={(e) =>
                    setFilters((curr) => ({
                      ...curr,
                      minWalkScore: Number(e.target.value) || undefined,
                    }))
                  }
                  step="10"
                  type="range"
                  value={filters.minWalkScore ?? 0}
                />
              </div>
              <label className="north-check" style={{ marginTop: "12px" }}>
                <input
                  checked={filters.inZoneOnly ?? false}
                  onChange={(e) =>
                    setFilters((curr) => ({
                      ...curr,
                      inZoneOnly: e.target.checked || undefined,
                    }))
                  }
                  type="checkbox"
                />
                <Icon name="house" size={18} />
                <span>
                  <strong>In-zone schools only</strong>
                  <small>Guaranteed school catchment zone</small>
                </span>
              </label>
            </details>

            {/* Commute & Transport Filters */}
            <details className="filter-details" open>
              <summary>Commute & Transport</summary>
              <div className="filter-group" style={{ marginTop: "8px" }}>
                <label className="field-label" htmlFor="max-commute">
                  Max commute time: <strong>{filters.maxCommuteTimeMinutes ?? 45} mins</strong>
                </label>
                <input
                  id="max-commute"
                  max="60"
                  min="10"
                  step="5"
                  type="range"
                  onChange={(e) =>
                    setFilters((curr) => ({
                      ...curr,
                      maxCommuteTimeMinutes: Number(e.target.value) || undefined,
                    }))
                  }
                  value={filters.maxCommuteTimeMinutes ?? 45}
                />
              </div>
              <label className="field-label" htmlFor="commute-mode" style={{ marginTop: "12px", display: "block" }}>
                Transport Mode
              </label>
              <select
                id="commute-mode"
                value={filters.commuteMode ?? "driving"}
                onChange={(e) =>
                  setFilters((curr) => ({
                    ...curr,
                    commuteMode: e.target.value ? (e.target.value as "driving" | "transit" | "walking") : undefined,
                  }))
                }
              >
                <option value="driving">Driving</option>
                <option value="transit">Public Transit</option>
                <option value="walking">Walking</option>
              </select>
            </details>

            <div className="data-note">
              <Icon name="map" size={18} />
              <p>
                <strong>Demo data</strong>
                <span>Source records are enriched with indicative specialist attributes.</span>
              </p>
            </div>
          </aside>

          <div className="results-panel">
            <div className="results-header">
              <div>
                <p className="eyebrow">Curated for your criteria</p>
                <h2>
                  {filteredProperties.length}{" "}
                  {filteredProperties.length === 1 ? "property" : "properties"} found
                </h2>
              </div>
              <div className="view-note">
                <span className="live-dot" />
                Filters update instantly
              </div>
            </div>
            {filteredProperties.length ? (
              <div className="property-grid">
                {filteredProperties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    isSaved={savedIds.includes(property.id)}
                    onCompare={() => toggleCompare(property.id)}
                    onSave={() => toggleSave(property.id)}
                    onOpen={() => setDetailId(property.id)}
                    onOpenSource={(source, field) =>
                      setSourceSelection({ source, field, property })
                    }
                    property={property}
                    selected={selectedIds.includes(property.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>
                  <Icon name="search" size={28} />
                </span>
                <h3>No matching listings were found</h3>
                <p>Try widening your location, budget, style or specialist filters.</p>
                <button onClick={clearFilters} type="button">
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Standalone Mortgage Calculator Section on Home Screen */}
        <section className="calculator-section" id="calculator">
          <div className="section-title">
            <p className="eyebrow">Finance Estimator</p>
            <h2>Mortgage Repayment Calculator</h2>
            <p>Estimate your weekly, fortnightly, or monthly repayments based on current rates.</p>
          </div>
          <div className="calculator-container">
            <MortgageCalculator defaultPrice={1250000} />
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <p className="eyebrow">Search differently</p>
          <h2>Details the big portals leave buried.</h2>
          <div className="how-grid">
            <article>
              <span>01</span>
              <Icon name="sparkle" />
              <h3>Ask naturally</h3>
              <p>Describe the home you want in plain language. Gemini translates it into precise property filters.</p>
            </article>
            <article>
              <span>02</span>
              <Icon name="sun" />
              <h3>See what matters</h3>
              <p>Explore architecture, flood bands, age, aspect and estimated sunlight in one calm workspace.</p>
            </article>
            <article>
              <span>03</span>
              <Icon name="compare" />
              <h3>Decide with context</h3>
              <p>Compare homes, recent nearby sales and repayments without losing your shortlist.</p>
            </article>
          </div>
        </section>
      </main>

      {/* Saved Listings & Notifications Modal */}
      {savedModalOpen && (
        <SavedListingsDialog
          notifications={notifications}
          onClose={() => setSavedModalOpen(false)}
          onMarkNotificationRead={markNotificationRead}
          onOpenDetail={(id) => setDetailId(id)}
          onRemoveSave={(id) => toggleSave(id)}
          savedProperties={savedProperties}
        />
      )}

      {/* Comparison Modal */}
      {comparisonOpen && (
        <ComparisonDialog
          onClose={() => setComparisonOpen(false)}
          onRemove={(id) => setSelectedIds((curr) => curr.filter((item) => item !== id))}
          properties={selectedProperties}
        />
      )}

      {/* Property Detail Modal */}
      {detailProperty && (
        <DetailDialog
          comparableSales={comparableSales}
          isSaved={savedIds.includes(detailProperty.id)}
          onClose={() => setDetailId(null)}
          onSave={() => toggleSave(detailProperty.id)}
          onOpenSource={(source, field) =>
            setSourceSelection({ source, field, property: detailProperty })
          }
          property={detailProperty}
        />
      )}

      {sourceSelection && (
        <SourceDetailsDialog
          onClose={() => setSourceSelection(null)}
          selection={sourceSelection}
        />
      )}

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark">
            <Icon name="house" size={18} />
          </span>
          <span>
            haven<span className="brand-dot">.</span>
          </span>
        </a>
        <p>Smarter property discovery for Aotearoa</p>
      </footer>
    </div>
  );
}