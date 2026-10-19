import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountWorkspaceProvider } from "../app/components/account-workspace-provider";
import PropertyExplorer from "../app/components/property-explorer";
import { aucklandProperties } from "../lib/property-data";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it("loads saved homes and locations from the signed-in buyer's workspace", async () => {
  const property = aucklandProperties[0];
  localStorage.setItem("ai-real-estate-commute-destinations", JSON.stringify([{ id: "other", name: "Other person's work", address: "Elsewhere" }]));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    user: { userId: 2, username: "sam", email: "sam@example.nz" },
    workspace: {
      savedPropertyIds: [property.id], generalNotes: [], propertyNotes: {},
      destinations: [{ id: "work", name: "Sam's work", address: "1 Queen St", latitude: -36.84, longitude: 174.77 }],
    },
  }) }));
  render(<AccountWorkspaceProvider><PropertyExplorer properties={aucklandProperties} comparableSales={[]} /></AccountWorkspaceProvider>);
  expect(await screen.findByRole("option", { name: "Sam's work" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Saved Homes \(1\)/i })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Other person's work" })).not.toBeInTheDocument();
});
