import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import PropertyExplorer from "../app/components/property-explorer";
import AIChatbot from "../app/components/ai-chatbot";
import PropertyDetailPage from "../app/components/property-detail-page";
import HomeLoading from "../app/loading";
import PropertyLoading from "../app/properties/[id]/loading";
import { properties } from "../lib/property-data";
import type { Property } from "../lib/property-types";

const longDescription =
  "Positioned on a prized elevated site in the heart of Auckland, this residence combines timeless architecture with effortless indoor-outdoor flow.\n\n" +
  "The main living pavilion opens directly onto landscaped gardens and a heated pool, while the bespoke kitchen features natural stone benchtops and scullery.\n\n" +
  "Upstairs accommodates four generous bedrooms including a master retreat with harbour outlooks, complemented by double internal-access garaging and off-street parking.";

const home: Property = {
  ...properties[0],
  id: "test-home",
  address: "12 Garden Street",
  image: "/first.jpg",
  photoGallery: ["/first.jpg", "/second.jpg", "/third.jpg", "/fourth.jpg"],
  summary: longDescription,
  teaser: "Elevated family sanctuary",
  capitalValue: 2_350_000,
  landValue: 1_550_000,
  improvementValue: 800_000,
  valuationDate: "2024-05-01",
  rateableValueChange: "+14% since 2021 CV",
  estimateLow: 2_250_000,
  estimateMedian: 2_480_000,
  estimateHigh: 2_720_000,
  estimateConfidence: "High",
  unitaryPlanZone: "Residential - Single House Zone",
  titleNumber: "NA12B/345",
  contour: "Level",
  construction: "Weatherboard / Iron",
  pastSales: [
    {
      date: "2021-11-15",
      price: 2_120_000,
      source: "OneRoof",
      saleType: "Unconditional Sale",
    },
  ],
  valuationHistory: [
    {
      source: "OneRoof AVM Estimate",
      date: "2026-10-01",
      value: 2_480_000,
      capitalValue: 2_480_000,
      lowEstimate: 2_250_000,
      medianEstimate: 2_480_000,
      highEstimate: 2_720_000,
    },
    {
      source: "Council RV",
      date: "2024-05-01",
      value: 2_350_000,
      capitalValue: 2_350_000,
      landValue: 1_550_000,
      improvementValue: 800_000,
    },
  ],
  propertyHistory: [
    {
      date: "2024-05-01",
      type: "cv",
      label: "Rateable Value Updated",
      value: "$2,350,000",
      detail: "+14% since 2021 CV",
    },
    {
      date: "2021-11-15",
      type: "sale",
      label: "Property Sold",
      value: "$2,120,000",
      detail: "Unconditional Sale",
    },
  ],
  floodHazards: [],
  schoolDataSynced: true,
  nearbySchools: [
    {
      schoolId: 1,
      name: "Garden School",
      orgType: "Primary",
      distanceKm: 1,
      latitude: -36.85,
      longitude: 174.76,
      hasEnrolmentZone: false,
      hasZoneGeometry: false,
    },
  ],
};
const other: Property = {
  ...home,
  id: "other-home",
  address: "14 Garden Street",
  price: home.price + 100_000,
};

it("mounts the comparison overlay outside the transformed page wrapper", async () => {
  const user = userEvent.setup();
  render(
    <div className="page-transition-wrapper">
      <PropertyExplorer properties={[home]} comparableSales={[]} />
    </div>,
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Compare 12 Garden Street" }),
  );
  expect(
    screen.getByRole("region", { name: "Your comparison" }).parentElement,
  ).toBe(document.body);
});

it("offers bathrooms in the basic filters and keeps architecture and schools expanded", async () => {
  const user = userEvent.setup();
  render(
    <PropertyExplorer
      properties={[
        { ...home, bathrooms: 2 },
        { ...other, bathrooms: 1 },
      ]}
      comparableSales={[]}
    />,
  );
  await user.click(screen.getByRole("radio", { name: "2 baths" }));
  expect(
    screen.getByRole("link", { name: /12 Garden Street/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /14 Garden Street/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /more filters/i }));
  expect(screen.getByRole("checkbox", { name: "Character" })).toBeVisible();
  expect(
    screen.getByRole("checkbox", { name: "Inside mapped school zone" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", {
      name: /Architecture & Era|Schools & Catchments/,
    }),
  ).not.toBeInTheDocument();
  await user.click(
    within(screen.getByLabelText("Bathrooms")).getByRole("radio", {
      name: "Any",
    }),
  );
  expect(
    screen.getByRole("link", { name: /14 Garden Street/ }),
  ).toBeInTheDocument();
});

it("does not apply a partial interpretation when Jev asks for clarification", async () => {
  const user = userEvent.setup();
  render(
    <PropertyExplorer
      properties={[home, { ...other, propertyType: "Apartment" }]}
      comparableSales={[]}
      aiSearch={async () => ({
        status: "needs-clarification",
        source: "jev",
        filters: { propertyTypes: ["Apartment"] },
        message: "Please clarify the bathroom range.",
      })}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Describe your ideal property" }),
    "a home with conflicting bathroom limits",
  );
  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("Please clarify the bathroom range.");
  expect(
    screen.getByRole("link", { name: /12 Garden Street/ }),
  ).toBeInTheDocument();
});

it("lets a manual bedroom selection replace an AI bedroom range", async () => {
  const user = userEvent.setup();
  render(
    <PropertyExplorer
      properties={[
        { ...home, bedrooms: 4 },
        { ...other, bedrooms: 2 },
      ]}
      comparableSales={[]}
      aiSearch={async () => ({
        status: "ready",
        source: "jev",
        filters: { numericCriteria: { bedrooms: { min: 3 } } },
        message: "At least three bedrooms.",
      })}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Describe your ideal property" }),
    "at least three bedrooms",
  );
  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("At least three bedrooms.");
  await user.click(screen.getByRole("radio", { name: "2 beds" }));
  expect(
    screen.getByRole("link", { name: /14 Garden Street/ }),
  ).toBeInTheDocument();
});

it("uses one second-photo image and a full-card property link with independent save and compare", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  render(<PropertyExplorer properties={[home]} comparableSales={[]} />);
  const card = screen.getByRole("article");
  expect(within(card).getAllByRole("img")).toHaveLength(1);
  expect(
    decodeURIComponent(within(card).getByRole("img").getAttribute("src")!),
  ).toContain("/second.jpg");
  expect(
    within(card).getByRole("link", { name: /12 Garden Street/ }),
  ).toHaveAttribute("href", "/properties/test-home");
  await user.click(
    within(card).getByRole("button", { name: "Save 12 Garden Street" }),
  );
  expect(localStorage.getItem("haven_saved_property_ids")).toContain(
    "test-home",
  );
  await user.click(
    within(card).getByRole("checkbox", { name: "Compare 12 Garden Street" }),
  );
  expect(
    screen.getByRole("region", { name: "Your comparison" }),
  ).toHaveTextContent("12 Garden Street");
});

it("expands extra filters above results and preserves them when collapsed", async () => {
  const user = userEvent.setup();
  render(<PropertyExplorer properties={[home]} comparableSales={[]} />);
  const more = screen.getByRole("button", { name: /more filters/i });
  expect(more).toHaveAttribute("aria-expanded", "false");
  await user.click(more);
  await user.selectOptions(
    screen.getByLabelText("Mapped flood hazard"),
    "none",
  );
  await user.click(more);
  expect(
    screen.getByRole("link", { name: /12 Garden Street/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Remove no mapped flood hazard filter",
    }),
  ).toBeInTheDocument();
});

it("offers sign in from the navigation in a keyboard dismissible modal", async () => {
  const user = userEvent.setup();
  render(<PropertyExplorer properties={[home]} comparableSales={[]} />);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  const modal = screen.getByRole("dialog", { name: /your account/i });
  expect(within(modal).getByLabelText("Email")).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("highlights the largest numeric values in the matrix and keeps comparison removable", async () => {
  const user = userEvent.setup();
  render(
    <PropertyExplorer
      properties={[
        { ...home, bedrooms: 2, floorArea: 90 },
        { ...other, bedrooms: 4, floorArea: 180 },
      ]}
      comparableSales={[]}
    />,
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Compare 12 Garden Street" }),
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Compare 14 Garden Street" }),
  );
  await user.click(screen.getByRole("button", { name: "Compare 2 homes" }));
  const dialog = screen.getByRole("dialog", { name: "Property comparison" });
  expect(within(dialog).getByRole("table")).toHaveTextContent(
    "12 Garden Street",
  );
  expect(within(dialog).queryByText("Walkability")).not.toBeInTheDocument();
  const table = within(dialog).getByRole("table");
  for (const label of ["Price", "Bedrooms", "Floor area"]) {
    const row = within(table)
      .getAllByRole("row")
      .find((row) => within(row).queryByRole("rowheader", { name: label }));
    const cells = within(row!).getAllByRole("cell");
    expect(cells[0]).not.toHaveAttribute("data-highlight");
    expect(cells[1]).toHaveAttribute("data-highlight");
  }
  expect(
    within(dialog).queryByRole("checkbox", { name: "Highlight differences" }),
  ).not.toBeInTheDocument();
  await user.click(
    within(dialog).getByRole("button", { name: "Remove 14 Garden Street" }),
  );
  expect(
    within(dialog).queryByRole("link", { name: "14 Garden Street" }),
  ).not.toBeInTheDocument();
});

it("renders collapsible property description, unified 3-mode map, non-collapsible market history, and mortgage calculator without comparable sales or fake sunlight", async () => {
  const user = userEvent.setup();
  render(<PropertyDetailPage property={home} />);

  // Collapsible description with Read more / Show less
  expect(
    screen.getByText(/Positioned on a prized elevated site/i),
  ).toBeInTheDocument();
  const readMoreBtn = screen.getByRole("button", { name: /Read more/i });
  await user.click(readMoreBtn);
  expect(
    screen.getByRole("button", { name: /Show less/i }),
  ).toBeInTheDocument();

  // No fake sunlight or comparable sales
  expect(screen.queryByText(/Orientation & Sunlight/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Comparable sales/i)).not.toBeInTheDocument();

  // Unified map modes: Schools is active by default and lists Garden School
  expect(screen.getByRole("tab", { name: /Schools/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getAllByText("Garden School").length).toBeGreaterThanOrEqual(1);

  // Market history & valuations and Mortgage calculator are visible directly without accordion clicks
  expect(
    screen.getByRole("heading", { name: /Market history & valuations/i }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("$2,480,000").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("$2,120,000").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByLabelText("Property price ($)")).toHaveValue(home.price);
});

it("renders immediate static headings on loading screens and uses skeletons only for loading content", () => {
  const { unmount } = render(<HomeLoading />);
  expect(screen.queryByText("Auckland, New Zealand")).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: /Find your kind of home\./i,
    }),
  ).toBeInTheDocument();
  unmount();

  render(<PropertyLoading />);
  expect(screen.getByRole("link", { name: /All homes/i })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /The neighbourhood/i }),
  ).toBeInTheDocument();
});

it("opens the second photo, advances with buttons and keys, and restores focus on close", async () => {
  const user = userEvent.setup();
  render(<PropertyDetailPage property={home} />);
  const opener = screen.getByRole("button", { name: "Open photo 1" });
  await user.click(opener);
  const dialog = screen.getByRole("dialog", {
    name: /photos of 12 garden street/i,
  });
  const current = () =>
    decodeURIComponent(within(dialog).getByRole("img").getAttribute("src")!);
  expect(current()).toContain("/second.jpg");
  await user.click(within(dialog).getByRole("button", { name: "Next photo" }));
  expect(current()).not.toContain("/second.jpg");
  await user.keyboard("{ArrowLeft}");
  expect(current()).toContain("/second.jpg");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

it("keeps property selection usable while the chat panel is open", async () => {
  const user = userEvent.setup();
  render(
    <>
      <PropertyExplorer properties={[home]} comparableSales={[]} />
      <AIChatbot />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Open AI chat" }));
  await user.click(
    screen.getByRole("checkbox", { name: "Compare 12 Garden Street" }),
  );
  expect(
    screen.getByRole("region", { name: "Your comparison" }),
  ).toHaveTextContent("12 Garden Street");
  expect(
    screen.getByRole("dialog", { name: "Haven AI Assistant" }),
  ).toBeInTheDocument();
});

it("renders main navigation with icons and shortened mobile labels, scrolls to centered calculator without 'Make the numbers work' text, and uses icons for property card stats", async () => {
  const user = userEvent.setup();
  render(<PropertyExplorer properties={[home]} comparableSales={[]} />);

  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: /Discover/i })).toHaveAttribute(
    "href",
    "/",
  );
  const calcLink = within(nav).getByRole("link", { name: /Calculator/i });
  expect(calcLink).toHaveAttribute("href", "/#calculator");
  expect(within(nav).getByRole("link", { name: /Workspace/i })).toHaveAttribute(
    "href",
    "/profile",
  );
  expect(nav.querySelectorAll("svg").length).toBe(3);

  // Saved homes button wraps text in .saved-homes-label so mobile CSS shows only the heart icon
  const savedBtn = screen.getByRole("link", { name: /Saved Homes/i });
  expect(savedBtn).toHaveAttribute("href", "/profile#saved-homes");
  expect(savedBtn.querySelector(".saved-homes-label")).not.toBeNull();

  // "Make the numbers work" and its subtext are removed, and clicking Calculator scrolls #calculator into view
  expect(screen.queryByText(/Make the numbers work/i)).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      /Explore estimated repayments and compare two fixed-rate loan options/i,
    ),
  ).not.toBeInTheDocument();

  const calcSection = document.getElementById("calculator");
  expect(calcSection).not.toBeNull();
  let scrolled = false;
  calcSection!.scrollIntoView = () => {
    scrolled = true;
  };
  await user.click(calcLink);
  expect(scrolled).toBe(true);

  const card = screen.getByRole("article");
  const specs = card.querySelector(".property-specs");
  expect(specs).not.toBeNull();
  expect(specs?.textContent).not.toMatch(/beds|baths/i);
  expect(
    specs?.querySelectorAll(".property-spec-item").length,
  ).toBeGreaterThanOrEqual(3);
  expect(specs?.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
});

it("does not auto-focus the AI chatbot text input when opened on mobile", async () => {
  const user = userEvent.setup();
  render(<AIChatbot />);
  await user.click(screen.getByRole("button", { name: "Open AI chat" }));
  const input = screen.getByRole("textbox", { name: /ask a question/i });
  expect(input).not.toHaveFocus();
});

it("auto-searches destination addresses, allows selecting a suggestion to query route and open in Google Maps, and omits unnecessary disclaimer and straight-line text", async () => {
  localStorage.clear();
  const originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("nominatim.openstreetmap.org")) {
      return new Response(
        JSON.stringify([
          {
            lat: "-36.8442",
            lon: "174.7678",
            display_name: "Britomart Station, Queen Street, Auckland CBD",
          },
          {
            lat: "-36.8485",
            lon: "174.7633",
            display_name: "Sky Tower, Victoria Street West, Auckland CBD",
          },
        ]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;

  try {
    const user = userEvent.setup();
    render(<PropertyDetailPage property={home} />);

    await user.click(screen.getByRole("tab", { name: /Commute/i }));

    // Unnecessary disclaimer text should be gone
    expect(
      screen.queryByText(/Saved privately to your account/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved on this device/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add destination" }));
    const addressInput = screen.getByRole("textbox", {
      name: "Address for destination 1",
    });
    await user.type(addressInput, "Britomart");

    // Wait for auto-search suggestion option and select it
    const suggestion = await screen.findByRole(
      "option",
      { name: /Britomart Station/i },
      { timeout: 2500 },
    );
    await user.click(suggestion);

    // Address input updates to the selected suggestion
    expect(addressInput).toHaveValue(
      "Britomart Station, Queen Street, Auckland CBD",
    );

    // Distance badge is simplified without "straight-line"
    expect(screen.queryByText(/straight-line/i)).not.toBeInTheDocument();

    // Link to open in Google Maps in a new tab is displayed
    const mapsLink = screen.getByRole("link", {
      name: /Open in Google Maps/i,
    });
    expect(mapsLink).toHaveAttribute("target", "_blank");
    expect(mapsLink.getAttribute("href")).toContain("google.com/maps/dir/");
  } finally {
    global.fetch = originalFetch;
  }
});

it("reflects combined AI filters in the editable controls without showing a range as an exact count", async () => {
  const user = userEvent.setup();
  render(
    <PropertyExplorer
      properties={[home, other]}
      comparableSales={[]}
      aiSearch={async () => ({
        status: "ready",
        source: "jev",
        message: "Combined filters applied.",
        filters: {
          propertyTypes: ["House", "Townhouse"],
          numericCriteria: {
            bedrooms: { min: 3, max: 3 },
            bathrooms: { min: 2 },
            parkingSpaces: { min: 4 },
            landArea: { min: 600 },
          },
          yearBuiltFrom: 2000,
          maxPrice: 1_200_000,
        },
      })}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Describe your ideal property" }),
    "three bedrooms and parking for four",
  );
  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("Combined filters applied.");
  expect(screen.getByRole("button", { name: "House" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Townhouse" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("radio", { name: "3 beds" })).toBeChecked();
  expect(screen.getAllByText("Bathrooms ≥ 2").length).toBeGreaterThan(0);
  expect(
    within(screen.getByLabelText("Bathrooms")).getByRole("radio", {
      name: "Any",
    }),
  ).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "More filters" }));
  expect(screen.getByLabelText("Minimum parking spaces")).toHaveValue(4);
  expect(screen.getByLabelText("Minimum land area")).toHaveValue(600);
  expect(screen.getByLabelText("Built from")).toHaveValue("2000");
  await user.click(
    screen.getByRole("button", { name: "Clear property search" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Describe your ideal property" }),
  ).toHaveValue("");
  expect(screen.getByLabelText("Minimum parking spaces")).toHaveValue(null);
});

it("switches the mobile search action from loading to clear and prevents a cleared search from restoring old filters", async () => {
  const user = userEvent.setup();
  let finish!: (value: {
    status: "ready";
    source: "jev";
    message: string;
    filters: { location: string };
  }) => void;
  render(
    <PropertyExplorer
      properties={[home]}
      comparableSales={[]}
      aiSearch={() =>
        new Promise((resolve) => {
          finish = resolve;
        })
      }
    />,
  );
  const input = screen.getByRole("textbox", {
    name: "Describe your ideal property",
  });
  expect(
    screen.getByRole("button", { name: "Search properties" }),
  ).toBeInTheDocument();
  await user.type(input, "Ponsonby");
  await user.click(screen.getByRole("button", { name: "Search" }));
  expect(
    screen.getByRole("button", { name: "Searching properties" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Clear search query" }));
  await act(async () =>
    finish({
      status: "ready",
      source: "jev",
      message: "Old search applied",
      filters: { location: "Ponsonby" },
    }),
  );
  await screen.findByRole("button", { name: "Search properties" });
  expect(input).toHaveValue("");
  expect(screen.getByLabelText("Location / Suburb")).toHaveValue("");
  expect(screen.queryByText("Old search applied")).not.toBeInTheDocument();
});
