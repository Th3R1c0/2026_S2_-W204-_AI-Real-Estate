"use client";

import { useEffect, useRef } from "react";
import type { SavedLocation } from "../../lib/saved-locations";

export default function PropertyLocationMap({
  latitude,
  longitude,
  address,
  locations,
}: {
  latitude: number;
  longitude: number;
  address: string;
  locations: SavedLocation[];
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    import("leaflet").then((leaflet) => {
      if (cancelled || !container.current) return;
      map = leaflet.map(container.current).setView([latitude, longitude], 15);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const propertyLabel = document.createElement("span");
      propertyLabel.textContent = address;
      leaflet.circleMarker([latitude, longitude], {
        radius: 9, color: "#163f32", fillColor: "#285e4a", fillOpacity: 1,
      }).addTo(map).bindTooltip(propertyLabel);

      const points: [number, number][] = [[latitude, longitude]];
      locations.forEach((location) => {
        if (location.latitude === undefined || location.longitude === undefined) return;
        const point: [number, number] = [location.latitude, location.longitude];
        points.push(point);
        const label = document.createElement("span");
        label.textContent = location.name || location.address;
        leaflet.circleMarker(point, {
          radius: 8, color: "#a35a27", fillColor: "#e48b50", fillOpacity: 1,
        }).addTo(map!).bindTooltip(label, { permanent: true, direction: "top", offset: [0, -8] });
        leaflet.polyline([[latitude, longitude], point], { color: "#a35a27", dashArray: "5 6" }).addTo(map!);
      });
      if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [latitude, longitude, address, locations]);

  return <div aria-label={`Map of ${address}`} className="property-location-map" ref={container} role="region" />;
}
