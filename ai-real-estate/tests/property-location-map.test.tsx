import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PropertyLocationMap from "../app/components/property-location-map";
import type { NearbySchool } from "../lib/property-types";

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="gmp-api-provider">{children}</div>
  ),
  Map: ({
    children,
    internalUsageAttributionIds,
    mapId,
  }: {
    children?: React.ReactNode;
    internalUsageAttributionIds?: string[];
    mapId?: string;
  }) => (
    <div
      data-testid="gmp-map"
      data-attribution={internalUsageAttributionIds?.join(",")}
      data-map-id={mapId}
    >
      {children}
    </div>
  ),
  AdvancedMarker: ({
    children,
    onClick,
    title,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
  }) => (
    <div data-testid="gmp-marker" title={title} onClick={onClick}>
      {children}
    </div>
  ),
  useMap: () => null,
  useMapsLibrary: () => null,
}));

const sampleSchools: NearbySchool[] = [
  {
    schoolId: 1201,
    name: "Auckland Grammar",
    orgType: "Secondary (Year 9-15)",
    distanceKm: 0.85,
    latitude: -36.868,
    longitude: 174.769,
    hasEnrolmentZone: true,
    hasZoneGeometry: true,
  },
  {
    schoolId: 1202,
    name: "Ponsonby Primary School",
    orgType: "Contributing School (Year 1-6)",
    distanceKm: 0.45,
    latitude: -36.851,
    longitude: 174.742,
    hasEnrolmentZone: true,
    hasZoneGeometry: true,
  },
];

describe("PropertyLocationMap unified 3-mode Google Map", () => {
  it("renders Google Map with attribution ID, DEMO_MAP_ID, and 3 mode tabs (Schools, Commute, Flood assessment)", () => {
    render(
      <PropertyLocationMap
        address="42 Herne Bay Road"
        latitude={-36.8485}
        longitude={174.7633}
        locations={[]}
        schools={sampleSchools}
        schoolDataSynced={true}
        schoolZones={[
          {
            schoolId: 1202,
            schoolName: "Ponsonby Primary School",
            schoolType: "Contributing School (Year 1-6)",
            isInZone: true,
          },
        ]}
        floodHazards={[{ type: "flood_plains", sourceFeatureId: "101", sourceUrl: "https://example.com/flood" }]}
      />,
    );

    const mapEl = screen.getByTestId("gmp-map");
    expect(mapEl.getAttribute("data-attribution")).toContain("gmp_git_agentskills_v1");
    expect(mapEl.getAttribute("data-map-id")).toBe("DEMO_MAP_ID");

    expect(screen.getByRole("tab", { name: /Schools/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Commute/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Flood assessment/i })).toBeTruthy();

    // Default mode is Schools: shows school markers with name labels and selectable school list
    expect(screen.getAllByText("Auckland Grammar").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Ponsonby Primary School").length).toBeGreaterThanOrEqual(2);

    const schoolOption = screen.getByRole("button", { name: /Select Auckland Grammar/i });
    fireEvent.click(schoolOption);
    expect(schoolOption.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches between Commute and Flood assessment modes inside the map card", () => {
    const setLocations = vi.fn();
    render(
      <PropertyLocationMap
        address="42 Herne Bay Road"
        latitude={-36.8485}
        longitude={174.7633}
        locations={[{ id: "loc-1", name: "Office", address: "188 Quay Street, Auckland" }]}
        setLocations={setLocations}
        schools={sampleSchools}
        schoolDataSynced={true}
        floodHazards={[{ type: "flood_plains", sourceFeatureId: "101", sourceUrl: "https://example.com/flood" }]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Commute/i }));
    expect(screen.getByRole("group", { name: /Travel mode/i })).toBeTruthy();
    expect(screen.getByDisplayValue("Office")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Flood assessment/i }));
    expect(screen.getByText(/Flood plain \(100-yr\)/i)).toBeTruthy();
    expect(screen.getByText(/Overland flow path/i)).toBeTruthy();
    expect(screen.getByText(/Council flood plains layer/i)).toBeTruthy();
  });
});
