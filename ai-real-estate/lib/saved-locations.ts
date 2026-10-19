export type SavedLocation = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

export function straightLineDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const arc = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(arc));
}

export const commuteStorageKey = "ai-real-estate-commute-destinations";

export function readSavedLocations(): SavedLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(commuteStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.name === "string" && typeof item.address === "string")
      .slice(0, 3)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `legacy-${index}`,
        name: item.name,
        address: item.address,
        ...(Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
          ? { latitude: item.latitude, longitude: item.longitude }
          : {}),
      }));
  } catch { return []; }
}
