import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import PropertyExplorer from "../app/components/property-explorer";
import type { Property } from "../lib/property-types";

const properties: Property[] = [
  {
    id: "modern-townhouse",
    address: "2/30 Hardington Street",
    suburb: "Onehunga",
    city: "Auckland",
    region: "Auckland",
    price: 740_000,
    bedrooms: 3,
    bathrooms: 2,
    landArea: 165,
    floorArea: 132,
    yearBuilt: 2021,
    propertyType: "Townhouse",
    architecturalStyle: "Modernist",
    floodRisk: "Low",
    orientation: "North",
    sunlightHours: 7.8,
    latitude: -36.913,
    longitude: 174.787,
    image: "/properties/test.jpg",
    imageAlt: "Modern townhouse",
  },
  {
    id: "character-villa",
    address: "54 Kelmarna Avenue",
    suburb: "Ponsonby",
    city: "Auckland",
    region: "Auckland",
    price: 2_525_000,
    bedrooms: 3,
    bathrooms: 1,
    landArea: 531,
    floorArea: 148,
    yearBuilt: 1912,
    propertyType: "Villa",
    architecturalStyle: "Character",
    floodRisk: "Moderate",
    orientation: "East",
    sunlightHours: 5.4,
    latitude: -36.849,
    longitude: 174.734,
    image: "/properties/test.jpg",
    imageAlt: "Character villa",
  },
];

const comparableSales: Property[] = [
  {
    ...properties[0],
    id: "comp-one",
    address: "31 Hardington Street",
    price: 760_000,
    latitude: -36.912,
    longitude: 174.788,
    soldDate: "2026-07-10",
  },
];

describe("PropertyExplorer", () => {
  it("filters by property type and clears back to all listings", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={properties} comparableSales={comparableSales} />);

    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Villa" }));

    expect(screen.queryByText("2/30 Hardington Street")).not.toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
  });

  it("applies an AI search and explains when there are no matches", async () => {
    const user = userEvent.setup();
    const aiSearch = async (query: string) => ({
      status: "ready" as const,
      filters: query.includes("villa")
        ? { propertyTypes: ["Villa" as const], location: "Auckland" }
        : { propertyTypes: ["Apartment" as const], location: "Wellington" },
      message: "I applied your property type and location.",
      source: "gemini" as const,
    });
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
        aiSearch={aiSearch}
      />,
    );

    const input = screen.getByRole("textbox", { name: /describe your ideal property/i });
    await user.type(input, "Find character villas in Auckland");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
      expect(screen.queryByText("2/30 Hardington Street")).not.toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, "Apartments in Wellington");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText(/no matching listings were found/i)).toBeInTheDocument();
  });

  it("compares selected homes side by side and removes a column", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={properties} comparableSales={comparableSales} />);

    await user.click(
      screen.getByRole("checkbox", { name: /compare 2\/30 hardington street/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /compare 54 kelmarna avenue/i }),
    );
    await user.click(screen.getAllByRole("button", { name: /compare 2 homes/i })[0]);

    const comparison = screen.getByRole("dialog", { name: /property comparison/i });
    expect(within(comparison).getByText("$740,000")).toBeInTheDocument();
    expect(within(comparison).getByText("$2,525,000")).toBeInTheDocument();

    await user.click(
      within(comparison).getByRole("button", { name: /remove 54 kelmarna avenue/i }),
    );
    expect(within(comparison).queryByText("$2,525,000")).not.toBeInTheDocument();
  });

  it("shows live comps, sunlight and mortgage tools in the property panel", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={properties} comparableSales={comparableSales} />);

    await user.click(
      screen.getByRole("button", { name: /view details for 2\/30 hardington street/i }),
    );
    const details = screen.getByRole("dialog", { name: /property details/i });

    await user.click(within(details).getByRole("button", { name: /comparable sales/i }));
    expect(within(details).getByText("31 Hardington Street")).toBeInTheDocument();
    expect(within(details).getByText("$760,000 average")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: /sunlight/i }));
    expect(within(details).getByText("7.8 hours/day")).toBeInTheDocument();
    expect(within(details).getByText("North-facing", { selector: "strong" })).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: /mortgage/i }));
    const initialPayment = within(details).getByTestId("monthly-repayment").textContent;
    fireEvent.change(within(details).getByLabelText(/deposit percentage/i), {
      target: { value: "30" },
    });
    expect(within(details).getByTestId("monthly-repayment").textContent).not.toBe(
      initialPayment,
    );
  });
});
