import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountWorkspaceProvider } from "../app/components/account-workspace-provider";
import PropertyExplorer from "../app/components/property-explorer";
import { aucklandProperties } from "../lib/property-data";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("loads saved homes from the signed-in buyer's workspace", async () => {
  const property = aucklandProperties[0];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { userId: 2, username: "sam", email: "sam@example.nz" },
        workspace: {
          savedPropertyIds: [property.id],
          generalNotes: [],
          propertyNotes: {},
          destinations: [],
        },
      }),
    }),
  );
  render(
    <AccountWorkspaceProvider>
      <PropertyExplorer properties={aucklandProperties} comparableSales={[]} />
    </AccountWorkspaceProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "More filters" }),
  );
  expect(
    await screen.findByRole("link", { name: /Saved Homes 1/i }),
  ).toBeInTheDocument();
  // Saved commute destinations no longer exist, so no destination control renders.
  expect(screen.queryByLabelText(/Search near saved location/)).toBeNull();
});
