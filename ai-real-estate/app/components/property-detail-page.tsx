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
  Heart,
  History,
  LandPlot,
  Maximize2,
  TrendingUp,
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
import type { Property } from "../../lib/property-types";
import {
  commuteStorageKey,
  readSavedLocations,
  type SavedLocation,
} from "../../lib/saved-locations";

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
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
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
    });
    return () => {
      active = false;
    };
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

  const avmChartPoints = useMemo(() => {
    const pts = property.avmHistory ?? [];
    if (pts.length === 0) return [];
    return pts.slice(-12);
  }, [property.avmHistory]);

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
                      Automated valuation estimates, Council rating split, and verified property timeline.
                    </p>
                  </div>
                </div>

                {/* Valuation Summary Cards */}
                <div className="valuation-cards-grid">
                  <Card className="valuation-summary-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardDescription>OneRoof Estimate (AVM)</CardDescription>
                        {property.estimateConfidence && (
                          <Badge variant="secondary">
                            {property.estimateConfidence} confidence
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-2xl">
                        {formatMoney(property.estimateMedian ?? property.price)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {property.estimateLow && property.estimateHigh ? (
                        <div className="valuation-range-box">
                          <div className="valuation-range-labels">
                            <span>Low: {formatMoney(property.estimateLow)}</span>
                            <span>High: {formatMoney(property.estimateHigh)}</span>
                          </div>
                          <div className="valuation-range-track">
                            <div className="valuation-range-fill" />
                            <div className="valuation-range-Dot" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Current market indication based on listing & public records.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="valuation-summary-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardDescription>
                          Council Capital Value (RV)
                        </CardDescription>
                        {property.rateableValueChange && (
                          <Badge variant="outline">
                            {property.rateableValueChange}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-2xl">
                        {property.capitalValue
                          ? formatMoney(property.capitalValue)
                          : "Not published"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {property.landValue && property.improvementValue ? (
                        <div className="rv-split-box">
                          <div className="rv-split-labels">
                            <span>
                              Land: <strong>{formatMoney(property.landValue)}</strong>
                            </span>
                            <span>
                              Improvements:{" "}
                              <strong>
                                {formatMoney(property.improvementValue)}
                              </strong>
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

                {/* AVM Trend Bars if scraped */}
                {avmChartPoints.length > 1 && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="size-4 text-primary" />
                            Estimated value trajectory
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Recent OneRoof automated valuation movement
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="avm-spark-bars">
                        {(() => {
                          const values = avmChartPoints.map((p) => p.value);
                          const minVal = Math.min(...values) * 0.92;
                          const maxVal = Math.max(...values) * 1.02;
                          const span = Math.max(1, maxVal - minVal);
                          return avmChartPoints.map((pt) => {
                            const heightPct = Math.round(
                              ((pt.value - minVal) / span) * 100,
                            );
                            return (
                              <div
                                className="avm-spark-col"
                                key={pt.date}
                                title={`${formatDateLabel(pt.date)}: ${formatMoney(pt.value)}`}
                              >
                                <div className="avm-spark-bar-wrap">
                                  <div
                                    className="avm-spark-bar"
                                    style={{
                                      height: `${Math.max(18, heightPct)}%`,
                                    }}
                                  />
                                </div>
                                <span className="avm-spark-date">
                                  {pt.date.slice(0, 7)}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Two-column or stacked History Cards: Past Sales & Valuation Records + Timeline */}
                <div className="market-history-columns mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="size-4 text-primary" />
                        Valuations & Past Sales
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Verified sales and official valuation assessments
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pastSalesList.map((sale, i) => (
                        <div
                          className="history-record-row"
                          key={`sale-${sale.date}-${i}`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <strong>{formatMoney(sale.price)}</strong>
                              <Badge variant="default">Sold</Badge>
                            </div>
                            <span className="history-record-meta">
                              {formatDateLabel(sale.date)}
                              {sale.saleType ? ` · ${sale.saleType}` : ""}
                            </span>
                          </div>
                        </div>
                      ))}

                      {valuationRecords.map((rec, i) => {
                        const val = rec.value || rec.capitalValue || rec.medianEstimate;
                        if (!val) return null;
                        return (
                          <div
                            className="history-record-row"
                            key={`val-${rec.date}-${i}`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <strong>{formatMoney(val)}</strong>
                                <Badge variant="secondary">{rec.source}</Badge>
                              </div>
                              <span className="history-record-meta">
                                {formatDateLabel(rec.date)}
                                {rec.landValue
                                  ? ` · Land ${formatMoney(rec.landValue)}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <History className="size-4 text-primary" />
                        Property history timeline
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Chronological events recorded for this property
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {property.propertyHistory &&
                      property.propertyHistory.length > 0 ? (
                        <ol className="property-timeline-list">
                          {property.propertyHistory.map((ev, idx) => (
                            <li
                              className="property-timeline-item"
                              key={`${ev.date}-${ev.label}-${idx}`}
                            >
                              <div className="property-timeline-dot" />
                              <div className="property-timeline-content">
                                <div className="property-timeline-head">
                                  <strong>{ev.label}</strong>
                                  {ev.value && (
                                    <Badge variant="outline">
                                      {typeof ev.value === "number"
                                        ? formatMoney(ev.value)
                                        : ev.value}
                                    </Badge>
                                  )}
                                </div>
                                <span className="property-timeline-meta">
                                  {[formatDateLabel(ev.date), ev.detail]
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
                </div>
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
