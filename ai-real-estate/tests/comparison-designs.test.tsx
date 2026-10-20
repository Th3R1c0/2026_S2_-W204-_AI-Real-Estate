import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import ComparisonDesigns from "../app/components/comparison-designs";
import { properties } from "../lib/property-data";

it("shows four distinct comparison layouts and switches all of them between two and three homes", async () => {
  const user = userEvent.setup();
  const homes = properties.slice(0, 3);
  render(<ComparisonDesigns properties={homes} />);
  for (const name of [
    "The visual matrix",
    "Property passports",
    "The numbers view",
    "The trade-off board",
  ]) {
    const design = screen.getByRole("region", { name });
    expect(
      within(design).getAllByRole("link", { name: homes[0].address }).length,
    ).toBeGreaterThan(0);
    expect(
      within(design).queryByRole("link", { name: homes[2].address }),
    ).not.toBeInTheDocument();
  }
  await user.click(screen.getByRole("radio", { name: "3 properties" }));
  for (const name of [
    "The visual matrix",
    "Property passports",
    "The numbers view",
    "The trade-off board",
  ]) {
    expect(
      within(screen.getByRole("region", { name })).getAllByRole("link", {
        name: homes[2].address,
      }).length,
    ).toBeGreaterThan(0);
  }
});
