import { expect, it } from "vitest";
import { filterProperties } from "../lib/property-engine";
import { properties } from "../lib/property-data";
import { parseExplicitPropertyFilters } from "../lib/property-query";

it("does not interpret retired walk-score, sunlight or facing filters", () => {
  expect(
    parseExplicitPropertyFilters(
      "north-facing, sunny, at least 6 hours of sunlight and walk score under 70",
    ),
  ).toEqual({});
});

it("filters for any nearby school without requiring an enrolment-zone match", () => {
  expect(
    parseExplicitPropertyFilters("a house near a school").hasNearbySchool,
  ).toBe(true);
  const nearby = {
    ...properties[0],
    id: "near-school",
    schoolZones: [],
    nearbySchools: [
      {
        schoolId: 1,
        name: "School",
        orgType: "Secondary",
        distanceKm: 1,
        hasEnrolmentZone: false,
        hasZoneGeometry: false,
      },
    ],
  };
  const far = { ...properties[0], id: "far-school", nearbySchools: [] };
  expect(
    filterProperties([nearby, far], { hasNearbySchool: true }).map((p) => p.id),
  ).toEqual(["near-school"]);
});

it("respects strict area boundaries and rejects listings with missing numeric data", () => {
  const homes = [
    { ...properties[0], id: "boundary", floorArea: 200 },
    { ...properties[0], id: "larger", floorArea: 200.5 },
  ];
  expect(
    filterProperties(homes, {
      numericCriteria: { floorArea: { min: 200, minExclusive: true } },
    }).map((p) => p.id),
  ).toEqual(["larger"]);
});
