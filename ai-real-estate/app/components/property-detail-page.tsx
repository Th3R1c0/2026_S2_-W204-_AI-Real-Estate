"use client";
import { Slider } from "@/components/ui/slider";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { propertyPhotos } from "@/lib/property-photos";
import PropertyGallery from "./property-gallery";
import SiteHeader from "./site-header";
import CommutePlanner from "./commute-planner";
import {
  SourceCitations,
  SourceDetailsDialog,
  type SourceSelection,
} from "./property-sources";
import { useEffect, useMemo, useState, useRef } from "react";
import MortgageCalculator from "./mortgage-calculator";
import PropertyNotes from "./property-notes";
import PropertyLocationMap from "./property-location-map";
import { useAccountWorkspace } from "./account-workspace-provider";
import {
  findComparableSales,
  generateValuationHistory,
} from "../../lib/property-engine";
import {
  describeFloodHazards,
  floodHazardDisclaimer,
  floodHazardOptions,
} from "../../lib/flood-hazards";
import type { ComparableSalesResult, Property } from "../../lib/property-types";
import { SCHOOL_NEARBY_RADIUS_METRES } from "../../lib/school-data";
import {
  commuteStorageKey,
  readSavedLocations,
  straightLineDistanceKm,
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

export default function PropertyDetailPage({
  property,
  comparableSales,
}: {
  property: Property;
  comparableSales: Property[];
}) {
  const account = useAccountWorkspace();
  const [research, setResearch] = useState<string[]>([]);
  const [showSchools, setShowSchools] = useState(false);
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<SavedLocation[]>([]);
  const [showSavedLocations, setShowSavedLocations] = useState(true);
  const [nearbySchoolType, setNearbySchoolType] = useState("");
  const [radius, setRadius] = useState(2);
  const [months, setMonths] = useState(6);
  const [postgisComps, setPostgisComps] =
    useState<ComparableSalesResult | null>(null);

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

  const fallbackCompResult = useMemo(
    () =>
      findComparableSales(property, comparableSales, {
        radiusKm: radius,
        months,
        asOf: new Date("2026-09-18T00:00:00Z"),
      }),
    [property, comparableSales, radius, months],
  );

  const compsOpen = research.includes("comps");
  useEffect(() => {
    if (!compsOpen) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      propertyKey: property.id,
      radiusKm: String(radius),
      months: String(months),
    });

    fetch(`/api/comparable-sales?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.comps)) {
          setPostgisComps(data);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [compsOpen, property.id, radius, months]);

  const compResult = postgisComps ?? fallbackCompResult;
  const historyData = useMemo(
    () => generateValuationHistory(property),
    [property],
  );
  const nearbySchoolTypes = Array.from(
    new Set((property.nearbySchools ?? []).map(({ orgType }) => orgType)),
  ).sort((a, b) => a.localeCompare(b));
  const visibleNearbySchools = useMemo(
    () =>
      (property.nearbySchools ?? []).filter(
        (school) => !nearbySchoolType || school.orgType === nearbySchoolType,
      ),
    [property.nearbySchools, nearbySchoolType],
  );
  const mapSchools = useMemo(
    () => (showSchools ? visibleNearbySchools : []),
    [showSchools, visibleNearbySchools],
  );
  const mapLocations = useMemo(
    () => (showSavedLocations ? destinations : []),
    [showSavedLocations, destinations],
  );

  const mappedFloodLabels = useMemo(() => {
    if (!property.floodHazards) return [];
    return floodHazardOptions
      .filter(({ type }) => property.floodHazards?.some((h) => h.type === type))
      .map(({ label }) => label);
  }, [property.floodHazards]);

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
              {[property.propertyType, property.architecturalStyle]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1>
              {property.address}
              <SourceCitations
                property={property}
                field="address"
                onOpen={(source, field) =>
                  setSource({ source, field, property })
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
            {/* Key Specs Strip */}
            <div className="property-key-specs">
              <div className="key-spec-item">
                <strong>{property.bedrooms}</strong>
                <span>
                  Bedrooms
                  <SourceCitations
                    property={property}
                    field="bedrooms"
                    onOpen={(source, field) =>
                      setSource({ source, field, property })
                    }
                  />
                </span>
              </div>
              <div className="key-spec-item">
                <strong>{property.bathrooms}</strong>
                <span>
                  Bathrooms
                  <SourceCitations
                    property={property}
                    field="bathrooms"
                    onOpen={(source, field) =>
                      setSource({ source, field, property })
                    }
                  />
                </span>
              </div>
              {property.parkingSpaces ? (
                <div className="key-spec-item">
                  <strong>{property.parkingSpaces}</strong>
                  <span>Parking</span>
                </div>
              ) : null}
              {property.floorArea > 0 ? (
                <div className="key-spec-item">
                  <strong>
                    {numberFormatter.format(property.floorArea)} m²
                  </strong>
                  <span>Floor area</span>
                </div>
              ) : null}
              <div className="key-spec-item">
                <strong>{numberFormatter.format(property.landArea)} m²</strong>
                <span>
                  Land area
                  <SourceCitations
                    property={property}
                    field="landArea"
                    onOpen={(source, field) =>
                      setSource({ source, field, property })
                    }
                  />
                </span>
              </div>
              <div className="key-spec-item">
                <strong>{property.yearBuilt || "Unknown"}</strong>
                <span>Year built</span>
              </div>
            </div>

            <div className="property-page-tab-body">
              {
                <div className="overview-panel">
                  <div className="property-attributes-grid">
                    <div className="attr-card">
                      <span>Property Type</span>
                      <strong>{property.propertyType}</strong>
                    </div>
                    {property.architecturalStyle && (
                      <div className="attr-card">
                        <span>Architectural Style</span>
                        <strong>{property.architecturalStyle}</strong>
                      </div>
                    )}
                    {property.ownershipType && (
                      <div className="attr-card">
                        <span>Title / Ownership</span>
                        <strong>{property.ownershipType}</strong>
                      </div>
                    )}
                    {property.capitalValue ? (
                      <div className="attr-card">
                        <span>Council Capital Value (CV)</span>
                        <strong>{formatMoney(property.capitalValue)}</strong>
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
                    {property.orientation && (
                      <div className="attr-card">
                        <span>Orientation & Sunlight</span>
                        <strong>
                          {property.orientation} ({property.sunlightHours}{" "}
                          hrs/day)
                        </strong>
                      </div>
                    )}
                  </div>

                  <p className="flood-summary">
                    Council flood mapping:{" "}
                    {property.floodHazards === undefined
                      ? "data not synced"
                      : mappedFloodLabels.length
                        ? mappedFloodLabels.join(", ")
                        : "no mapped intersection"}
                    .
                  </p>
                  <Accordion
                    type="single"
                    collapsible
                    className="flood-provenance"
                  >
                    <AccordionItem value="flood">
                      <AccordionTrigger>About flood mapping</AccordionTrigger>
                      <AccordionContent>
                        <p>
                          {property.floodHazards !== undefined
                            ? describeFloodHazards(property.floodHazards)
                            : "Council data has not been synced for this property yet."}
                        </p>
                        <p className="disclaimer">{floodHazardDisclaimer}</p>
                        {property.floodHazards?.map((hazard) => (
                          <a
                            key={hazard.type}
                            href={hazard.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Council {hazard.type.replaceAll("_", " ")} layer ↗
                          </a>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Map Section */}
                  <div className="property-map-block">
                    <div className="property-map-header">
                      <div>
                        <h2>The neighbourhood</h2>
                      </div>
                      <div className="map-toggles">
                        <label className="saved-location-toggle">
                          <Switch
                            checked={showSavedLocations}
                            onCheckedChange={setShowSavedLocations}
                          />
                          Show saved locations
                        </label>
                        <label className="saved-location-toggle">
                          <Switch
                            checked={showSchools}
                            onCheckedChange={setShowSchools}
                          />
                          Show schools on map
                        </label>
                      </div>
                    </div>
                    <PropertyLocationMap
                      schools={mapSchools}
                      address={property.address}
                      latitude={property.latitude}
                      longitude={property.longitude}
                      locations={mapLocations}
                    />
                    {showSavedLocations && (
                      <ul className="saved-location-distances">
                        {destinations
                          .filter(
                            (loc) =>
                              loc.latitude !== undefined &&
                              loc.longitude !== undefined,
                          )
                          .map((loc) => (
                            <li key={loc.id}>
                              {loc.name || loc.address} ·{" "}
                              {straightLineDistanceKm(
                                property.latitude,
                                property.longitude,
                                loc.latitude!,
                                loc.longitude!,
                              ).toFixed(1)}{" "}
                              km straight-line
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              }

              {showSchools && (
                <div
                  className="family-panel"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  {property.schoolDataSynced ? (
                    <>
                      <p className="disclaimer" role="note">
                        <strong>School-zone matches are approximate.</strong>{" "}
                        Ministry of Education boundaries have limited resolution
                        and alignment accuracy, so results may be inaccurate.
                        Confirm enrolment eligibility with the school or
                        Ministry.
                      </p>
                      <div>
                        <h4
                          style={{ marginBottom: "0.25rem", fontWeight: "600" }}
                        >
                          Nearby schools within{" "}
                          {SCHOOL_NEARBY_RADIUS_METRES / 1000} km
                        </h4>
                        {nearbySchoolTypes.length > 0 && (
                          <label
                            className="field-label"
                            htmlFor="nearby-school-type"
                          >
                            Filter nearby schools by type
                            <NativeSelect
                              id="nearby-school-type"
                              onChange={(event) =>
                                setNearbySchoolType(event.target.value)
                              }
                              value={nearbySchoolType}
                            >
                              <option value="">All school types</option>
                              {nearbySchoolTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                        )}
                        {visibleNearbySchools.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                              marginTop: "0.5rem",
                            }}
                          >
                            {visibleNearbySchools.map((school) => {
                              const matchingZone = property.schoolZones?.find(
                                (zone) => zone.schoolId === school.schoolId,
                              );
                              return (
                                <div
                                  key={school.schoolId}
                                  style={{
                                    padding: "0.5rem 0",
                                    border: "none",
                                    borderRadius: "6px",
                                  }}
                                >
                                  <strong>{school.name}</strong>
                                  <span
                                    style={{
                                      display: "block",
                                      fontSize: "0.85rem",
                                      opacity: 0.8,
                                    }}
                                  >
                                    {school.orgType} ·{" "}
                                    {school.distanceKm.toFixed(2)} km away
                                  </span>
                                  <small
                                    style={{
                                      display: "block",
                                      marginTop: "0.25rem",
                                      opacity: 0.7,
                                    }}
                                  >
                                    {!school.hasEnrolmentZone
                                      ? "No enrolment zone published"
                                      : !school.hasZoneGeometry
                                        ? "Enrolment scheme listed, but zone geometry is unavailable"
                                        : matchingZone
                                          ? "This property is in the mapped school zone"
                                          : "This property is not in the mapped school zone"}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                            {nearbySchoolType
                              ? `No ${nearbySchoolType} schools are mapped within ${SCHOOL_NEARBY_RADIUS_METRES / 1000} km.`
                              : `No schools are mapped within ${SCHOOL_NEARBY_RADIUS_METRES / 1000} km.`}
                          </p>
                        )}
                      </div>
                      <div>
                        <h4
                          style={{ marginBottom: "0.75rem", fontWeight: "600" }}
                        >
                          School zones containing this property
                        </h4>
                        {property.schoolZones?.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                          >
                            {property.schoolZones.map((zone) => (
                              <div
                                key={`${zone.schoolId}-${zone.zoneName ?? zone.zoneType ?? ""}`}
                              >
                                <strong>{zone.schoolName}</strong>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "0.85rem",
                                    opacity: 0.8,
                                  }}
                                >
                                  {[
                                    zone.zoneName &&
                                    zone.zoneName !== zone.schoolName
                                      ? zone.zoneName
                                      : undefined,
                                    zone.zoneType || zone.schoolType,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                            No imported school zone contains this property.
                          </p>
                        )}
                      </div>
                    </>
                  ) : property.schoolZones?.length ? (
                    <div>
                      <h4
                        style={{ marginBottom: "0.75rem", fontWeight: "600" }}
                      >
                        School Catchments
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        {property.schoolZones.map((school, index) => {
                          const name =
                            school.name ?? school.schoolName ?? "School";
                          const type =
                            school.type ??
                            school.schoolType ??
                            school.zoneType ??
                            "";
                          const isInZone = school.isInZone ?? true;
                          return (
                            <div
                              key={`${school.schoolId ?? name}-${index}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0",
                                border: "none",
                                borderRadius: "6px",
                              }}
                            >
                              <div>
                                <strong>{name}</strong>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "0.8rem",
                                    opacity: 0.7,
                                  }}
                                >
                                  {[
                                    type,
                                    school.distanceKm !== undefined
                                      ? `${school.distanceKm} km away`
                                      : undefined,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </div>
                              <span
                                className={`badge ${isInZone ? "badge-success" : "badge-outline"}`}
                                style={{ fontSize: "0.75rem" }}
                              >
                                {isInZone ? "In Zone" : "Out of Zone"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                      Auckland school data has not been imported yet.
                    </p>
                  )}
                </div>
              )}

              <Accordion
                type="multiple"
                value={research}
                onValueChange={setResearch}
                className="property-research"
              >
                <AccordionItem value="comps">
                  <AccordionTrigger>Comparable sales</AccordionTrigger>
                  <AccordionContent>
                    <div className="tool-panel">
                      <div className="tool-heading">
                        <div>
                          <h3>Nearby comparable sales</h3>
                        </div>
                        <div className="average-pill">
                          {compResult.averagePrice
                            ? `${formatMoney(compResult.averagePrice)} average`
                            : "No average"}
                        </div>
                      </div>
                      <div className="range-grid">
                        <label>
                          Search radius <strong>{radius} km</strong>
                          <Slider
                            aria-label="Search radius"
                            min={1}
                            max={10}
                            value={[radius]}
                            onValueChange={([value]) => setRadius(value)}
                          />
                        </label>
                        <label>
                          Sale timeframe <strong>{months} months</strong>
                          <Slider
                            aria-label="Sale timeframe"
                            min={3}
                            max={12}
                            step={3}
                            value={[months]}
                            onValueChange={([value]) => setMonths(value)}
                          />
                        </label>
                      </div>
                      <div className="comp-list">
                        {compResult.comps.length ? (
                          compResult.comps.map(
                            ({ property: comp, distanceKm }) => (
                              <article className="comp-row" key={comp.id}>
                                <div>
                                  <strong>{comp.address}</strong>
                                  <span>
                                    {comp.bedrooms} bed · {comp.floorArea} m² ·{" "}
                                    {distanceKm.toFixed(1)} km away
                                  </span>
                                </div>
                                <div>
                                  <strong>{formatMoney(comp.price)}</strong>
                                  {comp.soldDate && (
                                    <span>
                                      Sold{" "}
                                      {new Date(
                                        comp.soldDate,
                                      ).toLocaleDateString("en-NZ", {
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </article>
                            ),
                          )
                        ) : (
                          <div className="empty-inline">
                            No similar sales fit this radius and timeframe. Try
                            widening either control.
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="commute">
                  <AccordionTrigger>Commute</AccordionTrigger>
                  <AccordionContent>
                    <CommutePlanner
                      destinations={destinations}
                      property={property}
                      setDestinations={persistDestinations}
                    />
                    <div className="commute-cbd-links">
                      {["driving", "transit", "bicycling", "walking"].map(
                        (mode) => (
                          <Button variant="outline" asChild key={mode}>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${property.latitude},${property.longitude}&destination=Auckland+CBD&travelmode=${mode}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {mode} to Auckland CBD ↗
                            </a>
                          </Button>
                        ),
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mortgage">
                  <AccordionTrigger>Mortgage calculator</AccordionTrigger>
                  <AccordionContent>
                    <div className="mortgage-panel">
                      <MortgageCalculator defaultPrice={property.price} />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="history">
                  <AccordionTrigger>Market history</AccordionTrigger>
                  <AccordionContent>
                    <div
                      className="tool-panel"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.5rem",
                      }}
                    >
                      <div>
                        <h4
                          style={{ marginBottom: "0.75rem", fontWeight: 600 }}
                        >
                          Past Sale History
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          {historyData.pastSales.length === 0 && (
                            <p>
                              No verified past sales are available for this
                              property.
                            </p>
                          )}
                          {historyData.pastSales.map((sale, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.85rem 1rem",
                                border:
                                  "1px solid var(--border-color, #e5e7eb)",
                                borderRadius: "8px",
                              }}
                            >
                              <div>
                                <strong>{formatMoney(sale.price)}</strong>{" "}
                                <span
                                  style={{ fontSize: "0.8rem", opacity: 0.75 }}
                                >
                                  ({sale.saleType})
                                </span>
                                <p
                                  style={{
                                    margin: "0.2rem 0 0",
                                    fontSize: "0.85rem",
                                    opacity: 0.75,
                                  }}
                                >
                                  Sold on {sale.date} · Source: {sale.source}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4
                          style={{ marginBottom: "0.75rem", fontWeight: 600 }}
                        >
                          Valuation History (CV / AVM)
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          {historyData.valuationHistory.map((rec, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.75rem 1rem",
                                border:
                                  "1px solid var(--border-color, #e5e7eb)",
                                borderRadius: "8px",
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    marginRight: "1rem",
                                  }}
                                >
                                  {rec.date}
                                </span>
                                <span
                                  style={{ fontSize: "0.85rem", opacity: 0.75 }}
                                >
                                  {rec.source}
                                </span>
                              </div>
                              <strong>{formatMoney(rec.value)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              {
                <div className="notes-panel" id="property-notes">
                  <PropertyNotes
                    propertyId={property.id}
                    propertyTitle={property.address}
                  />
                </div>
              }
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
