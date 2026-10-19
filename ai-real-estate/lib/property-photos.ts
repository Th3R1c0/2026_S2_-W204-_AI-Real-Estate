import type { Property } from "./property-types";

/** Second source photo first; the remaining photos are mixed consistently per home. */
export function propertyPhotos(
  property: Pick<Property, "id" | "image" | "photoGallery">,
): string[] {
  const gallery = property.photoGallery ?? [];
  const photos = Array.from(
    new Set(
      gallery
        .slice(1)
        .filter(
          (url) => Boolean(url) && url !== property.image && url !== gallery[0],
        ),
    ),
  );
  if (!photos.length) return ["/properties/address-placeholder.svg"];
  let seed = Array.from(property.id).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    1,
  );
  for (let index = photos.length - 1; index > 1; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = 1 + (seed % index);
    [photos[index], photos[target]] = [photos[target], photos[index]];
  }
  return photos;
}
