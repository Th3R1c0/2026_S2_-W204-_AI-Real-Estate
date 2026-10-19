"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Car,
  ExternalLink,
  Footprints,
  MapPin,
  Plus,
  Trash2,
  TrainFront,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Property } from "@/lib/property-types";
import {
  straightLineDistanceKm,
  type SavedLocation,
} from "@/lib/saved-locations";

export type CommuteMode = "driving" | "transit" | "bicycling" | "walking";

export interface RouteSummary {
  destinationId: string;
  durationText?: string;
  distanceText?: string;
}

export interface PlaceSuggestion {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

let nextLocationLookupAt = 0;

export const commuteModes: Array<{
  id: CommuteMode;
  label: string;
  icon: typeof Car;
}> = [
  { id: "driving", label: "Driving", icon: Car },
  { id: "transit", label: "Public transport", icon: TrainFront },
  { id: "bicycling", label: "Cycling", icon: Bike },
  { id: "walking", label: "Walking", icon: Footprints },
];

async function searchNominatimSuggestions(
  rawQuery: string,
  limit = 5,
  throttle = false,
): Promise<PlaceSuggestion[]> {
  const query = new URL("https://nominatim.openstreetmap.org/search");
  query.searchParams.set("q", rawQuery);
  query.searchParams.set("format", "jsonv2");
  query.searchParams.set("countrycodes", "nz");
  query.searchParams.set("limit", String(limit));
  if (throttle) {
    const waitMs = Math.max(0, nextLocationLookupAt - Date.now());
    nextLocationLookupAt = Date.now() + waitMs + 1000;
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  const response = await fetch(query.toString());
  if (!response.ok) {
    throw new Error("Location lookup failed. Try again.");
  }
  const result: unknown = await response.json();
  if (!Array.isArray(result)) return [];
  const suggestions: PlaceSuggestion[] = [];
  for (const item of result) {
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const displayName =
      typeof item?.display_name === "string" && item.display_name.trim()
        ? item.display_name.trim()
        : rawQuery;
    const label = displayName.split(",")[0]?.trim() || displayName;
    suggestions.push({
      label,
      address: displayName,
      latitude,
      longitude,
    });
  }
  return suggestions;
}

export default function CommutePlanner({
  property,
  destinations,
  setDestinations,
  mode: controlledMode,
  onModeChange,
  selectedDestinationId,
  onSelectDestination,
  routeSummaries = {},
  onLookupWithGooglePlaces,
  onSearchWithGooglePlaces,
}: {
  property: Pick<Property, "latitude" | "longitude" | "address">;
  destinations: SavedLocation[];
  setDestinations: React.Dispatch<React.SetStateAction<SavedLocation[]>>;
  mode?: CommuteMode;
  onModeChange?: (mode: CommuteMode) => void;
  selectedDestinationId?: string | null;
  onSelectDestination?: (id: string) => void;
  routeSummaries?: Record<string, RouteSummary>;
  onLookupWithGooglePlaces?: (query: string) => Promise<{
    latitude: number;
    longitude: number;
    formattedAddress?: string;
  } | null>;
  onSearchWithGooglePlaces?: (query: string) => Promise<PlaceSuggestion[]>;
}) {
  const [internalMode, setInternalMode] = useState<CommuteMode>("driving");
  const mode = controlledMode ?? internalMode;
  const setMode = (next: CommuteMode) => {
    setInternalMode(next);
    onModeChange?.(next);
  };

  const [locatingIndex, setLocatingIndex] = useState<number | null>(null);
  const [locationError, setLocationError] = useState("");
  const [suggestionsById, setSuggestionsById] = useState<
    Record<string, PlaceSuggestion[]>
  >({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  async function runAutoSearch(destinationId: string, rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 3) {
      setSuggestionsById((prev) => ({ ...prev, [destinationId]: [] }));
      return;
    }
    try {
      let items: PlaceSuggestion[] = [];
      if (onSearchWithGooglePlaces) {
        items = await onSearchWithGooglePlaces(trimmed);
      }
      if (items.length === 0) {
        items = await searchNominatimSuggestions(trimmed, 4, false);
      }
      setSuggestionsById((prev) => ({ ...prev, [destinationId]: items }));
    } catch {
      // Ignore transient autocomplete errors while typing
    }
  }

  function updateDestination(
    index: number,
    field: "name" | "address",
    value: string,
  ) {
    const target = destinations[index];
    setDestinations((current) =>
      current.map((destination, currentIndex) =>
        currentIndex === index
          ? {
              ...destination,
              [field]: value,
              ...(field === "address"
                ? { latitude: undefined, longitude: undefined }
                : {}),
            }
          : destination,
      ),
    );

    if (field === "address" && target) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const trimmed = value.trim();
      if (trimmed.length < 3 || locatingIndex !== null) {
        setSuggestionsById((prev) => ({ ...prev, [target.id]: [] }));
      } else {
        debounceTimerRef.current = setTimeout(() => {
          void runAutoSearch(target.id, trimmed);
        }, 320);
      }
    }
  }

  function applySuggestion(
    destination: SavedLocation,
    suggestion: PlaceSuggestion,
  ) {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSuggestionsById((prev) => ({ ...prev, [destination.id]: [] }));
    setDestinations((current) =>
      current.map((item) =>
        item.id === destination.id
          ? {
              ...item,
              name: item.name.trim() ? item.name : suggestion.label,
              address: suggestion.address,
              latitude: suggestion.latitude,
              longitude: suggestion.longitude,
            }
          : item,
      ),
    );
    onSelectDestination?.(destination.id);
  }

  async function locateDestination(index: number) {
    const destination = destinations[index];
    if (!destination?.address.trim()) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSuggestionsById((prev) => ({ ...prev, [destination.id]: [] }));
    setLocatingIndex(index);
    setLocationError("");
    try {
      let coords: {
        latitude: number;
        longitude: number;
        formattedAddress?: string;
      } | null = null;

      if (onLookupWithGooglePlaces) {
        coords = await onLookupWithGooglePlaces(destination.address.trim());
      }

      if (!coords) {
        const items = await searchNominatimSuggestions(
          destination.address.trim(),
          1,
          true,
        );
        const first = items[0];
        if (!first) {
          throw new Error("Address not found. Try a more specific address.");
        }
        coords = {
          latitude: first.latitude,
          longitude: first.longitude,
        };
      }

      const { latitude, longitude } = coords;
      setDestinations((current) =>
        current.map((item) =>
          item.id === destination.id && item.address === destination.address
            ? { ...item, latitude, longitude }
            : item,
        ),
      );
      onSelectDestination?.(destination.id);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "Location lookup failed.",
      );
    } finally {
      setLocatingIndex(null);
    }
  }

  return (
    <div className="commute-panel">
      <div className="tool-heading">
        <div>
          <h3>Saved commute locations</h3>
        </div>
        <span className="commute-count">{destinations.length}/3 saved</span>
      </div>
      <div aria-label="Travel mode" className="commute-modes" role="group">
        {commuteModes.map(({ id, label, icon: Icon }) => (
          <Button
            aria-pressed={mode === id}
            className={mode === id ? "active" : ""}
            key={id}
            onClick={() => setMode(id)}
            size="sm"
            type="button"
            variant={mode === id ? "default" : "outline"}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        ))}
      </div>
      {destinations.length ? (
        <div className="commute-list">
          {destinations.map((destination, index) => {
            const mapsUrl = new URL("https://www.google.com/maps/dir/");
            mapsUrl.searchParams.set("api", "1");
            mapsUrl.searchParams.set(
              "origin",
              `${property.latitude},${property.longitude}`,
            );
            mapsUrl.searchParams.set("destination", destination.address);
            mapsUrl.searchParams.set("travelmode", mode);

            const routeInfo = routeSummaries[destination.id];
            const distanceKm =
              destination.latitude !== undefined &&
              destination.longitude !== undefined
                ? straightLineDistanceKm(
                    property.latitude,
                    property.longitude,
                    destination.latitude,
                    destination.longitude,
                  )
                : null;
            const isSelected = selectedDestinationId === destination.id;
            const suggestions = suggestionsById[destination.id] ?? [];

            return (
              <div
                className={`commute-destination-card ${isSelected ? "is-selected" : ""}`}
                key={destination.id || index}
                onClick={() => {
                  if (destination.latitude !== undefined) {
                    onSelectDestination?.(destination.id);
                  } else if (destination.address.trim()) {
                    void locateDestination(index);
                  }
                }}
              >
                <div className="commute-destination">
                  <label>
                    <span>Destination name</span>
                    <Input
                      aria-label={`Name for destination ${index + 1}`}
                      onChange={(event) =>
                        updateDestination(index, "name", event.target.value)
                      }
                      placeholder="e.g. Work, CBD, Gym"
                      value={destination.name}
                    />
                  </label>
                  <div className="commute-address-field">
                    <label>
                      <span>Address</span>
                      <Input
                        aria-label={`Address for destination ${index + 1}`}
                        autoComplete="off"
                        onChange={(event) =>
                          updateDestination(
                            index,
                            "address",
                            event.target.value,
                          )
                        }
                        placeholder="Search address or place in Auckland"
                        value={destination.address}
                      />
                    </label>
                    {suggestions.length > 0 && (
                      <div
                        aria-label={`Address suggestions for destination ${index + 1}`}
                        className="commute-suggestions-list"
                        role="listbox"
                      >
                        {suggestions.map((suggestion) => (
                          <button
                            aria-selected="false"
                            className="commute-suggestion-option"
                            key={`${suggestion.latitude},${suggestion.longitude},${suggestion.address}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              applySuggestion(destination, suggestion);
                            }}
                            role="option"
                            type="button"
                          >
                            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="commute-suggestion-text">
                              {suggestion.address}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="commute-destination-footer">
                  <div className="commute-route-badges">
                    {routeInfo?.durationText ? (
                      <Badge variant="secondary">
                        {routeInfo.durationText}
                        {routeInfo.distanceText
                          ? ` · ${routeInfo.distanceText}`
                          : ""}
                      </Badge>
                    ) : distanceKm !== null ? (
                      <Badge variant="outline">
                        {distanceKm.toFixed(1)} km
                      </Badge>
                    ) : null}
                  </div>

                  <div className="commute-destination-actions">
                    <Button
                      className="commute-add"
                      disabled={
                        !destination.address.trim() || locatingIndex !== null
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        void locateDestination(index);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <MapPin className="size-3.5" />
                      {locatingIndex === index
                        ? "Finding…"
                        : destination.latitude === undefined
                          ? "Find on map"
                          : "Select route"}
                    </Button>
                    {destination.address.trim() && (
                      <a
                        className="commute-directions-link"
                        href={mapsUrl.toString()}
                        onClick={(e) => e.stopPropagation()}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-3" />
                        Open in Google Maps
                      </a>
                    )}
                    <Button
                      aria-label={`Remove destination ${index + 1}`}
                      className="commute-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDestinations((current) =>
                          current.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        );
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="commute-empty">
          Add a destination to calculate travel times and open routes in Google Maps.
        </p>
      )}
      <div className="commute-panel-actions">
        <Button
          className="commute-add"
          disabled={destinations.length >= 3}
          onClick={() =>
            setDestinations((current) => [
              ...current,
              { id: crypto.randomUUID(), name: "", address: "" },
            ])
          }
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="size-3.5" />
          Add destination
        </Button>
      </div>
      {locationError && <p role="alert">{locationError}</p>}
    </div>
  );
}
