import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PropertyExplorer from "../app/components/property-explorer";
import { aucklandProperties as seededProperties } from "../lib/property-data";
import { floodHazardDisclaimer } from "../lib/flood-hazards";
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
    floodHazards: [
      {
        type: "flood_plains",
        sourceFeatureId: "1",
        sourceUrl: "https://council.example/flood-plains",
      },
    ],
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
    floodHazards: [],
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

  it("filters listings by imported Council flood hazard categories", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={properties} comparableSales={comparableSales} />);

    const floodFilter = screen.getByRole("combobox", { name: "Mapped flood hazard" });
    await user.selectOptions(floodFilter, "flood_plains");

    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.queryByText("54 Kelmarna Avenue")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove flood hazard Flood plains" }));
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    await user.selectOptions(floodFilter, "none");
    expect(screen.queryByText("2/30 Hardington Street")).not.toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove no mapped flood hazard filter" }));
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

    await user.click(within(details).getByRole("button", { name: "Flood risk" }));
    expect(within(details).getByText("Flood plains")).toBeInTheDocument();
    expect(
      within(details).getByText(
        "Council mapping identifies this property location within Flood plains. These layers map potential inundation areas or surface-water flow paths and do not establish site-specific flood depth or likelihood.",
      ),
    ).toBeInTheDocument();
    expect(within(details).getByText(floodHazardDisclaimer)).toBeInTheDocument();

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

  it("saves up to three commute destinations and updates the directions mode", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<PropertyExplorer properties={properties} comparableSales={comparableSales} />);

    await user.click(
      screen.getByRole("button", { name: /view details for 2\/30 hardington street/i }),
    );
    const details = screen.getByRole("dialog", { name: /property details/i });
    await user.click(within(details).getByRole("button", { name: "Commute" }));
    await user.click(within(details).getByRole("button", { name: "Add destination" }));

    await user.type(within(details).getByRole("textbox", { name: "Name for destination 1" }), "Work");
    await user.type(
      within(details).getByRole("textbox", { name: "Address for destination 1" }),
      "1 Queen Street, Auckland",
    );
    await user.click(within(details).getByRole("button", { name: "Add destination" }));
    await user.click(within(details).getByRole("button", { name: "Add destination" }));
    expect(within(details).getByRole("button", { name: "Add destination" })).toBeDisabled();

    await user.click(within(details).getByRole("button", { name: "Public transport" }));
    const directions = new URL(
      within(details).getByRole("link", { name: "Open directions" }).getAttribute("href")!,
    );
    expect(directions.searchParams.get("travelmode")).toBe("transit");
    expect(directions.searchParams.get("origin")).toBe("-36.913,174.787");
    expect(directions.searchParams.get("destination")).toBe("1 Queen Street, Auckland");
    expect(window.localStorage.getItem("ai-real-estate-commute-destinations")).toContain("Work");

    await user.click(within(details).getByRole("button", { name: "Overview" }));
    await user.click(within(details).getByRole("button", { name: "Commute" }));
    expect(within(details).getByRole("textbox", { name: "Address for destination 1" })).toHaveValue(
      "1 Queen Street, Auckland",
    );
  });

  it("opens source details from an inline property citation", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={[seededProperties[0]]} comparableSales={[]} />);
    await user.click(
      screen.getByRole("button", { name: /view details for 59 israel avenue/i }),
    );

    const details = screen.getByRole("dialog", { name: /property details/i });
    await user.click(
      within(details).getByRole("button", { name: /view source 1 for bedrooms/i }),
    );

    const sourceDetails = screen.getByRole("dialog", { name: /source details/i });
    expect(within(sourceDetails).getByText(/realestate public property page/i)).toBeInTheDocument();
    expect(within(sourceDetails).getByText(/direct page snapshot/i)).toBeInTheDocument();
    expect(
      within(sourceDetails).getByRole("link", { name: /open original source/i }),
    ).toHaveAttribute(
      "href",
      seededProperties[0].sources?.find(source => source.publisher === "RealEstate")?.url,
    );
  });

  it("shows a map point and photo source for a directly collected house", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={[seededProperties[0]]} comparableSales={[]} />);
    await user.click(screen.getByRole("button", { name: /view details for 59 israel avenue/i }));
    const details = screen.getByRole("dialog", { name: /property details/i });
    expect(within(details).getByTitle(/map of 59 israel avenue/i)).toHaveAttribute("src", expect.stringContaining("openstreetmap.org"));
    expect(within(details).getByRole("link", { name: /photo source/i })).toHaveAttribute("href", seededProperties[0].imageSourceUrl);
  });

  it("does not render 'Verified address' badge when property has no architectural style", () => {
    const propertyWithoutStyle: Property = {
      ...properties[0],
      architecturalStyle: undefined,
    };
    const { container } = render(
      <PropertyExplorer properties={[propertyWithoutStyle]} comparableSales={[]} />,
    );

    expect(screen.queryByText("Verified address")).not.toBeInTheDocument();
    expect(container.querySelector(".style-badge")).toBeNull();
  });

  it("executes real-time debounced search as user types and syncs filters", async () => {
    const user = userEvent.setup();
    const mockAiSearch = vi.fn().mockImplementation(async (query: string) => ({
      status: "ready" as const,
      filters: query.includes("villa")
        ? { propertyTypes: ["Villa" as const], location: "Auckland" }
        : {},
      message: "Showing matching character villas.",
      source: "jev" as const,
    }));

    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
        aiSearch={mockAiSearch}
      />,
    );

    const input = screen.getByRole("textbox", { name: /describe your ideal property/i });
    await user.type(input, "villa");

    // Wait for debounced search to trigger automatically without hitting submit button
    await waitFor(() => {
      expect(mockAiSearch).toHaveBeenCalledWith("villa");
    }, { timeout: 1500 });

    await waitFor(() => {
      expect(screen.getByText("TypeSafe Jev interpreted")).toBeInTheDocument();
      expect(screen.getByText("Showing matching character villas.")).toBeInTheDocument();
      expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
    });

    // Clear search using clear button
    const clearButton = screen.getByRole("button", { name: /clear search query/i });
    await user.click(clearButton);
    expect(input).toHaveValue("");
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
  });

  it("updates listings in real-time when sidebar location and bedroom controls change", async () => {
    const user = userEvent.setup();
    render(<PropertyExplorer properties={properties} comparableSales={comparableSales} />);

    // Select Location filter
    const locationSelect = screen.getByLabelText("Location / Suburb");
    await user.selectOptions(locationSelect, "Onehunga");
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.queryByText("54 Kelmarna Avenue")).not.toBeInTheDocument();

    // Reset location
    await user.selectOptions(locationSelect, "");
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    // Select 1 bed filter (neither sample home in test fixture has 1 bed)
    await user.click(screen.getByRole("button", { name: "1 bed" }));
    expect(screen.queryByText("2/30 Hardington Street")).not.toBeInTheDocument();
    expect(screen.queryByText("54 Kelmarna Avenue")).not.toBeInTheDocument();

    // Clear filter
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
  });
});
