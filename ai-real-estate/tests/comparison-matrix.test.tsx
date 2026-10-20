import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import ComparisonMatrix from "../app/components/comparison-matrix";
import { properties } from "../lib/property-data";

it("highlights tied maxima while leaving missing values and nonnumeric facts unranked", () => {
  render(
    <ComparisonMatrix
      properties={[
        {
          ...properties[0],
          id: "one",
          price: 800_000,
          bedrooms: 3,
          floorArea: 0,
        },
        {
          ...properties[0],
          id: "two",
          price: 1_200_000,
          bedrooms: 4,
          floorArea: 180,
        },
        {
          ...properties[0],
          id: "three",
          price: 1_200_000,
          bedrooms: 4,
          floorArea: 200,
        },
      ]}
      onRemove={() => {}}
    />,
  );
  const rows = screen.getAllByRole("row");
  const cells = (label: string) =>
    within(
      rows.find((row) =>
        within(row).queryByRole("rowheader", { name: label }),
      )!,
    ).getAllByRole("cell");
  expect(
    cells("Price").map((cell) => cell.hasAttribute("data-highlight")),
  ).toEqual([false, true, true]);
  expect(
    cells("Bedrooms").map((cell) => cell.hasAttribute("data-highlight")),
  ).toEqual([false, true, true]);
  expect(cells("Floor area")[0]).toHaveTextContent("Not provided");
  expect(
    cells("Floor area").map((cell) => cell.hasAttribute("data-highlight")),
  ).toEqual([false, false, true]);
  expect(
    cells("Ownership").some((cell) => cell.hasAttribute("data-highlight")),
  ).toBe(false);
});

it("lets the user turn numerical highlights off and back on without changing the figures", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(
    <ComparisonMatrix
      properties={[
        { ...properties[0], id: "one", price: 800_000 },
        { ...properties[0], id: "two", price: 1_200_000 },
      ]}
      onRemove={() => {}}
    />,
  );
  const toggle = screen.getByRole("switch", {
    name: "Highlight largest values",
  });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(
    screen.getByRole("table").querySelectorAll("[data-highlight]"),
  ).toHaveLength(0);
  expect(screen.getByRole("table")).toHaveTextContent("$1,200,000");
  await user.click(toggle);
  const price = within(
    screen
      .getAllByRole("row")
      .find((row) => within(row).queryByRole("rowheader", { name: "Price" }))!,
  ).getAllByRole("cell");
  expect(price[1]).toHaveAttribute("data-highlight");
});
