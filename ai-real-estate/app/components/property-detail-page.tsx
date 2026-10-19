"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import type {
  ComparableSalesResult,
  Property,
} from "../../lib/property-types";
import { SCHOOL_NEARBY_RADIUS_METRES } from "../../lib/school-data";
import {
  readSavedLocations,
  straightLineDistanceKm,
  type SavedLocation,
} from "../../lib/saved-locations";

type DetailTab =
  | "overview"
  | "photos"
  | "flood"
  | "comps"
  | "schools"
  | "commute"
  | "mortgage"
  | "history"
  | "notes";

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
  const [tab, setTab] = useState<DetailTab>("overview");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<SavedLocation[]>([]);
  const [showSavedLocations, setShowSavedLocations] = useState(true);
  const [nearbySchoolType, setNearbySchoolType] = useState("");
  const [radius, setRadius] = useState(2);
  const [months, setMonths] = useState(6);
  const [postgisComps, setPostgisComps] = useState<ComparableSalesResult | null>(null);

  const allPhotos = useMemo(() => {
    const raw = [property.image, ...(property.photoGallery ?? [])].filter(Boolean);
    return Array.from(new Set(raw));
  }, [property.image, property.photoGallery]);

  useEffect(() => {
    if (account?.status === "signedIn") {
      setSavedIds(account.workspace.savedPropertyIds);
      setDestinations(account.workspace.destinations);
    } else {
      setDestinations(readSavedLocations());
      try {
        const raw = localStorage.getItem("haven_saved_property_ids");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSavedIds(parsed.filter((id): id is string => typeof id === "string"));
          }
        }
      } catch {}
    }
  }, [account?.status, account?.workspace]);

  const isSaved = savedIds.includes(property.id);

  function toggleSave() {
    const next = isSaved
      ? savedIds.filter((id) => id !== property.id)
      : [...savedIds, property.id];
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

  useEffect(() => {
    if (tab !== "comps") return;
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
  }, [tab, property.id, radius, months]);

  const compResult = postgisComps ?? fallbackCompResult;
  const historyData = useMemo(() => generateValuationHistory(property), [property]);
  const nearbySchoolTypes = Array.from(
    new Set((property.nearbySchools ?? []).map(({ orgType }) => orgType)),
  ).sort((a, b) => a.localeCompare(b));
  const visibleNearbySchools = (property.nearbySchools ?? []).filter(
    (school) => !nearbySchoolType || school.orgType === nearbySchoolType,
  );

  const mappedFloodLabels = useMemo(() => {
    if (!property.floodHazards) return [];
    return floodHazardOptions
      .filter(({ type }) => property.floodHazards?.some((h) => h.type === type))
      .map(({ label }) => label);
  }, [property.floodHazards]);

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "photos", label: `Photos (${allPhotos.length})` },
    { id: "flood", label: "Flood hazard" },
    { id: "comps", label: "Comparable sales" },
    { id: "schools", label: "Schools" },
    { id: "commute", label: "Commute" },
    { id: "mortgage", label: "Mortgage" },
    { id: "history", label: "Market History" },
    { id: "notes", label: "My Notes" },
  ];

  return (
    <div className="site-shell property-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Haven home">
          <span className="brand-mark">⌂</span>
          <span>
            haven<span className="brand-dot">.</span>
          </span>
        </Link>

        <nav aria-label="Property navigation" className="main-nav">
          <Link href="/">← All Auckland Properties</Link>
          <Link href="/profile">
            {account?.status === "signedIn" && account.user
              ? `Account (${account.user.username})`
              : "Profile"}
          </Link>
        </nav>

        <div className="header-actions">
          <button
            className={`shortlist-button ${isSaved ? "is-saved-btn" : ""}`}
            onClick={toggleSave}
            type="button"
          >
            {isSaved ? "♥ Saved to Shortlist" : "♡ Save Property"}
          </button>
        </div>
      </header>

      <main className="property-page-main">
        {/* Top Breadcrumb & Title Header */}
        <div className="property-page-header">
          <div>
            <div className="property-page-badges">
              <span className="property-badge-pill">{property.propertyType}</span>
              {property.architecturalStyle && (
                <span className="property-badge-pill">{property.architecturalStyle}</span>
              )}
              {property.ownershipType && (
                <span className="property-badge-pill">{property.ownershipType}</span>
              )}
              {property.orientation && (
                <span className="property-badge-pill">
                  ☀️ {property.orientation}-facing ({property.sunlightHours} hrs sun)
                </span>
              )}
              {property.floodHazards !== undefined && (
                <button
                  type="button"
                  onClick={() => setTab("flood")}
                  className={`property-badge-pill ${
                    mappedFloodLabels.length > 0
                      ? "property-badge-warning"
                      : "property-badge-safe"
                  }`}
                >
                  {mappedFloodLabels.length > 0
                    ? `⚠️ Mapped flood hazard: ${mappedFloodLabels.join(", ")}`
                    : "✓ No mapped Council flood hazard"}
                </button>
              )}
            </div>
            <h1>{property.address}</h1>
            <p className="property-page-suburb">
              {property.suburb}, {property.city}, {property.region}
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

        {/* Airbnb-style 5-Photo Mosaic Gallery */}
        <section className="property-mosaic-section" aria-label="Property photo gallery">
          <div
            className={`property-mosaic-grid ${
              allPhotos.length === 1
                ? "mosaic-single"
                : allPhotos.length < 5
                  ? "mosaic-few"
                  : ""
            }`}
          >
            <div
              className="mosaic-main-item"
              onClick={() => setLightboxIndex(0)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setLightboxIndex(0);
              }}
            >
              <Image
                alt={property.imageAlt}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 60vw"
                src={allPhotos[0]}
              />
            </div>
            {allPhotos.slice(1, 5).map((url, idx) => (
              <div
                className="mosaic-sub-item"
                key={url}
                onClick={() => setLightboxIndex(idx + 1)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setLightboxIndex(idx + 1);
                }}
              >
                <Image
                  alt={`${property.address} photo ${idx + 2}`}
                  fill
                  sizes="(max-width: 900px) 50vw, 25vw"
                  src={url}
                />
              </div>
            ))}
          </div>
          {allPhotos.length > 1 && (
            <button
              className="show-all-photos-btn"
              onClick={() => setLightboxIndex(0)}
              type="button"
            >
              ⊞ Show all {allPhotos.length} photos
            </button>
          )}
        </section>

        {/* Two-Column Airbnb Detail Layout */}
        <div className="property-page-columns">
          <div className="property-page-left">
            {/* Key Specs Strip */}
            <div className="property-key-specs">
              <div className="key-spec-item">
                <strong>{property.bedrooms}</strong>
                <span>Bedrooms</span>
              </div>
              <div className="key-spec-item">
                <strong>{property.bathrooms}</strong>
                <span>Bathrooms</span>
              </div>
              {property.parkingSpaces ? (
                <div className="key-spec-item">
                  <strong>{property.parkingSpaces}</strong>
                  <span>Parking</span>
                </div>
              ) : null}
              {property.floorArea > 0 ? (
                <div className="key-spec-item">
                  <strong>{numberFormatter.format(property.floorArea)} m²</strong>
                  <span>Floor area</span>
                </div>
              ) : null}
              <div className="key-spec-item">
                <strong>{numberFormatter.format(property.landArea)} m²</strong>
                <span>Land area</span>
              </div>
              <div className="key-spec-item">
                <strong>{property.yearBuilt || "Unknown"}</strong>
                <span>Year built</span>
              </div>
            </div>

            {/* Section Tabs */}
            <nav aria-label="Property detail sections" className="detail-tabs property-page-tabs">
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

            <div className="property-page-tab-body">
              {tab === "overview" && (
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
                        <strong>{formatMoney(property.estimatedWeeklyRent)} / week</strong>
                      </div>
                    ) : null}
                    {property.orientation && (
                      <div className="attr-card">
                        <span>Orientation & Sunlight</span>
                        <strong>
                          {property.orientation} ({property.sunlightHours} hrs/day)
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Flood Hazard Quick Summary Card on Overview */}
                  <div className="property-overview-flood-card">
                    <div>
                      <p className="eyebrow">Auckland Council GIS Check</p>
                      <h4>
                        {mappedFloodLabels.length > 0
                          ? `Intersects ${mappedFloodLabels.join(", ")}`
                          : "No mapped Council flood hazards"}
                      </h4>
                      <p>
                        {property.floodHazards !== undefined
                          ? describeFloodHazards(property.floodHazards)
                          : "Auckland Council flood data has not been synced for this property yet."}
                      </p>
                    </div>
                    <button
                      className="secondary-btn"
                      onClick={() => setTab("flood")}
                      type="button"
                    >
                      View flood details →
                    </button>
                  </div>

                  {/* Map Section */}
                  <div className="property-map-block">
                    <div className="property-map-header">
                      <div>
                        <h3>Location & Map</h3>
                        <p>
                          {property.latitude.toFixed(6)}, {property.longitude.toFixed(6)} ·
                          Verified LINZ NZ Address
                        </p>
                      </div>
                      <label className="saved-location-toggle">
                        <input
                          checked={showSavedLocations}
                          onChange={(e) => setShowSavedLocations(e.target.checked)}
                          type="checkbox"
                        />
                        Show saved locations
                      </label>
                    </div>
                    <PropertyLocationMap
                      address={property.address}
                      latitude={property.latitude}
                      longitude={property.longitude}
                      locations={showSavedLocations ? destinations : []}
                    />
                    {showSavedLocations && (
                      <ul className="saved-location-distances">
                        {destinations
                          .filter(
                            (loc) =>
                              loc.latitude !== undefined && loc.longitude !== undefined,
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
              )}

              {tab === "photos" && (
                <div className="property-all-photos-grid">
                  {allPhotos.map((url, idx) => (
                    <div
                      className="property-photo-card"
                      key={url}
                      onClick={() => setLightboxIndex(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setLightboxIndex(idx);
                      }}
                    >
                      <div className="property-photo-card-img">
                        <Image
                          alt={`${property.address} photo ${idx + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 400px"
                          src={url}
                        />
                      </div>
                      <span>Photo {idx + 1} of {allPhotos.length}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "flood" && (
                <div className="flood-risk-panel">
                  <div className="tool-heading">
                    <div>
                      <p className="eyebrow">Auckland Council mapped layers</p>
                      <h3>Flood hazard information</h3>
                    </div>
                  </div>
                  {property.floodHazards === undefined ? (
                    <p>
                      Auckland Council flood data has not been synced for this property yet.
                    </p>
                  ) : property.floodHazards.length === 0 ? (
                    <p>
                      No imported Auckland Council flood-hazard layers intersect this
                      property&apos;s mapped location.
                    </p>
                  ) : (
                    <>
                      <ul className="flood-hazard-list">
                        {floodHazardOptions
                          .filter(({ type }) =>
                            property.floodHazards?.some((hazard) => hazard.type === type),
                          )
                          .map(({ type, label }) => (
                            <li key={type}>{label}</li>
                          ))}
                      </ul>
                      <p>{describeFloodHazards(property.floodHazards)}</p>
                    </>
                  )}
                  <p className="flood-data-disclaimer">{floodHazardDisclaimer}</p>
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
                      {compResult.averagePrice
                        ? `${formatMoney(compResult.averagePrice)} average`
                        : "No average"}
                    </div>
                  </div>
                  <div className="range-grid">
                    <label>
                      Search radius <strong>{radius} km</strong>
                      <input
                        aria-label="Search radius"
                        max="10"
                        min="1"
                        onChange={(e) => setRadius(Number(e.target.value))}
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
                        onChange={(e) => setMonths(Number(e.target.value))}
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
                              {comp.bedrooms} bed · {comp.floorArea} m² ·{" "}
                              {distanceKm.toFixed(1)} km away
                            </span>
                          </div>
                          <div>
                            <strong>{formatMoney(comp.price)}</strong>
                            {comp.soldDate && (
                              <span>
                                Sold{" "}
                                {new Date(comp.soldDate).toLocaleDateString("en-NZ", {
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-inline">
                        No similar sales fit this radius and timeframe. Try widening either
                        control.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "schools" && (
                <div
                  className="family-panel"
                  style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
                >
                  {property.schoolDataSynced ? (
                    <>
                      <p className="disclaimer" role="note">
                        <strong>School-zone matches are approximate.</strong> Ministry of
                        Education boundaries have limited resolution and alignment accuracy,
                        so results may be inaccurate. Confirm enrolment eligibility with the
                        school or Ministry.
                      </p>
                      <div>
                        <h4 style={{ marginBottom: "0.25rem", fontWeight: 600 }}>
                          Nearby schools within {SCHOOL_NEARBY_RADIUS_METRES / 1000} km
                        </h4>
                        {nearbySchoolTypes.length > 0 && (
                          <label className="field-label" htmlFor="page-nearby-school-type">
                            Filter nearby schools by type
                            <select
                              id="page-nearby-school-type"
                              onChange={(e) => setNearbySchoolType(e.target.value)}
                              value={nearbySchoolType}
                            >
                              <option value="">All school types</option>
                              {nearbySchoolTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
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
                                    padding: "0.75rem",
                                    border: "1px solid var(--border-color, #e5e7eb)",
                                    borderRadius: "8px",
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
                                    {school.orgType} · {school.distanceKm.toFixed(2)} km away
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
                            No schools mapped within {SCHOOL_NEARBY_RADIUS_METRES / 1000} km.
                          </p>
                        )}
                      </div>
                    </>
                  ) : property.schoolZones?.length ? (
                    <div>
                      <h4 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
                        School Catchments
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {property.schoolZones.map((school, index) => {
                          const name = school.name ?? school.schoolName ?? "School";
                          const type =
                            school.type ?? school.schoolType ?? school.zoneType ?? "";
                          const isInZone = school.isInZone ?? true;
                          return (
                            <div
                              key={`${school.schoolId ?? name}-${index}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.75rem 1rem",
                                border: "1px solid var(--border-color, #e5e7eb)",
                                borderRadius: "8px",
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
                                className={`badge ${
                                  isInZone ? "badge-success" : "badge-outline"
                                }`}
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

              {tab === "commute" && (
                <div className="commute-panel">
                  <p className="eyebrow">Directions & Travel</p>
                  <h3>Plan your commute from {property.address}</h3>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
                    {["driving", "transit", "bicycling", "walking"].map((mode) => {
                      const mapsUrl = new URL("https://www.google.com/maps/dir/");
                      mapsUrl.searchParams.set("api", "1");
                      mapsUrl.searchParams.set(
                        "origin",
                        `${property.latitude},${property.longitude}`,
                      );
                      mapsUrl.searchParams.set("destination", "Auckland CBD");
                      mapsUrl.searchParams.set("travelmode", mode);
                      return (
                        <a
                          key={mode}
                          className="secondary-btn"
                          href={mapsUrl.toString()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Google Maps ({mode}) to Auckland CBD ↗
                        </a>
                      );
                    })}
                  </div>
                  {destinations.length > 0 && (
                    <div style={{ marginTop: "1.5rem" }}>
                      <h4>Your Saved Locations</h4>
                      <ul className="saved-location-distances">
                        {destinations.map((d) => (
                          <li key={d.id}>
                            <strong>{d.name || d.address}</strong> — {d.address}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === "mortgage" && (
                <div className="mortgage-panel">
                  <MortgageCalculator defaultPrice={property.price} />
                </div>
              )}

              {tab === "history" && (
                <div
                  className="tool-panel"
                  style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
                >
                  <div>
                    <h4 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
                      Past Sale History
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {historyData.pastSales.length === 0 && (
                        <p>No verified past sales are available for this property.</p>
                      )}
                      {historyData.pastSales.map((sale, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.85rem 1rem",
                            border: "1px solid var(--border-color, #e5e7eb)",
                            borderRadius: "8px",
                          }}
                        >
                          <div>
                            <strong>{formatMoney(sale.price)}</strong>{" "}
                            <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                              ({sale.saleType})
                            </span>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", opacity: 0.75 }}>
                              Sold on {sale.date} · Source: {sale.source}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
                      Valuation History (CV / AVM)
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {historyData.valuationHistory.map((rec, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 1rem",
                            border: "1px solid var(--border-color, #e5e7eb)",
                            borderRadius: "8px",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, marginRight: "1rem" }}>
                              {rec.date}
                            </span>
                            <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                              {rec.source}
                            </span>
                          </div>
                          <strong>{formatMoney(rec.value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "notes" && (
                <div className="notes-panel" style={{ padding: "0.5rem 0" }}>
                  <PropertyNotes
                    propertyId={property.id}
                    propertyTitle={property.address}
                  />
                </div>
              )}
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
                  <strong className="sidebar-price">{formatMoney(property.price)}</strong>
                </div>
                {property.estimatedWeeklyRent ? (
                  <div className="sidebar-rent-pill">
                    Est. rent {formatMoney(property.estimatedWeeklyRent)}/wk
                  </div>
                ) : null}
              </div>

              {/* Open Homes Box */}
              <div className="sidebar-open-homes">
                <h4>📅 Open Home Times</h4>
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
                <p className="eyebrow">Listing Agent</p>
                {property.listingAgent ? (
                  <>
                    <h3>{property.listingAgent.name}</h3>
                    <p className="sidebar-agent-source">
                      Verified via {property.listingAgent.source}
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
                <button
                  className="secondary-save-cta"
                  onClick={toggleSave}
                  type="button"
                >
                  {isSaved ? "♥ Saved in Your Shortlist" : "♡ Save to Shortlist"}
                </button>
              </div>

              {property.sources && property.sources.length > 0 && (
                <div className="sidebar-sources">
                  <p className="eyebrow">Verified Data Sources</p>
                  <ul>
                    {property.sources.map((src) => (
                      <li key={src.id}>
                        <a href={src.url} target="_blank" rel="noopener noreferrer">
                          {src.publisher} ↗
                        </a>
                        <span>{src.reference}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Fullscreen Photo Gallery Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="modal-backdrop photo-lightbox-backdrop"
          role="dialog"
          aria-label="Property photo gallery viewer"
          aria-modal="true"
        >
          <div className="photo-lightbox-header">
            <span>
              {property.address} — Photo {lightboxIndex + 1} of {allPhotos.length}
            </span>
            <button
              className="lightbox-close-btn"
              onClick={() => setLightboxIndex(null)}
              type="button"
            >
              ✕ Close
            </button>
          </div>
          <div className="photo-lightbox-stage">
            <button
              aria-label="Previous photo"
              className="lightbox-nav-btn"
              onClick={() =>
                setLightboxIndex((curr) =>
                  curr === null ? 0 : (curr - 1 + allPhotos.length) % allPhotos.length,
                )
              }
              type="button"
            >
              ‹
            </button>
            <div className="photo-lightbox-image-wrap">
              <Image
                alt={`${property.address} photo ${lightboxIndex + 1}`}
                fill
                sizes="90vw"
                src={allPhotos[lightboxIndex]}
                style={{ objectFit: "contain" }}
              />
            </div>
            <button
              aria-label="Next photo"
              className="lightbox-nav-btn"
              onClick={() =>
                setLightboxIndex((curr) =>
                  curr === null ? 0 : (curr + 1) % allPhotos.length,
                )
              }
              type="button"
            >
              ›
            </button>
          </div>
          <div className="photo-lightbox-thumbs">
            {allPhotos.map((url, idx) => (
              <button
                key={url}
                className={`lightbox-thumb-btn ${idx === lightboxIndex ? "active" : ""}`}
                onClick={() => setLightboxIndex(idx)}
                type="button"
              >
                <Image
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  sizes="80px"
                  src={url}
                  style={{ objectFit: "cover" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
