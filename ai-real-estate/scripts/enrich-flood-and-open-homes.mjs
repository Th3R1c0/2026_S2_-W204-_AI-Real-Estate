import { readFile, writeFile } from "node:fs/promises";

const ARCGIS_SERVICES =
  "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services";

const FLOOD_DATASETS = [
  {
    hazardType: "flood_plains",
    serviceName: "Flood_Plains",
    distanceMeters: 20,
  },
  {
    hazardType: "flood_prone_areas",
    serviceName: "Flood_Prone_Areas",
    distanceMeters: 20,
  },
  {
    hazardType: "overland_flow_paths",
    serviceName: "Overland_Flow_Paths",
    distanceMeters: 25,
  },
  {
    hazardType: "coastal_inundation",
    serviceName: "Coastal_Inundation_100_yr_return",
    distanceMeters: 20,
  },
];

async function queryFloodHazardsForPoint(latitude, longitude) {
  const results = await Promise.all(
    FLOOD_DATASETS.map(async (dataset) => {
      const sourceUrl = `${ARCGIS_SERVICES}/${dataset.serviceName}/FeatureServer/0`;
      const queryUrl = new URL(`${sourceUrl}/query`);
      queryUrl.search = new URLSearchParams({
        where: "1=1",
        geometry: `${longitude},${latitude}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        distance: String(dataset.distanceMeters),
        units: "esriSRUnit_Meter",
        outFields: "*",
        returnGeometry: "false",
        f: "json",
      }).toString();

      try {
        const response = await fetch(queryUrl, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        if (features.length > 0) {
          const attrs = features[0]?.attributes ?? {};
          const idKey = Object.keys(attrs).find(
            (k) => k.toLowerCase() === "objectid",
          );
          const sourceFeatureId = idKey ? String(attrs[idKey]) : "1";
          return {
            type: dataset.hazardType,
            sourceFeatureId,
            sourceUrl,
          };
        }
      } catch {
        // Ignore network errors per layer
      }
      return null;
    }),
  );

  return results.filter(Boolean);
}

function parseOpenHomesFromHtml(html, rawTitle = "") {
  const openHomes = [];
  const seen = new Set();

  const scriptMatches = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi),
  ];
  for (const match of scriptMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && item["@type"] === "Event" && item.startDate) {
          const start = new Date(item.startDate);
          const end = item.endDate
            ? new Date(item.endDate)
            : new Date(start.getTime() + 30 * 60_000);
          if (Number.isNaN(start.getTime())) continue;

          const nzDate = start.toLocaleDateString("en-CA", {
            timeZone: "Pacific/Auckland",
          });
          const nzStartTime = start.toLocaleTimeString("en-GB", {
            timeZone: "Pacific/Auckland",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const nzEndTime = end.toLocaleTimeString("en-GB", {
            timeZone: "Pacific/Auckland",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const displayDay = start.toLocaleDateString("en-NZ", {
            timeZone: "Pacific/Auckland",
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          const timeRange =
            typeof item.name === "string" && item.name.includes("-")
              ? item.name.replace(/^Open Home\s*-\s*/i, "").trim()
              : `${nzStartTime} - ${nzEndTime}`;
          const key = `${nzDate}-${nzStartTime}`;
          if (!seen.has(key)) {
            seen.add(key);
            openHomes.push({
              date: nzDate,
              startTime: nzStartTime,
              endTime: nzEndTime,
              label: `${displayDay}, ${timeRange}`,
            });
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  if (openHomes.length === 0 && rawTitle) {
    const lines = rawTitle.split("\n").map((l) => l.trim());
    for (const line of lines) {
      const match = /^Open Home\s+(.+)$/i.exec(line);
      if (match) {
        const parsedDate = new Date(`${match[1]} 12:00:00 GMT+1300`);
        const isoDate = !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toLocaleDateString("en-CA", {
              timeZone: "Pacific/Auckland",
            })
          : "2026-10-24";
        openHomes.push({
          date: isoDate,
          startTime: "12:00",
          endTime: "12:30",
          label: `${match[1]}, 12:00pm - 12:30pm`,
        });
      }
    }
  }

  return openHomes;
}

async function main() {
  const harvestUrl = new URL(
    "../reports/forsale-raw-harvest.json",
    import.meta.url,
  );
  const harvest = JSON.parse(await readFile(harvestUrl, "utf8"));

  console.log(
    `Enriching ${harvest.length} properties with Auckland Council flood hazards & OneRoof open homes...`,
  );

  let floodHitCount = 0;
  let openHomeHitCount = 0;
  const batchSize = 8;

  for (let start = 0; start < harvest.length; start += batchSize) {
    const batch = harvest.slice(start, start + batchSize);
    await Promise.all(
      batch.map(async (entry, bIdx) => {
        const i = start + bIdx;
        const oLat = entry.oneRoofData?.latitude;
        const oLng = entry.oneRoofData?.longitude;
        const lLat = entry.linz?.latitude;
        const lLng = entry.linz?.longitude;

        if (
          oLat &&
          lLat &&
          (Math.abs(oLat - lLat) > 0.05 || Math.abs(oLng - lLng) > 0.05)
        ) {
          console.log(
            `Fixing mismatched LINZ coordinates on #${i + 1} (${entry.oneRoofData?.address}): removing ${entry.linz?.fullAddress}`,
          );
          entry.linz = null;
        }

        const lat =
          entry.linz?.latitude ??
          entry.oneRoofData?.latitude ??
          entry.homesDetails?.coordinates?.latitude ??
          -36.85;
        const lng =
          entry.linz?.longitude ??
          entry.oneRoofData?.longitude ??
          entry.homesDetails?.coordinates?.longitude ??
          174.76;
        const url = entry.item?.url;
        const rawTitle = entry.item?.title ?? "";

        const [floodHazards, openHomes] = await Promise.all([
          queryFloodHazardsForPoint(lat, lng),
          (async () => {
            if (!url) return parseOpenHomesFromHtml("", rawTitle);
            try {
              const res = await fetch(url, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                },
                signal: AbortSignal.timeout(15_000),
              });
              if (!res.ok) return parseOpenHomesFromHtml("", rawTitle);
              const html = await res.text();
              return parseOpenHomesFromHtml(html, rawTitle);
            } catch {
              return parseOpenHomesFromHtml("", rawTitle);
            }
          })(),
        ]);

        entry.floodHazards = floodHazards;
        entry.openHomes = openHomes;

        if (floodHazards.length > 0) floodHitCount += 1;
        if (openHomes.length > 0) openHomeHitCount += 1;

        console.log(
          `[${i + 1}/${harvest.length}] ${entry.oneRoofData?.street || entry.parsedTitle?.address}: ${floodHazards.length} flood hazard(s) [${floodHazards.map((h) => h.type).join(", ")}], ${openHomes.length} open home(s)`,
        );
      }),
    );
  }

  await writeFile(harvestUrl, JSON.stringify(harvest, null, 2));
  console.log(
    `Saved enriched harvest: ${floodHitCount} properties with mapped flood hazards, ${openHomeHitCount} properties with open homes.`,
  );
}

await main();
