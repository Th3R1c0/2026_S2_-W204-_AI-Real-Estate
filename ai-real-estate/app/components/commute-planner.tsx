"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { Property } from "@/lib/property-types";
import type { SavedLocation } from "@/lib/saved-locations";
import { Button } from "@/components/ui/button";
import { useAccountWorkspace } from "./account-workspace-provider";
type CommuteMode = "driving" | "transit" | "bicycling" | "walking";
let nextLocationLookupAt = 0;
const commuteModes: Array<{ id: CommuteMode; label: string }> = [
  { id: "driving", label: "Driving" },
  { id: "transit", label: "Public transport" },
  { id: "bicycling", label: "Cycling" },
  { id: "walking", label: "Walking" },
];

export default function CommutePlanner({
  property,
  destinations,
  setDestinations,
}: {
  property: Property;
  destinations: SavedLocation[];
  setDestinations: React.Dispatch<React.SetStateAction<SavedLocation[]>>;
}) {
  const account = useAccountWorkspace();
  const [mode, setMode] = useState<CommuteMode>("driving");
  const [locatingIndex, setLocatingIndex] = useState<number | null>(null);
  const [locationError, setLocationError] = useState("");

  function updateDestination(
    index: number,
    field: "name" | "address",
    value: string,
  ) {
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
  }

  async function locateDestination(index: number) {
    const destination = destinations[index];
    if (!destination?.address.trim()) return;
    setLocatingIndex(index);
    setLocationError("");
    try {
      const query = new URL("https://nominatim.openstreetmap.org/search");
      query.searchParams.set("q", destination.address.trim());
      query.searchParams.set("format", "jsonv2");
      query.searchParams.set("countrycodes", "nz");
      query.searchParams.set("limit", "1");
      const waitMs = Math.max(0, nextLocationLookupAt - Date.now());
      nextLocationLookupAt = Date.now() + waitMs + 1000;
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      const response = await fetch(query.toString());
      if (!response.ok) throw new Error("Location lookup failed. Try again.");
      const result: unknown = await response.json();
      const first = Array.isArray(result) ? result[0] : null;
      const latitude = Number(first?.lat);
      const longitude = Number(first?.lon);
      if (!first || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Address not found. Try a more specific address.");
      }
      setDestinations((current) =>
        current.map((item) =>
          item.id === destination.id && item.address === destination.address
            ? { ...item, latitude, longitude }
            : item,
        ),
      );
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
          <h3>Saved locations</h3>
        </div>
        <span className="commute-count">{destinations.length}/3 saved</span>
      </div>
      <div aria-label="Travel mode" className="commute-modes" role="group">
        {commuteModes.map(({ id, label }) => (
          <Button
            aria-pressed={mode === id}
            className={mode === id ? "active" : ""}
            key={id}
            onClick={() => setMode(id)}
            type="button"
          >
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

            return (
              <div className="commute-destination" key={index}>
                <label>
                  <span>Destination name</span>
                  <Input
                    aria-label={`Name for destination ${index + 1}`}
                    onChange={(event) =>
                      updateDestination(index, "name", event.target.value)
                    }
                    placeholder="e.g. Work"
                    value={destination.name}
                  />
                </label>
                <label>
                  <span>Address</span>
                  <Input
                    aria-label={`Address for destination ${index + 1}`}
                    onChange={(event) =>
                      updateDestination(index, "address", event.target.value)
                    }
                    placeholder="Enter a street address"
                    value={destination.address}
                  />
                </label>
                <Button
                  className="commute-add"
                  disabled={
                    !destination.address.trim() || locatingIndex !== null
                  }
                  onClick={() => locateDestination(index)}
                  type="button"
                >
                  {locatingIndex === index
                    ? "Finding…"
                    : destination.latitude === undefined
                      ? "Find on map"
                      : "Update map pin"}
                </Button>
                {destination.address.trim() ? (
                  <a href={mapsUrl.toString()} rel="noreferrer" target="_blank">
                    Open directions
                  </a>
                ) : (
                  <span className="commute-prompt">
                    Enter an address to open directions
                  </span>
                )}
                <Button
                  aria-label={`Remove destination ${index + 1}`}
                  className="commute-remove"
                  onClick={() =>
                    setDestinations((current) =>
                      current.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    )
                  }
                  type="button"
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="commute-empty">
          Add a workplace, family home, or other regular destination.
        </p>
      )}
      <Button
        className="commute-add"
        disabled={destinations.length >= 3}
        onClick={() =>
          setDestinations((current) => [
            ...current,
            { id: crypto.randomUUID(), name: "", address: "" },
          ])
        }
        type="button"
      >
        Add destination
      </Button>
      {locationError && <p role="alert">{locationError}</p>}
      <p className="disclaimer">
        {account?.status === "signedIn"
          ? "Saved privately to your account."
          : "Saved on this device."}{" "}
        Address lookup and map tiles use OpenStreetMap; Google Maps opens route
        directions. Distances shown here are straight-line estimates.
      </p>
    </div>
  );
}
