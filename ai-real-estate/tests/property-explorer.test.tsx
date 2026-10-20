import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PropertyDetailPage from "../app/components/property-detail-page";
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
    floodRisk: "Low",
    floodHazards: [
      {
        type: "flood_plains",
        sourceFeatureId: "1",
        sourceUrl: "https://council.example/flood-plains",
      },
    ],
    latitude: -36.913,
    longitude: 174.787,
    schoolDataSynced: true,
    nearbySchools: [
      {
        schoolId: 1327,
        name: "Kauri Park School",
        orgType: "Contributing",
        distanceKm: 1.24,
        hasEnrolmentZone: true,
        hasZoneGeometry: true,
      },
      {
        schoolId: 1500,
        name: "Example Secondary",
        orgType: "Secondary",
        distanceKm: 2.1,
        hasEnrolmentZone: false,
        hasZoneGeometry: false,
      },
    ],
    schoolZones: [
      {
        schoolId: 1327,
        schoolName: "Kauri Park School",
        schoolType: "Contributing",
        zoneName: "Kauri Park School Zone",
        zoneType: "Contributing",
      },
    ],
    image: "/properties/test.jpg",
    imageAlt: "Modern townhouse",
    listingAgent: {
      name: "Casey Agent",
      source: "OneRoof",
      contactUrl: "https://www.oneroof.co.nz/property/example-listing",
    },
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
    floodRisk: "Moderate",
    floodHazards: [],
    latitude: -36.849,
    longitude: 174.734,
    schoolDataSynced: true,
    nearbySchools: [
      {
        schoolId: 1500,
        name: "Example Secondary",
        orgType: "Secondary",
        distanceKm: 2.3,
        hasEnrolmentZone: false,
        hasZoneGeometry: false,
      },
    ],
    schoolZones: [],
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
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
      />,
    );

    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Villa" }));

    expect(
      screen.queryByText("2/30 Hardington Street"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /clear all filters/i }),
    );
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
  });

  it("filters listings by flood risk level", async () => {
    const user = userEvent.setup();
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More filters" }));
    const floodFilter = screen.getByRole("combobox", { name: "Flood risk" });
    expect(floodFilter).toHaveValue("none");

    // Low risk: any mapped overland flow path is excluded with the others.
    await user.selectOptions(floodFilter, "exclude_low");
    expect(screen.queryByText("2/30 Hardington Street")).not.toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove flood risk filter" }),
    );
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();

    // High risk: flood-prone / overland flow path listings are excluded, but
    // flood plains and coastal inundation are still allowed.
    await user.selectOptions(floodFilter, "exclude_high");
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    await user.selectOptions(floodFilter, "none");
    expect(screen.getByRole("combobox", { name: "Flood risk" })).toHaveValue(
      "none",
    );
  });

  it("matches free-text schools, several at once, and no longer offers a school dropdown", async () => {
    const user = userEvent.setup();
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
        schoolDataSynced
        schoolOptions={[
          {
            schoolId: 1327,
            name: "Kauri Park School",
            orgType: "Contributing",
            hasEnrolmentZone: true,
            hasZoneGeometry: true,
            hasCoordinates: true,
          },
          {
            schoolId: 1500,
            name: "Example Secondary",
            orgType: "Secondary",
            hasEnrolmentZone: false,
            hasZoneGeometry: false,
            hasCoordinates: true,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.queryByLabelText("Search by school")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Nearby school type/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Near a school/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Inside mapped school zone/ }),
    ).not.toBeInTheDocument();

    const schoolInput = screen.getByRole("textbox", { name: "School" });
    await user.type(schoolInput, "Kauri Park School{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove school Kauri Park School" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.queryByText("54 Kelmarna Avenue")).not.toBeInTheDocument();

    // Adding a second school ORs the names together.
    await user.type(schoolInput, "Example Secondary{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove school Example Secondary" }),
    ).toBeInTheDocument();
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
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

    const input = screen.getByRole("textbox", {
      name: /describe your ideal property/i,
    });
    await user.type(input, "Find character villas in Auckland");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
      expect(
        screen.queryByText("2/30 Hardington Street"),
      ).not.toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, "Apartments in Wellington");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      await screen.findByText(/no matching listings were found/i),
    ).toBeInTheDocument();
  });

  it("shows and removes each applied bathroom and land-size condition", async () => {
    const user = userEvent.setup();
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
        aiSearch={async () => ({
          status: "ready",
          source: "jev",
          message: "Search applied.",
          filters: {
            numericCriteria: {
              bathrooms: { min: 1, max: 1 },
              landArea: { min: 500 },
            },
          },
        })}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /describe your ideal property/i }),
      "one bathroom, 500 m² land",
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    expect(await screen.findByText("54 Kelmarna Avenue")).toBeInTheDocument();
    expect(
      screen.queryByText("2/30 Hardington Street"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove bathrooms filter" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove land area filter" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Remove bathrooms filter" }),
    );
    expect(
      screen.getByRole("button", { name: "Remove land area filter" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove land area filter" }),
    );
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
  });

  it("shows named school and building age conditions as chips", async () => {
    const user = userEvent.setup();
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
        aiSearch={async () => ({
          status: "ready",
          source: "jev",
          message: "Search applied.",
          filters: {
            schoolNames: ["Auckland Grammar School"],
            yearBuiltFrom: 2000,
          },
        })}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /describe your ideal property/i }),
      "near Auckland Grammar",
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      await screen.findByRole("button", {
        name: "Remove school Auckland Grammar School",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove age filter" }),
    ).toBeInTheDocument();
  });

  it("compares selected homes side by side and removes a column", async () => {
    const user = userEvent.setup();
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /compare 2\/30 hardington street/i,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /compare 54 kelmarna avenue/i }),
    );
    await user.click(
      screen.getAllByRole("button", { name: /compare 2 homes/i })[0],
    );

    const comparison = screen.getByRole("dialog", {
      name: /property comparison/i,
    });
    expect(within(comparison).getByText("$740,000")).toBeInTheDocument();
    expect(within(comparison).getByText("$2,525,000")).toBeInTheDocument();

    await user.click(
      within(comparison).getByRole("button", {
        name: /remove 54 kelmarna avenue/i,
      }),
    );
    expect(
      within(comparison).queryByText("$2,525,000"),
    ).not.toBeInTheDocument();
  });

  it("shows flood assessment mode and mortgage tools on the property page", async () => {
    const user = userEvent.setup();
    render(
      <PropertyDetailPage
        property={properties[0]}
        comparableSales={comparableSales}
      />,
    );

    const details = screen.getByRole("main", { name: /property details/i });

    await user.click(
      within(details).getByRole("tab", { name: /Flood assessment/i }),
    );
    expect(
      within(details).getByText(/Council flood mapping: Flood plains/),
    ).toBeInTheDocument();
    expect(
      within(details).getByText(
        "Council mapping identifies this property location within Flood plains. These layers map potential inundation areas or surface-water flow paths and do not establish site-specific flood depth or likelihood.",
      ),
    ).toBeInTheDocument();
    expect(
      within(details).getByText(floodHazardDisclaimer),
    ).toBeInTheDocument();

    expect(
      within(details).queryByText(/comparable sales/i),
    ).not.toBeInTheDocument();
    expect(within(details).queryByText(/sunlight/i)).not.toBeInTheDocument();

    const initialPayment =
      within(details).getByTestId("monthly-repayment").textContent;
    fireEvent.change(within(details).getByLabelText(/deposit percentage/i), {
      target: { value: "30" },
    });

    expect(
      within(details).getByTestId("monthly-repayment").textContent,
    ).not.toBe(initialPayment);
  });

  it("shows the listing agent and source enquiry link in property details", async () => {
    render(
      <PropertyDetailPage
        property={properties[0]}
        comparableSales={comparableSales}
      />,
    );

    const details = screen.getByRole("main", { name: /property details/i });
    expect(within(details).getByText("Casey Agent")).toBeInTheDocument();
    expect(
      within(details).getByRole("link", { name: /enquire on oneroof/i }),
    ).toHaveAttribute(
      "href",
      "https://www.oneroof.co.nz/property/example-listing",
    );
  });

  it("shows nearby schools and containing school zones in the map Schools mode", async () => {
    const user = userEvent.setup();
    render(
      <PropertyDetailPage
        property={properties[0]}
        comparableSales={comparableSales}
      />,
    );
    const details = screen.getByRole("main", { name: /property details/i });

    expect(
      within(details).getAllByText("Kauri Park School").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(details).getByText("Contributing · 1.24 km away"),
    ).toBeInTheDocument();
    expect(within(details).getByText("In Zone")).toBeInTheDocument();
    expect(
      within(details).getByText(/School-zone matches are approximate/i),
    ).toBeInTheDocument();

    await user.selectOptions(
      within(details).getByLabelText("Filter nearby schools by type"),
      "Secondary",
    );
    expect(within(details).getByText("Example Secondary")).toBeInTheDocument();
    expect(
      within(details).queryByText("Kauri Park School"),
    ).not.toBeInTheDocument();
  });

  it("opens source details from an inline property citation", async () => {
    const user = userEvent.setup();
    render(
      <PropertyDetailPage
        property={seededProperties[0]}
        comparableSales={[]}
      />,
    );

    const details = screen.getByRole("main", { name: /property details/i });
    await user.click(
      within(details).getByRole("button", {
        name: /view source 1 for bedrooms/i,
      }),
    );

    const sourceDetails = screen.getByRole("dialog", {
      name: /source details/i,
    });
    expect(
      within(sourceDetails).getByText(/realestate public property page/i),
    ).toBeInTheDocument();
    expect(
      within(sourceDetails).getByText(/direct page snapshot/i),
    ).toBeInTheDocument();
    expect(
      within(sourceDetails).getByRole("link", {
        name: /open original source/i,
      }),
    ).toHaveAttribute(
      "href",
      seededProperties[0].sources?.find(
        (source) => source.publisher === "RealEstate",
      )?.url,
    );
  });

  it("shows a map point and photo source for a directly collected house", async () => {
    const user = userEvent.setup();
    render(
      <PropertyDetailPage
        property={seededProperties[0]}
        comparableSales={[]}
      />,
    );
    const details = screen.getByRole("main", { name: /property details/i });
    expect(
      within(details).getByRole("region", { name: /map of 59 israel avenue/i }),
    ).toBeInTheDocument();
    await user.click(within(details).getByRole("button", { name: "Sources" }));
    expect(
      within(details).getByRole("link", { name: /photo source/i }),
    ).toHaveAttribute("href", seededProperties[0].imageSourceUrl);
  });

  it("no longer renders an architectural style badge on cards", () => {
    const propertyWithoutStyle: Property = { ...properties[0] };
    const { container } = render(
      <PropertyExplorer
        properties={[propertyWithoutStyle]}
        comparableSales={[]}
      />,
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

    const input = screen.getByRole("textbox", {
      name: /describe your ideal property/i,
    });
    await user.type(input, "villa");

    // Wait for debounced search to trigger automatically without hitting submit button
    await waitFor(
      () => {
        expect(mockAiSearch).toHaveBeenCalledWith("villa");
      },
      { timeout: 1500 },
    );

    await waitFor(() => {
      expect(
        screen.getByText("Showing matching character villas."),
      ).toBeInTheDocument();
      expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
    });

    // Clear search using clear button
    const clearButton = screen.getByRole("button", {
      name: /clear search query/i,
    });
    await user.click(clearButton);
    expect(input).toHaveValue("");
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
  });

  it("updates listings in real-time when location and bedroom controls change", async () => {
    const user = userEvent.setup();
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
      />,
    );

    // Free-text location filter.
    await user.click(screen.getByRole("button", { name: /more filters/i }));
    const locationInput = screen.getByLabelText("Suburb or location filter");
    await user.type(locationInput, "Onehunga{Enter}");
    expect(screen.getByText("2/30 Hardington Street")).toBeInTheDocument();
    expect(screen.queryByText("54 Kelmarna Avenue")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Onehunga" }));
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();

    // Bedroom slider: 1 bedroom matches neither fixture home.
    const minBeds = screen.getByRole("slider", { name: "Minimum Bedrooms" });
    const maxBeds = screen.getByRole("slider", { name: "Maximum Bedrooms" });
    minBeds.focus();
    await user.keyboard("{Home}");
    await user.keyboard("{ArrowRight}");
    maxBeds.focus();
    await user.keyboard("{Home}");
    await user.keyboard("{ArrowRight}");
    expect(
      screen.queryByText("2/30 Hardington Street"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("54 Kelmarna Avenue")).not.toBeInTheDocument();

    // Clear filter
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByText("54 Kelmarna Avenue")).toBeInTheDocument();
  });

  it("displays signed-in account name or Account link in header navigation", async () => {
    const { AccountWorkspaceProvider } =
      await import("../app/components/account-workspace-provider");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { userId: 10, username: "Jordan", email: "jordan@example.nz" },
          workspace: {
            savedPropertyIds: [],
            destinations: [],
            generalNotes: [],
            propertyNotes: {},
            chatHistory: [],
          },
        }),
      }),
    );

    render(
      <AccountWorkspaceProvider>
        <PropertyExplorer
          properties={properties}
          comparableSales={comparableSales}
        />
      </AccountWorkspaceProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Jordan" }),
    ).toBeInTheDocument();
  });

  it("links Saved Homes to the workspace shortlist", () => {
    render(
      <PropertyExplorer
        properties={properties}
        comparableSales={comparableSales}
      />,
    );
    expect(screen.getByRole("link", { name: /Saved Homes/i })).toHaveAttribute(
      "href",
      "/profile#saved-homes",
    );
    expect(
      screen.queryByRole("dialog", { name: /saved listings/i }),
    ).not.toBeInTheDocument();
  });

  it("persists saved properties and destinations to account workspace when signed in", async () => {
    const patchCalls: Array<{ field: string; value: unknown }> = [];
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/account/workspace")) {
          if (init?.method === "PATCH") {
            const body = JSON.parse(init.body as string);
            patchCalls.push(body);
            return Promise.resolve({
              ok: true,
              json: async () => ({ ok: true }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: { userId: 5, username: "Robin", email: "robin@example.nz" },
              workspace: {
                savedPropertyIds: [],
                destinations: [],
                generalNotes: [],
                propertyNotes: {},
                chatHistory: [],
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
    vi.stubGlobal("fetch", fetchMock);

    const { AccountWorkspaceProvider } =
      await import("../app/components/account-workspace-provider");
    const user = userEvent.setup();
    render(
      <AccountWorkspaceProvider>
        <PropertyExplorer
          properties={properties}
          comparableSales={comparableSales}
        />
      </AccountWorkspaceProvider>,
    );

    // Save a home
    const saveBtn = await screen.findByRole("button", {
      name: /save 2\/30 hardington street/i,
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(
        patchCalls.some(
          (call) =>
            call.field === "savedPropertyIds" &&
            Array.isArray(call.value) &&
            call.value.includes("modern-townhouse"),
        ),
      ).toBe(true);
    });
  });

  it("links a single-photo property card to its dedicated page", async () => {
    const enrichedProperties: Property[] = [
      {
        ...properties[0],
        photoGallery: [
          "https://example.com/photo-1.jpg",
          "https://example.com/photo-2.jpg",
        ],
        openHomes: [
          {
            date: "2026-04-26",
            startTime: "12:00",
            endTime: "12:30",
            label: "Sun, 26 Apr · 12:00pm – 12:30pm",
          },
        ],
        saleMethod: "Auction",
      },
      ...properties.slice(1),
    ];

    render(
      <PropertyExplorer
        properties={enrichedProperties}
        comparableSales={comparableSales}
      />,
    );

    // Verify dedicated property page link
    const propertyLinks = screen.getAllByRole("link", {
      name: /2\/30 hardington street/i,
    });
    expect(
      propertyLinks.some(
        (link) => link.getAttribute("href") === "/properties/modern-townhouse",
      ),
    ).toBe(true);

    // Listing cards use one eligible photo; open-home details remain on the property page.
    const card = screen.getAllByRole("article")[0];
    expect(within(card).getAllByRole("img")).toHaveLength(1);
    expect(
      decodeURIComponent(within(card).getByRole("img").getAttribute("src")!),
    ).toContain("photo-2.jpg");
  });
});
