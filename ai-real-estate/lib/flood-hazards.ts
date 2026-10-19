import type { FloodHazardType, PropertyFloodHazard } from "./property-types";

export const floodHazardOptions: Array<{ type: FloodHazardType; label: string }> = [
  { type: "flood_plains", label: "Flood plains" },
  { type: "flood_prone_areas", label: "Flood-prone areas" },
  { type: "overland_flow_paths", label: "Overland flow paths" },
  { type: "coastal_inundation", label: "Coastal inundation" },
];

export const floodHazardDisclaimer =
  "Auckland Council data indicates this property intersects a mapped flood hazard area. This information is provided for research and property discovery and should not replace a LIM, property file, or professional assessment.";

export function describeFloodHazards(hazards: PropertyFloodHazard[]): string {
  const labels = floodHazardOptions
    .filter(({ type }) => hazards.some((hazard) => hazard.type === type))
    .map(({ label }) => label);

  return `Council mapping identifies this property location within ${labels.join(", ")}. These layers map potential inundation areas or surface-water flow paths and do not establish site-specific flood depth or likelihood.`;
}
