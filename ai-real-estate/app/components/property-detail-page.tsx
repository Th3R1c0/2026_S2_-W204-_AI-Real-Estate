"use client";

import Link from "next/link";
import {
  Bath,
  Bed,
  Building2,
  Calendar,
  Car,
  ChevronDown,
  ChevronUp,
  FileText,
  Hammer,
  Heart,
  History,
  LandPlot,
  Maximize2,
  Receipt,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { propertyPhotos } from "@/lib/property-photos";
import PropertyGallery from "./property-gallery";
import SiteHeader from "./site-header";
import {
  SourceCitations,
  SourceDetailsDialog,
  type SourceSelection,
} from "./property-sources";
import MortgageCalculator from "./mortgage-calculator";
import PropertyNotes from "./property-notes";
import PropertyLocationMap from "./property-location-map";
import { useAccountWorkspace } from "./account-workspace-provider";
import { generateValuationHistory } from "../../lib/property-engine";
import type {
  Property,
  PropertyHistoryEvent,
} from "../../lib/property-types";
import {
  commuteStorageKey,
  readSavedLocations,
  type SavedLocation,
} from "../../lib/saved-locations";

const VALUATION_PUBLISHERS = [
  "Homes.co.nz",
  "Trade Me",
  "OneRoof",
  "RealEstate.co.nz",
] as const;

const AUCKLAND_RATES_LOOKUP_URL =
  "https://www.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html";

const numberFormatter = new Intl.NumberFormat("en-NZ");
const moneyFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value).replace("NZ", "");
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateKey(dateStr: string | undefined): number {
  if (!dateStr) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime())
    ? Number.NEGATIVE_INFINITY
    : parsed.getTime();
}

function isCouncilSource(source: string | undefined): boolean {
  if (!source) return false;
  return /council|rating valuation|\bq?rv\b/i.test(source);
}

type EstimateRow = { source: string; url?: string; low?: number; medium: number; high?: number };

function toEventKey(ev: { date: string; value?: string | number }): string {
  const numeric = typeof ev.value === "number" ? ev.value : null;
  return `${ev.date ?? ""}|${numeric ?? ev.value ?? ""}`;
}

function isDuplicateCouncilEvent(
  ev: PropertyHistoryEvent,
  councilRecords: { date: string; capitalValue?: number }[],
): boolean {
  const looksCouncil =
    ev.type === "cv" || /\brev\b|rating valuation|capital value/i.test(ev.label ?? "");
  if (!looksCouncil) return false;
  return councilRecords.some(
    (rec) => rec.date === ev.date && rec.capitalValue === ev.value,
  );
}

type UnifiedEvent = {
  key: string;
  date: string;
  /** Estimated values are lower-weight information and are rendered in italics. */
  estimate: boolean;
  label: string;
  value?: string;
  detail?: string;
  source?: string;
  url?: string;
};

export default function PropertyDetailPage({
  property,
}: {
  property: Property;
  comparableSales?: Property[];
}) {
  const account = useAccountWorkspace();
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<SavedLocation[]>([]);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const savedIdsRef = useRef<string[]>([]);
  const destinationsRef = useRef<SavedLocation[]>([]);

  useEffect(() => {
    if (account && account.status !== "signedIn" && account.status !== "guest")
      return;
    if (account?.status === "signedIn") {
      savedIdsRef.current = account.workspace.savedPropertyIds;
      destinationsRef.current = account.workspace.destinations;
    } else {
      destinationsRef.current = readSavedLocations();
      try {
        const parsed: unknown = JSON.parse(
          localStorage.getItem("haven_saved_property_ids") ?? "[]",
        );
        savedIdsRef.current = Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        savedIdsRef.current = [];
      }
    }
    setSavedIds(savedIdsRef.current);
    setDestinations(destinationsRef.current);
    // Identity changes hydrate once; workspace writes must not reset current edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.status, account?.user?.userId]);

  function persistDestinations(update: React.SetStateAction<SavedLocation[]>) {
    const next =
      typeof update === "function" ? update(destinationsRef.current) : update;
    destinationsRef.current = next;
    setDestinations(next);
    if (account?.status === "signedIn") void account.save("destinations", next);
    else if (!account || account.status === "guest") {
      try {
        localStorage.setItem(commuteStorageKey, JSON.stringify(next));
      } catch {}
    }
  }

  const isSaved = savedIds.includes(property.id);

  function toggleSave() {
    const current = savedIdsRef.current;
    const next = current.includes(property.id)
      ? current.filter((id) => id !== property.id)
      : [...current, property.id];
    savedIdsRef.current = next;
    setSavedIds(next);
    if (account?.status === "signedIn") {
      void account.save("savedPropertyIds", next);
    } else {
      try {
        localStorage.setItem("haven_saved_property_ids", JSON.stringify(next));
      } catch {}
    }
  }

  const fallbackHistory = useMemo(
    () => generateValuationHistory(property),
    [property],
  );

  const valuationRecords = useMemo(() => {
    if (property.valuationHistory && property.valuationHistory.length > 0) {
      return property.valuationHistory;
    }
    return fallbackHistory.valuationHistory.map((item) => ({
      source: item.source,
      date: item.date,
      value: item.value,
      capitalValue: item.value,
      landValue: undefined as number | undefined,
      medianEstimate: undefined as number | undefined,
    }));
  }, [property.valuationHistory, fallbackHistory.valuationHistory]);

  const pastSalesList = useMemo(() => {
    if (property.pastSales && property.pastSales.length > 0) {
      return property.pastSales;
    }
    return fallbackHistory.pastSales.map((s) => ({
      date: s.date,
      price: s.price,
      source: s.source,
      saleType: s.saleType,
    }));
  }, [property.pastSales, fallbackHistory.pastSales]);

  const descriptionParagraphs = useMemo(() => {
    if (!property.summary) return [];
    return property.summary
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [property.summary]);

  const isLongDescription =
    (property.summary?.length ?? 0) > 280 || descriptionParagraphs.length > 2;

  const landSharePct = useMemo(() => {
    if (!property.landValue || !property.capitalValue) return null;
    return Math.min(
      100,
      Math.max(0, Math.round((property.landValue / property.capitalValue) * 100)),
    );
  }, [property.landValue, property.capitalValue]);

  /**
   * One row per publisher, using the most recent automated valuation each
   * source has published. Sources that disagree are kept side by side rather
   * than averaged into a single number.
   */
  const estimateRows = useMemo<EstimateRow[]>(() => {
    const candidates: EstimateRow[] = (
      property.valuationEstimates ??
      (property.estimateMedian || (property.estimateLow && property.estimateHigh)
        ? [
            {
              source: "OneRoof",
              low: property.estimateLow,
              medium: property.estimateMedian ?? property.estimateLow!,
              high: property.estimateHigh,
            },
          ]
        : [])
    )
      .filter((row) => row.medium || row.low || row.high)
      .map((row) => ({
        ...row,
        medium: row.medium || row.low || row.high || 0,
      }));

    const sourceUrls = new Map<string, string>();
    for (const src of property.sources ?? []) {
      for (const publisher of VALUATION_PUBLISHERS) {
        if (src.publisher?.includes(publisher)) sourceUrls.set(publisher, src.url);
      }
    }

    return VALUATION_PUBLISHERS.map((publisher) =>
      candidates.find((row) => (row.source ?? "").includes(publisher)),
    )
      .filter((row): row is EstimateRow => Boolean(row))
      .map((row) => ({ ...row, url: row.url ?? sourceUrls.get(row.source) }));
  }, [property.valuationEstimates, property.estimateLow, property.estimateMedian, property.estimateHigh, property.sources]);

  const estimateRange = useMemo(() => {
    const explicitLows = estimateRows.map((r) => r.low).filter((v): v is number => Boolean(v));
    const explicitHighs = estimateRows.map((r) => r.high).filter((v): v is number => Boolean(v));
    const lows = explicitLows.length
      ? explicitLows
      : estimateRows.map((r) => Math.round(r.medium * 0.92));
    const highs = explicitHighs.length
      ? explicitHighs
      : estimateRows.map((r) => Math.round(r.medium * 1.08));
    if (!lows.length || !highs.length) return null;
    const low = Math.min(...lows);
    const high = Math.max(...highs);
    const medium = Math.round(
      estimateRows.reduce((sum, r) => sum + r.medium, 0) / estimateRows.length,
    );
    return { low, medium, high };
  }, [estimateRows]);

  const capitalValueRecords = useMemo(() => {
    const fromHistory = (property.valuationHistory ?? []).filter(
      (rec) =>
        rec.capitalValue !== undefined ||
        rec.landValue !== undefined ||
        rec.improvementValue !== undefined,
    );
    const records = fromHistory.slice().sort((a, b) => dateKey(b.date) - dateKey(a.date));
    if (
      !!property.capitalValue &&
      !records.some((rec) => rec.capitalValue === property.capitalValue)
    ) {
      records.unshift({
        date: property.valuationDate ?? "",
        value: property.capitalValue,
        capitalValue: property.capitalValue,
        source: "Auckland Council rating valuation",
        kind: "rv",
        landValue: property.landValue,
        improvementValue: property.improvementValue,
      });
    }
    return records;
  }, [property.valuationHistory, property.capitalValue, property.landValue, property.improvementValue, property.valuationDate]);

  const latestCv = capitalValueRecords[0];
  const latestCapitalValue = latestCv?.capitalValue ?? property.capitalValue;
  const latestLandValue = latestCv?.landValue ?? property.landValue;
  const latestImprovementValue =
    latestCv?.improvementValue ?? property.improvementValue;

  /** One chronological list of sales, council valuations and (italic) estimates. */
  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const events: UnifiedEvent[] = [];
    // The same sale / reassessment / estimate is often recorded in more than
    // one source array; keep only the richest version of each.
    const seen = new Set<string>();
    const push = (ev: UnifiedEvent, key: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      events.push(ev);
    };
    const dateAndValue = (date: string, value?: number) =>
      `${date.slice(0, 10)}|${value ?? ""}`;

    for (const sale of pastSalesList) {
      push(
        {
          key: `sale-${sale.date}-${sale.price}`,
          date: sale.date,
          estimate: false,
          label: "Sold",
          value: formatMoney(sale.price),
          detail: sale.saleType,
          source: sale.source,
        },
        dateAndValue(sale.date, sale.price),
      );
    }

    for (const rec of property.valuationHistory ?? []) {
      if (isCouncilSource(rec.source)) continue;
      const value = rec.medianEstimate ?? rec.value;
      if (!value) continue;
      const range =
        rec.lowEstimate && rec.highEstimate
          ? `Range ${formatMoney(rec.lowEstimate)} – ${formatMoney(rec.highEstimate)}`
          : undefined;
      push(
        {
          key: `avm-${rec.date}-${rec.source}`,
          date: rec.date,
          estimate: true,
          label: "Estimated value",
          value: formatMoney(value),
          detail: range,
          source: rec.source,
        },
        `${dateAndValue(rec.date)}|${rec.source.replace(/\s*Estimate$/i, "")}`,
      );
    }

    // propertyHistory often repeats the council reassessments found in
    // valuationHistory, so skip any event whose date and value already match.
    const duplicateEvents = new Set(
      (property.propertyHistory ?? [])
        .filter((ev) => !isDuplicateCouncilEvent(ev, []))
        .map(toEventKey),
    );

    for (const rec of capitalValueRecords) {
      const cv = rec.capitalValue;
      if (!cv) continue;
      if (duplicateEvents.has(toEventKey({ date: rec.date, value: cv }))) continue;
      const split = [
        rec.landValue !== undefined ? `Land ${formatMoney(rec.landValue)}` : null,
        rec.improvementValue !== undefined
          ? `Improvements ${formatMoney(rec.improvementValue)}`
          : null,
        rec.changePercent !== undefined
          ? `${rec.changePercent > 0 ? "+" : ""}${rec.changePercent}% vs previous CV`
          : null,
      ].filter(Boolean);
      push(
        {
          key: `cv-${rec.date}-${cv}`,
          date: rec.date,
          estimate: false,
          label: "Auckland Council capital value (RV)",
          value: formatMoney(cv),
          detail: split.length ? split.join(" · ") : undefined,
          source: isCouncilSource(rec.source) ? "Auckland Council" : rec.source,
        },
        dateAndValue(rec.date, cv),
      );
    }

    for (const ev of property.propertyHistory ?? []) {
      // These are already rendered above with their source and CV split.
      if (isDuplicateCouncilEvent(ev, capitalValueRecords)) continue;
      if (ev.type === "sale") continue;
      push(
        {
          key: `event-${ev.date}-${ev.label}`,
          date: ev.date,
          estimate: false,
          // The value is shown on its own, so drop it from the label suffix.
          label: ev.label.split(":")[0],
          value:
            typeof ev.value === "number" ? formatMoney(ev.value) : ev.value,
          detail: ev.detail,
        },
        dateAndValue(ev.date, typeof ev.value === "number" ? ev.value : undefined),
      );
    }

    return events
      .filter((ev) => ev.date)
      .filter((ev) => ev.date.length > 4)
      .sort((a, b) => dateKey(b.date) - dateKey(a.date));
  }, [pastSalesList, property.valuationHistory, property.propertyHistory, capitalValueRecords, property.valuationDate]);

  const rates = property.rates;
  const ratesDetail = (
    <a
      href={rates?.url ?? AUCKLAND_RATES_LOOKUP_URL}
      rel="noreferrer"
      target="_blank"
    >
      Check this address on Auckland Council ↗
    </a>
  );

  return (
    <div className="site-shell property-page-shell">
      <SiteHeader />
      <main className="property-page-main" aria-label="Property details">
        <Link className="back-link" href="/">
          ← All homes
        </Link>

        {/* Top Breadcrumb & Title Header */}
        <div className="property-page-header">
          <div>
            <p className="property-type-line">
              {[property.propertyType, property.ownershipType]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1>
              {property.address}
              <SourceCitations
                property={property}
                field="address"
                onOpen={(selectedSource, field) =>
                  setSource({ source: selectedSource, field, property })
                }
              />
            </h1>
            <p className="property-page-suburb">
              {property.suburb}, {property.city}
            </p>
          </div>

          <div className="property-page-price-block">
            <span className="property-page-price-label">
              {property.saleMethod || "Indicative Value"}
            </span>
            <strong className="property-page-price-value">
              {formatMoney(property.price)}
            </strong>
            {property.capitalValue ? (
              <span className="property-page-cv">
                CV: {formatMoney(property.capitalValue)}
              </span>
            ) : null}
          </div>
        </div>

        <PropertyGallery
          address={property.address}
          photos={propertyPhotos(property)}
        />

        {/* Two-Column Airbnb Detail Layout */}
        <div className="property-page-columns">
          <div className="property-page-left">
            {/* Key Specs Strip with Icons */}
            <div className="property-key-specs">
              <div className="key-spec-item">
                <div className="key-spec-value-row">
                  <Bed className="key-spec-icon" aria-hidden="true" />
                  <strong>{property.bedrooms}</strong>
                </div>
                <span>
                  Bedrooms
                  <SourceCitations
                    property={property}
                    field="bedrooms"
                    onOpen={(selectedSource, field) =>
                      setSource({ source: selectedSource, field, property })
                    }
                  />
                </span>
              </div>

              <div className="key-spec-item">
                <div className="key-spec-value-row">
                  <Bath className="key-spec-icon" aria-hidden="true" />
                  <strong>{property.bathrooms}</strong>
                </div>
                <span>
                  Bathrooms
                  <SourceCitations
                    property={property}
                    field="bathrooms"
                    onOpen={(selectedSource, field) =>
                      setSource({ source: selectedSource, field, property })
                    }
                  />
                </span>
              </div>

              {property.parkingSpaces ? (
                <div className="key-spec-item">
                  <div className="key-spec-value-row">
                    <Car className="key-spec-icon" aria-hidden="true" />
                    <strong>{property.parkingSpaces}</strong>
                  </div>
                  <span>Parking</span>
                </div>
              ) : null}

              {property.floorArea > 0 ? (
                <div className="key-spec-item">
                  <div className="key-spec-value-row">
                    <Maximize2 className="key-spec-icon" aria-hidden="true" />
                    <strong>
                      {numberFormatter.format(property.floorArea)} m²
                    </strong>
                  </div>
                  <span>Floor area</span>
                </div>
              ) : null}

              <div className="key-spec-item">
                <div className="key-spec-value-row">
                  <LandPlot className="key-spec-icon" aria-hidden="true" />
                  <strong>{numberFormatter.format(property.landArea)} m²</strong>
                </div>
                <span>
                  Land area
                  <SourceCitations
                    property={property}
                    field="landArea"
                    onOpen={(selectedSource, field) =>
                      setSource({ source: selectedSource, field, property })
                    }
                  />
                </span>
              </div>

              <div className="key-spec-item">
                <div className="key-spec-value-row">
                  <Calendar className="key-spec-icon" aria-hidden="true" />
                  <strong>{property.yearBuilt || "Unknown"}</strong>
                </div>
                <span>Year built</span>
              </div>
            </div>

            <div className="property-page-tab-body">
              <div className="overview-panel">
                {/* Scraped Property Description with collapsible Read more */}
                {property.summary && (
                  <section
                    aria-label="About this property"
                    className="property-description-section"
                  >
                    {property.teaser && (
                      <h2 className="property-description-teaser">
                        {property.teaser}
                      </h2>
                    )}
                    <div
                      className={`property-description-body ${
                        isLongDescription && !descriptionExpanded
                          ? "is-clamped"
                          : ""
                      }`}
                    >
                      {descriptionParagraphs.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                    {isLongDescription && (
                      <Button
                        className="description-read-more-btn"
                        onClick={() =>
                          setDescriptionExpanded((current) => !current)
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {descriptionExpanded ? (
                          <>
                            Show less <ChevronUp className="size-4" />
                          </>
                        ) : (
                          <>
                            Read more <ChevronDown className="size-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </section>
                )}

                {/* Real Scraped Property Attributes Grid */}
                <div className="property-attributes-grid">
                  <div className="attr-card">
                    <span>Property Type</span>
                    <strong>{property.propertyType}</strong>
                  </div>
                  {(property.ownershipType || property.estateDescription) && (
                    <div className="attr-card">
                      <span>Title / Ownership</span>
                      <strong>
                        {property.estateDescription || property.ownershipType}
                      </strong>
                    </div>
                  )}
                  {property.titleNumber && (
                    <div className="attr-card">
                      <span>Title Number</span>
                      <strong>{property.titleNumber}</strong>
                    </div>
                  )}
                  {property.capitalValue ? (
                    <div className="attr-card">
                      <span>Council Capital Value (CV)</span>
                      <strong>{formatMoney(property.capitalValue)}</strong>
                    </div>
                  ) : null}
                  {property.estimateMedian ? (
                    <div className="attr-card">
                      <span>OneRoof Estimate</span>
                      <strong>{formatMoney(property.estimateMedian)}</strong>
                    </div>
                  ) : null}
                  {property.estimatedWeeklyRent ? (
                    <div className="attr-card">
                      <span>Estimated Weekly Rent</span>
                      <strong>
                        {formatMoney(property.estimatedWeeklyRent)} / week
                      </strong>
                    </div>
                  ) : null}
                  {property.unitaryPlanZone && (
                    <div className="attr-card">
                      <span>Unitary Plan Zone</span>
                      <strong>{property.unitaryPlanZone}</strong>
                    </div>
                  )}
                  {property.construction && (
                    <div className="attr-card">
                      <span>Construction</span>
                      <strong>{property.construction}</strong>
                    </div>
                  )}
                  {property.contour && (
                    <div className="attr-card">
                      <span>Land Contour</span>
                      <strong>{property.contour}</strong>
                    </div>
                  )}
                  {property.legalDescription && (
                    <div className="attr-card">
                      <span>Legal Description</span>
                      <strong>{property.legalDescription}</strong>
                    </div>
                  )}
                </div>

                {/* Unified 3-Mode Google Map Section (Schools, Commute, Flood assessment) */}
                <section
                  aria-labelledby="neighbourhood-heading"
                  className="property-map-block"
                >
                  <div className="property-map-header">
                    <div>
                      <h2 id="neighbourhood-heading">The neighbourhood</h2>
                      <p className="property-section-subtitle">
                        Explore school catchments, live commute routes, and Council flood overlays in one interactive map.
                      </p>
                    </div>
                  </div>
                  <PropertyLocationMap
                    address={property.address}
                    floodHazards={property.floodHazards}
                    latitude={property.latitude}
                    locations={destinations}
                    longitude={property.longitude}
                    schoolDataSynced={property.schoolDataSynced}
                    schoolZones={property.schoolZones ?? []}
                    schools={property.nearbySchools ?? []}
                    setLocations={persistDestinations}
                  />
                </section>
              </div>

              {/* Non-Collapsible Market History & Valuations Section */}
              <section
                aria-labelledby="market-history-heading"
                className="property-section-block"
              >
                <div className="property-section-header">
                  <div>
                    <h2 id="market-history-heading">
                      Market history & valuations
                    </h2>
                    <p className="property-section-subtitle">
                      Estimates from multiple sources, Auckland Council capital
                      value and rates, and a single chronological history.
                    </p>
                  </div>
                </div>

                {/* Valuation Summary Cards */}
                <div className="valuation-cards-grid">
                  <Card className="valuation-summary-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardDescription>
                          Valuation estimate range
                          {estimateRows.length > 1
                            ? ` (${estimateRows.length} sources)`
                            : ""}
                        </CardDescription>
                        {property.estimateConfidence && (
                          <Badge variant="secondary">
                            {property.estimateConfidence} confidence
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-2xl">
                        {estimateRange
                          ? formatMoney(estimateRange.medium)
                          : "Not published"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {estimateRange ? (
                        <div className="valuation-range-box">
                          <div className="valuation-range-labels">
                            <span>Low: {formatMoney(estimateRange.low)}</span>
                            <span>Mid: {formatMoney(estimateRange.medium)}</span>
                            <span>High: {formatMoney(estimateRange.high)}</span>
                          </div>
                          <div className="valuation-range-track">
                            <div className="valuation-range-fill" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Low, mid and high estimates by source are compared in
                            the table below.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No automated valuation estimate has been published for
                          this property.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="valuation-summary-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardDescription>
                          Auckland Council capital value (CV)
                        </CardDescription>
                        {property.rateableValueChange && (
                          <Badge variant="outline">
                            {property.rateableValueChange}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-2xl">
                        {latestCapitalValue
                          ? formatMoney(latestCapitalValue)
                          : "Not published"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestLandValue && latestImprovementValue ? (
                        <div className="rv-split-box">
                          <div className="rv-split-labels">
                            <span>
                              Land value:{" "}
                              <strong>{formatMoney(latestLandValue)}</strong>
                            </span>
                            <span>
                              Improvement value:{" "}
                              <strong>{formatMoney(latestImprovementValue)}</strong>
                            </span>
                          </div>
                          {landSharePct !== null && (
                            <div
                              aria-label="Land vs Improvements ratio"
                              className="rv-split-bar"
                            >
                              <div
                                className="rv-split-land"
                                style={{ width: `${landSharePct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {property.valuationDate
                            ? `Assessed ${formatDateLabel(property.valuationDate)}`
                            : "Auckland Council rating valuation."}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Multi-source valuation estimate comparison */}
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      Valuation estimates by source
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Low, mid and high automated estimates published by each
                      website for this address. Sources can disagree, so they are
                      shown side by side rather than combined into one figure.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {estimateRows.length > 0 || pastSalesList.length > 0 || capitalValueRecords.length > 0 || unifiedEvents.length > 0 ? (
                      <div className="valuation-table-wrap">
                        <table className="valuation-table">
                          <thead>
                            <tr>
                              <th scope="col">Source</th>
                              <th scope="col">Low</th>
                              <th scope="col">Mid</th>
                              <th scope="col">High</th>
                              <th scope="col">As at</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estimateRows.length > 0 ? (
                              estimateRows.map((row) => (
                                <tr key={`estimate-${row.source}`}>
                                  <th scope="row">
                                    {row.url ? (
                                      <a
                                        href={row.url}
                                        rel="noreferrer"
                                        target="_blank"
                                      >
                                        {row.source} ↗
                                      </a>
                                    ) : (
                                      row.source
                                    )}
                                  </th>
                                  <td>
                                    {row.low !== undefined
                                      ? formatMoney(row.low)
                                      : row.medium
                                        ? formatMoney(Math.round(row.medium * 0.92))
                                        : "—"}
                                  </td>
                                  <td>
                                    <strong>{formatMoney(row.medium)}</strong>
                                  </td>
                                  <td>
                                    {row.high !== undefined
                                      ? formatMoney(row.high)
                                      : row.medium
                                        ? formatMoney(Math.round(row.medium * 1.08))
                                        : "—"}
                                  </td>
                                  <td>
                                    {formatDateLabel(
                                      property.valuationHistory?.find((rec) =>
                                        rec.source.includes(row.source),
                                      )?.date ??
                                        property.valuationHistory?.find(
                                          (rec) => !isCouncilSource(rec.source),
                                        )?.date ??
                                        "",
                                    ) || "—"}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5}>
                                  No published automated valuation estimates for
                                  this property.
                                </td>
                              </tr>
                            )}
                            {pastSalesList.length > 0 ? (
                              <tr>
                                <th scope="row">Last sale (recorded)</th>
                                <td colSpan={2}>
                                  <strong>
                                    {formatMoney(pastSalesList[0].price)}
                                  </strong>
                                </td>
                                <td colSpan={2}>
                                  {formatDateLabel(pastSalesList[0].date)}
                                </td>
                              </tr>
                            ) : null}
                            {capitalValueRecords.length > 0 &&
                            latestCapitalValue ? (
                              <tr>
                                <th scope="row">
                                  <a
                                    href={
                                      AUCKLAND_RATES_LOOKUP_URL
                                    }
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    Auckland Council capital value ↗
                                  </a>
                                </th>
                                <td colSpan={2}>
                                  <strong>
                                    {formatMoney(latestCapitalValue)}
                                  </strong>
                                  <span className="valuation-table-note">
                                    Land {latestLandValue ? formatMoney(latestLandValue) : "—"} ·
                                    Improvements{" "}
                                    {latestImprovementValue
                                      ? formatMoney(latestImprovementValue)
                                      : "—"}
                                  </span>
                                </td>
                                <td colSpan={2}>
                                  {formatDateLabel(latestCv?.date ?? "") || "—"}
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No valuations or sales recorded for this property.
                      </p>
                    )}
                    <p className="valuation-table-footnote">
                      Estimates are website automated valuations, not asking
                      prices or confirmed sale prices. Capital value is set by
                      Auckland Council for rating purposes only.
                    </p>
                  </CardContent>
                </Card>

                <div className="valuation-cards-grid mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>
                        Auckland Council rates
                        {rates?.periodLabel ? ` · ${rates.periodLabel}` : ""}
                      </CardDescription>
                      <CardTitle className="text-2xl">
                        {rates
                          ? `${formatMoney(rates.amount)}${rates.period === "quarter" ? " / quarter" : " / year"}`
                          : "Not published"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {rates ? (
                        <div className="text-xs text-muted-foreground">
                          {rates.period === "quarter" ? (
                            <p className="m-0">
                              Approximately{" "}
                              <strong>
                                {formatMoney(Math.round(rates.amount * 4))}
                              </strong>{" "}
                              per year including GST.
                            </p>
                          ) : (
                            <p className="m-0">
                              Approximately{" "}
                              <strong>
                                {formatMoney(Math.round(rates.amount / 4))}
                              </strong>{" "}
                              per quarter including GST.
                            </p>
                          )}
                          <p className="m-0 mt-2">{ratesDetail}</p>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          <p className="m-0 flex items-center gap-2">
                            <Receipt className="size-3.5" />
                            No current rates figure has been published for this
                            address. Rates follow the Council&apos;s rating
                            valuation shown alongside.
                          </p>
                          <p className="m-0 mt-2">{ratesDetail}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>
                        Auckland Council capital value
                      </CardDescription>
                      <CardTitle className="text-2xl">
                        {latestCapitalValue
                          ? formatMoney(latestCapitalValue)
                          : "Not published"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="cv-breakdown">
                        <div>
                          <dt>
                            <LandPlot className="size-3.5" aria-hidden="true" />
                            Land value
                          </dt>
                          <dd>
                            {latestLandValue
                              ? formatMoney(latestLandValue)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            <Hammer className="size-3.5" aria-hidden="true" />
                            Improvement value
                          </dt>
                          <dd>
                            {latestImprovementValue
                              ? formatMoney(latestImprovementValue)
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      <p className="valuation-table-footnote">
                        {latestCv?.date
                          ? `Assessed ${formatDateLabel(latestCv.date)}. `
                          : ""}
                        Rating valuation by Auckland Council; not a market
                        appraisal.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* One chronological history: sales, council valuations and (italic) estimates */}
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <History className="size-4 text-primary" />
                      Property history
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Sales, council valuations and estimates in one timeline.
                      Estimates are shown in italics as lower-weight information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {unifiedEvents.length > 0 ? (
                      <ol className="property-timeline-list">
                        {unifiedEvents.map((ev) => (
                          <li
                            className={`property-timeline-item${ev.estimate ? " is-estimate" : ""}`}
                            key={ev.key}
                          >
                            <div className="property-timeline-dot" />
                            <div className="property-timeline-content">
                              <div className="property-timeline-head">
                                <strong>{ev.label}</strong>
                                {ev.value && (
                                  <Badge variant="outline">{ev.value}</Badge>
                                )}
                              </div>
                              <span className="property-timeline-meta">
                                {[
                                  formatDateLabel(ev.date),
                                  ev.source,
                                  ev.detail,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5" />
                          <span>
                            {property.yearBuilt
                              ? `Built in ${property.yearBuilt}`
                              : "Public title & rating history synced"}
                          </span>
                        </div>
                        {property.legalDescription && (
                          <p className="m-0">
                            Legal description: {property.legalDescription}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
              {/* Non-Collapsible Mortgage Calculator at the Bottom */}
              <section
                aria-labelledby="mortgage-calculator-heading"
                className="property-section-block"
                id="calculator"
              >
                <div className="mortgage-panel">
                  <MortgageCalculator defaultPrice={property.price} />
                </div>
              </section>

              <div className="notes-panel" id="property-notes">
                <PropertyNotes
                  propertyId={property.id}
                  propertyTitle={property.address}
                />
              </div>
            </div>
          </div>

          {/* Right Sticky Sidebar: Open Homes, Agent & Enquiry */}
          <aside className="property-page-sidebar">
            <div className="property-sidebar-card">
              <div className="sidebar-price-row">
                <div>
                  <span className="eyebrow">
                    {property.saleMethod || "Indicative Value"}
                  </span>
                  <strong className="sidebar-price">
                    {formatMoney(property.price)}
                  </strong>
                </div>
                {property.estimatedWeeklyRent ? (
                  <div className="sidebar-rent-pill">
                    Est. rent {formatMoney(property.estimatedWeeklyRent)}/wk
                  </div>
                ) : null}
              </div>

              {/* Open Homes Box */}
              <div className="sidebar-open-homes">
                <h4>Open homes</h4>
                {property.openHomes && property.openHomes.length > 0 ? (
                  <ul className="open-home-list">
                    {property.openHomes.map((oh, idx) => (
                      <li key={`${oh.date}-${oh.startTime}-${idx}`}>
                        <span className="open-home-dot" />
                        <strong>{oh.label}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="open-home-empty">
                    Viewing by appointment — contact the listing agent below.
                  </p>
                )}
              </div>

              {/* Listing Agent */}
              <div className="sidebar-agent-box">
                {property.listingAgent ? (
                  <>
                    <h3>{property.listingAgent.name}</h3>
                    <p className="sidebar-agent-source">
                      {property.listingAgent.source}
                    </p>
                    <a
                      className="primary-agent-cta"
                      href={property.listingAgent.contactUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Enquire on {property.listingAgent.source} ↗
                    </a>
                  </>
                ) : (
                  <p>Agent details available on source listing.</p>
                )}
                <Button
                  variant="outline"
                  className="secondary-save-cta"
                  onClick={toggleSave}
                  disabled={
                    account?.status === "loading" || account?.status === "error"
                  }
                  type="button"
                >
                  <Heart data-icon="inline-start" />
                  {isSaved ? "Saved" : "Save home"}
                </Button>
              </div>

              {property.sources && property.sources.length > 0 && (
                <Accordion
                  type="single"
                  collapsible
                  className="sidebar-sources"
                >
                  <AccordionItem value="sources">
                    <AccordionTrigger>Sources</AccordionTrigger>
                    <AccordionContent>
                      <ul>
                        {property.sources.map((src) => (
                          <li key={src.id}>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {src.publisher} ↗
                            </a>
                            <span>{src.reference}</span>
                          </li>
                        ))}
                      </ul>
                      {property.imageSourceUrl && (
                        <a
                          href={property.imageSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Photo source ↗
                        </a>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          </aside>
        </div>
      </main>

      {source && (
        <SourceDetailsDialog
          selection={source}
          onClose={() => setSource(null)}
        />
      )}
    </div>
  );
}
