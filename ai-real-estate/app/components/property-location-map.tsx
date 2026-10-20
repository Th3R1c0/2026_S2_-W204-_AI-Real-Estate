"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  ExternalLink,
  GraduationCap,
  Home,
  ShieldAlert,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  NearbySchool,
  PropertyFloodHazard,
  SchoolZone,
} from "../../lib/property-types";
import {
  describeFloodHazards,
  floodHazardDisclaimer,
  floodHazardOptions,
} from "../../lib/flood-hazards";
import { SCHOOL_NEARBY_RADIUS_METRES } from "../../lib/school-data";

export type MapMode = "schools" | "flood";

const noSchools: NearbySchool[] = [];

const FLOOD_LEGEND = [
  { type: "flood_plains", label: "Flood plain (100-yr)", color: "#2563eb" },
  { type: "flood_prone_areas", label: "Flood prone area", color: "#7c3aed" },
  { type: "overland_flow_paths", label: "Overland flow path", color: "#0ea5e9" },
  { type: "coastal_inundation", label: "Coastal inundation (100-yr)", color: "#0d9488" },
] as const;

function GoogleMapController({
  selectedSchool,
  floodGeoJson,
}: {
  selectedSchool: NearbySchool | null;
  floodGeoJson: Record<string, unknown> | null;
}) {
  const map = useMap();

  // Pan to selected school in Schools mode
  useEffect(() => {
    if (!map || !selectedSchool) return;
    if (
      selectedSchool.latitude !== undefined &&
      selectedSchool.longitude !== undefined
    ) {
      map.panTo({
        lat: selectedSchool.latitude,
        lng: selectedSchool.longitude,
      });
    }
  }, [map, selectedSchool]);

  // Overlay Flood GeoJSON on map.data in Flood assessment mode
  useEffect(() => {
    if (!map || !map.data) return;

    map.data.forEach((feature) => {
      map.data.remove(feature);
    });

    if (floodGeoJson) {
      try {
        map.data.addGeoJson(floodGeoJson);
        map.data.setStyle((feature) => {
          const color = String(feature.getProperty("color") || "#2563eb");
          const hazardType = String(feature.getProperty("hazardType") || "");
          const isLine = hazardType === "overland_flow_paths";
          return {
            fillColor: color,
            fillOpacity: isLine ? 0 : 0.28,
            strokeColor: color,
            strokeWeight: isLine ? 2.5 : 1.75,
            strokeOpacity: 0.88,
          };
        });
      } catch {
        // Ignore invalid GeoJSON
      }
    }

    return () => {
      map.data.forEach((feature) => {
        map.data.remove(feature);
      });
    };
  }, [map, floodGeoJson]);

  return null;
}

export default function PropertyLocationMap({
  latitude,
  longitude,
  address,
  schools = noSchools,
  schoolDataSynced = false,
  schoolZones = [],
  floodHazards,
  initialMode = "schools",
}: {
  latitude: number;
  longitude: number;
  address: string;
  schools?: NearbySchool[];
  schoolDataSynced?: boolean;
  schoolZones?: SchoolZone[];
  floodHazards?: PropertyFloodHazard[];
  initialMode?: MapMode;
}) {
  const [mode, setMode] = useState<MapMode>(initialMode);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [schoolTypeFilter, setSchoolTypeFilter] = useState("");
  const [floodGeoJson, setFloodGeoJson] = useState<Record<string, unknown> | null>(null);
  const [loadingFlood, setLoadingFlood] = useState(false);

  const schoolTypes = useMemo(
    () =>
      Array.from(new Set(schools.map((s) => s.orgType))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [schools],
  );

  const visibleSchools = useMemo(
    () =>
      schools.filter(
        (school) => !schoolTypeFilter || school.orgType === schoolTypeFilter,
      ),
    [schools, schoolTypeFilter],
  );

  const selectedSchool = useMemo(
    () =>
      visibleSchools.find((s) => s.schoolId === selectedSchoolId) ?? null,
    [visibleSchools, selectedSchoolId],
  );

  const mappedFloodLabels = useMemo(() => {
    if (!floodHazards) return [];
    return floodHazardOptions
      .filter(({ type }) => floodHazards.some((h) => h.type === type))
      .map(({ label }) => label);
  }, [floodHazards]);

  // Fetch flood GeoJSON when switching to Flood assessment mode
  useEffect(() => {
    if (mode !== "flood" || floodGeoJson) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingFlood(true);
    });
    fetch(`/api/flood-zones?lat=${latitude}&lng=${longitude}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.type === "FeatureCollection") {
          setFloodGeoJson(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingFlood(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, latitude, longitude, floodGeoJson]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className="unified-map-card">
      {/* Mode selector bar */}
      <div
        aria-label="Map intelligence mode"
        className="map-mode-tabs"
        role="tablist"
      >
        <button
          aria-selected={mode === "schools"}
          className={`map-mode-tab ${mode === "schools" ? "is-active" : ""}`}
          onClick={() => setMode("schools")}
          role="tab"
          type="button"
        >
          <GraduationCap className="size-4" />
          <span>Schools</span>
          {schools.length > 0 && (
            <span className="map-mode-badge">{schools.length}</span>
          )}
        </button>

        <button
          aria-selected={mode === "flood"}
          className={`map-mode-tab ${mode === "flood" ? "is-active" : ""}`}
          onClick={() => setMode("flood")}
          role="tab"
          type="button"
        >
          <Waves className="size-4" />
          <span>Flood assessment</span>
        </button>
      </div>

      {/* Google Map Canvas */}
      <div
        aria-label={`Map of ${address}`}
        className="map-container property-location-map"
        role="region"
      >
        <div className="map-skeleton -z-10 rounded-xl bg-muted" aria-hidden="true" />
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            defaultCenter={{ lat: latitude, lng: longitude }}
            defaultZoom={15}
            gestureHandling="greedy"
            internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
            mapId="DEMO_MAP_ID"
            style={{ width: "100%", height: "100%" }}
          >
            <GoogleMapController
              floodGeoJson={mode === "flood" ? floodGeoJson : null}
              selectedSchool={mode === "schools" ? selectedSchool : null}
            />

            {/* Primary Property Pin */}
            <AdvancedMarker
              position={{ lat: latitude, lng: longitude }}
              title={address}
            >
              <div className="map-home-pin" title={address}>
                <div className="map-home-pin-icon">
                  <Home className="size-4" />
                </div>
                <span className="map-home-pin-label">{address}</span>
              </div>
            </AdvancedMarker>

            {/* Schools Mode Markers: School hat icon + school name underneath */}
            {mode === "schools" &&
              visibleSchools.map((school) => {
                if (
                  school.latitude === undefined ||
                  school.longitude === undefined
                )
                  return null;
                const isSelected = selectedSchoolId === school.schoolId;
                return (
                  <AdvancedMarker
                    key={school.schoolId}
                    onClick={() => setSelectedSchoolId(school.schoolId)}
                    position={{
                      lat: school.latitude,
                      lng: school.longitude,
                    }}
                    title={`${school.name} · ${school.orgType}`}
                  >
                    <div
                      className={`map-school-pin ${isSelected ? "is-selected" : ""}`}
                    >
                      <div className="map-school-pin-hat">
                        <GraduationCap className="size-3.5" />
                      </div>
                      <span className="map-school-pin-label">
                        {school.name}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

          </GoogleMap>
        </APIProvider>
      </div>

      {/* Mode Contextual Drawer inside the Map Card */}
      <div className="map-mode-drawer">
        {mode === "schools" && (
          <div className="map-schools-panel">
            <div className="map-schools-header">
              <div>
                <h3>
                  Nearby schools within {SCHOOL_NEARBY_RADIUS_METRES / 1000} km
                </h3>
                <p className="map-schools-subtitle">
                  Click any school on the map or list to focus and inspect zone status.
                </p>
              </div>
              {schoolTypes.length > 1 && (
                <div className="map-schools-filter">
                  <NativeSelect
                    aria-label="Filter nearby schools by type"
                    onChange={(event) => setSchoolTypeFilter(event.target.value)}
                    value={schoolTypeFilter}
                  >
                    <option value="">All school types</option>
                    {schoolTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </div>

            {visibleSchools.length > 0 ? (
              <div className="map-schools-list" role="list">
                {visibleSchools.map((school) => {
                  const isSelected = selectedSchoolId === school.schoolId;
                  const matchingZone = schoolZones.find(
                    (zone) => zone.schoolId === school.schoolId,
                  );
                  const inZone = Boolean(matchingZone?.isInZone ?? matchingZone);
                  return (
                    <button
                      aria-label={`Select ${school.name}`}
                      aria-pressed={isSelected}
                      className={`map-school-row ${isSelected ? "is-selected" : ""}`}
                      key={school.schoolId}
                      onClick={() =>
                        setSelectedSchoolId((current) =>
                          current === school.schoolId ? null : school.schoolId,
                        )
                      }
                      type="button"
                    >
                      <div className="map-school-row-icon">
                        <GraduationCap className="size-4" />
                      </div>
                      <div className="map-school-row-body">
                        <div className="map-school-row-title">
                          <strong>{school.name}</strong>
                          <Badge
                            variant={
                              inZone
                                ? "default"
                                : school.hasEnrolmentZone
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {inZone
                              ? "In Zone"
                              : !school.hasEnrolmentZone
                                ? "Open Entry"
                                : "Out of Zone"}
                          </Badge>
                        </div>
                        <span className="map-school-row-meta">
                          {school.orgType} · {school.distanceKm.toFixed(2)} km away
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="map-drawer-empty">
                {schoolDataSynced
                  ? "No mapped schools within radius for this filter."
                  : "School directory data is ready for nearby lookups."}
              </p>
            )}
            <p className="disclaimer">
              School-zone matches are approximate. Confirm enrolment eligibility directly with the school or Ministry of Education.
            </p>
          </div>
        )}

        {mode === "flood" && (
          <div className="map-flood-drawer">
            <div className="map-flood-status">
              <div className="map-flood-status-icon">
                {mappedFloodLabels.length > 0 ? (
                  <ShieldAlert className="size-5 text-amber-600" />
                ) : (
                  <ShieldCheck className="size-5 text-emerald-700" />
                )}
              </div>
              <div>
                <h3>
                  Council flood mapping:{" "}
                  {floodHazards === undefined
                    ? "data not synced"
                    : mappedFloodLabels.length
                      ? mappedFloodLabels.join(", ")
                      : "no mapped intersection"}
                </h3>
                <p>
                  {floodHazards !== undefined
                    ? describeFloodHazards(floodHazards)
                    : "Council flood hazard layers are overlaid directly on the map above."}
                </p>
              </div>
            </div>

            <div className="map-flood-legend" aria-label="Flood hazard map legend">
              {FLOOD_LEGEND.map((item) => (
                <div className="map-flood-legend-item" key={item.type}>
                  <span
                    className="map-flood-swatch"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
              {loadingFlood && (
                <span className="map-flood-loading">Loading Council layers…</span>
              )}
            </div>

            {floodHazards && floodHazards.length > 0 && (
              <div className="map-flood-links">
                {floodHazards.map((hazard) => (
                  <a
                    className="map-flood-layer-link"
                    href={hazard.sourceUrl}
                    key={hazard.type}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>Council {hazard.type.replaceAll("_", " ")} layer</span>
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            )}

            <p className="disclaimer">{floodHazardDisclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
