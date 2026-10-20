import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import PropertyExplorer from "../app/components/property-explorer";
import MortgageCalculatorSheet from "../app/components/mortgage-calculator-sheet";
import { properties } from "../lib/property-data";

const route = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => {
  vi.unstubAllGlobals();
  route.pathname = null;
  window.history.replaceState(null, "", "/");
});

it("marks Discover as current on the homepage before pathname hydration", () => {
  render(
    <PropertyExplorer
      properties={properties.slice(0, 1)}
      comparableSales={[]}
    />,
  );
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: "Discover" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

it("keeps only the logo and sign in in the top bar, with navigation in a bottom bar", () => {
  render(
    <PropertyExplorer
      properties={properties.slice(0, 1)}
      comparableSales={[]}
    />,
  );
  const header = screen.getByRole("banner");
  const nav = within(header).getByRole("navigation", {
    name: "Main navigation",
  });

  // Navigation links live in the bottom nav, not in a desktop top row.
  expect(within(nav).getByRole("link", { name: "Discover" })).toHaveClass(
    "nav-item-discover",
  );
  expect(
    within(nav).getByRole("link", { name: "Mortgage calculator" }),
  ).toHaveAttribute("href", "#calculator");
  expect(header).toHaveClass("site-header");
  expect(within(header).getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(within(header).getByRole("link", { name: "Haven home" })).toBeVisible();
});

it("opens the mortgage calculator in a bottom sheet instead of a page section", async () => {
  const user = userEvent.setup();
  render(
    <>
      <PropertyExplorer
        properties={properties.slice(0, 1)}
        comparableSales={[]}
      />
      <MortgageCalculatorSheet />
    </>,
  );

  // There is no inline calculator section any more.
  expect(document.getElementById("calculator")).toBeNull();

  await user.click(
    screen.getByRole("link", { name: "Mortgage calculator" }),
  );
  await waitFor(() => {
    expect(document.querySelector(".mortgage-sheet")).not.toBeNull();
  });
  expect(document.querySelector(".mortgage-sheet")).not.toBeNull();
  // Dispatching the close event dismisses the sheet.
  act(() => {
    window.dispatchEvent(new Event("haven:close-mortgage-calculator"));
  });
  await waitFor(() =>
    expect(
      Array.from(document.querySelectorAll(".mortgage-sheet-overlay")).every(
        (node) => node.getAttribute("data-state") !== "open",
      ),
    ).toBe(true),
  );
});

it("opens the calculator dialog explicitly", async () => {
  const user = userEvent.setup();
  render(
    <>
      <PropertyExplorer
        properties={properties.slice(0, 1)}
        comparableSales={[]}
      />
      <MortgageCalculatorSheet />
    </>,
  );
  window.dispatchEvent(new Event("haven:open-mortgage-calculator"));
  expect(await screen.findByText("Mortgage calculator")).toBeInTheDocument();
  expect(document.querySelector(".mortgage-sheet-overlay")).not.toBeNull();
  window.dispatchEvent(new Event("haven:close-mortgage-calculator"));
  await waitFor(() =>
    expect(
      Array.from(document.querySelectorAll(".mortgage-sheet-overlay")).every(
        (node) => node.getAttribute("data-state") !== "open",
      ),
    ).toBe(true),
  );
  await user.keyboard("{Escape}");
});
