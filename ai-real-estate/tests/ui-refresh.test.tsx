import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import PropertyExplorer from "../app/components/property-explorer";
import AIChatbot from "../app/components/ai-chatbot";
import PropertyDetailPage from "../app/components/property-detail-page";
import { properties } from "../lib/property-data";
import type { Property } from "../lib/property-types";

const home: Property = {
  ...properties[0],
  id: "test-home",
  address: "12 Garden Street",
  image: "/first.jpg",
  photoGallery: ["/first.jpg", "/second.jpg", "/third.jpg", "/fourth.jpg"],
  floodHazards: [],
  schoolDataSynced: true,
  nearbySchools: [
    {
      schoolId: 1,
      name: "Garden School",
      orgType: "Primary",
      distanceKm: 1,
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

it("keeps schools alongside the map behind a toggle and research tools expandable", async () => {
  const user = userEvent.setup();
  render(<PropertyDetailPage property={home} comparableSales={[]} />);
  expect(screen.queryByText("Garden School")).not.toBeInTheDocument();
  await user.click(screen.getByRole("switch", { name: "Show schools on map" }));
  expect(screen.getByText("Garden School")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Mortgage calculator" }));
  expect(screen.getByLabelText("Property price ($)")).toHaveValue(home.price);
});

it("opens the second photo, advances with buttons and keys, and restores focus on close", async () => {
  const user = userEvent.setup();
  render(<PropertyDetailPage property={home} comparableSales={[]} />);
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
