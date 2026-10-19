import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../app/profile/page";
import { AccountWorkspaceProvider } from "../app/components/account-workspace-provider";

describe("ProfilePage Saved Homes & Notes", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders My Saved Homes tab with saved properties and inline property notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { userId: 1, username: "alex", email: "alex@example.nz" },
        workspace: {
          savedPropertyIds: ["linz-100234"],
          generalNotes: [],
          propertyNotes: {
            "linz-100234": [{ id: "n1", propertyId: "linz-100234", content: "Great sunlight", createdAt: "today" }],
          },
          destinations: [],
          chatHistory: [],
        },
      }),
    }));

    const user = userEvent.setup();
    render(
      <AccountWorkspaceProvider>
        <ProfilePage />
      </AccountWorkspaceProvider>
    );

    // Switch to My Saved Homes tab
    const savedTab = await screen.findByRole("button", { name: /My Saved Homes/i });
    await user.click(savedTab);

    // Checks that the saved property and its inline note appear
    expect(await screen.findByText("Great sunlight")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unsave/i })).toBeInTheDocument();
  });

  it("allows deleting account from Account Management tab when signed in", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/api/account/workspace")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            user: { userId: 1, username: "alex", email: "alex@example.nz" },
            workspace: { savedPropertyIds: [], generalNotes: [], propertyNotes: {}, destinations: [], chatHistory: [] },
          }),
        });
      }
      if (typeof url === "string" && url.includes("delete_account")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, deleted: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <AccountWorkspaceProvider>
        <ProfilePage />
      </AccountWorkspaceProvider>
    );

    const accountTab = await screen.findByRole("button", { name: /Account Management/i });
    await user.click(accountTab);

    const deleteBtn = await screen.findByRole("button", { name: /Delete Account/i });
    await user.click(deleteBtn);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("delete_account"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
