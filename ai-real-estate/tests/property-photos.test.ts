import { expect, it } from "vitest";
import { propertyPhotos } from "../lib/property-photos";

it("keeps the second photo first and removes the first, primary, and duplicate images", () => {
  const home = {
    id: "home",
    image: "/first.jpg",
    photoGallery: [
      "/first.jpg",
      "/second.jpg",
      "/first.jpg",
      "/third.jpg",
      "/second.jpg",
      "/fourth.jpg",
    ],
  };
  const photos = propertyPhotos(home);
  expect(photos[0]).toBe("/second.jpg");
  expect([...photos].sort()).toEqual([
    "/fourth.jpg",
    "/second.jpg",
    "/third.jpg",
  ]);
  expect(propertyPhotos(home)).toEqual(photos);
});

it.each([undefined, [], ["/first.jpg"]])(
  "uses a neutral placeholder when there is no eligible second photo: %j",
  (photoGallery) => {
    expect(
      propertyPhotos({ id: "home", image: "/first.jpg", photoGallery }),
    ).toEqual(["/properties/address-placeholder.svg"]);
  },
);

it("excludes a primary image even when it also appears later in the gallery", () => {
  expect(
    propertyPhotos({
      id: "home",
      image: "/primary.jpg",
      photoGallery: ["/first.jpg", "/second.jpg", "/primary.jpg"],
    }),
  ).toEqual(["/second.jpg"]);
});
