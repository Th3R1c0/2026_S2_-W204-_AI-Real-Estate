import { render, screen, within } from "@testing-library/react";
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

it("keeps comparison removable and shows differences in an accessible table", async () => {
  const user = userEvent.setup();
  render(<PropertyExplorer properties={[home, other]} comparableSales={[]} />);
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
  await user.click(
    within(dialog).getByRole("checkbox", { name: "Highlight differences" }),
  );
  expect(within(dialog).getByRole("table")).toHaveTextContent("Price");
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
  expect(screen.getByText("Auckland, New Zealand")).toBeInTheDocument();
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
  expect(
    within(nav).getByRole("link", { name: /Workspace/i }),
  ).toHaveAttribute("href", "/profile");
  expect(nav.querySelectorAll("svg").length).toBe(3);

  // Saved homes button wraps text in .saved-homes-label so mobile CSS shows only the heart icon
  const savedBtn = screen.getByRole("button", { name: /Saved Homes/i });
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
  expect(specs?.querySelectorAll(".property-spec-item").length).toBeGreaterThanOrEqual(3);
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
    expect(
      screen.queryByText(/Saved on this device/i),
    ).not.toBeInTheDocument();

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


