import { describe, expect, it } from "vitest";
import { straightLineDistanceKm } from "../lib/saved-locations";

describe("saved location distance", () => {
  it("measures the straight-line distance between two coordinates", () => {
    expect(straightLineDistanceKm(-36.913, 174.787, -36.904, 174.787)).toBeCloseTo(1.0, 1);
    expect(straightLineDistanceKm(-36.913, 174.787, -36.913, 174.787)).toBe(0);
  });
});
