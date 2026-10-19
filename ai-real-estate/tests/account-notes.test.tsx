import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountWorkspaceProvider } from "../app/components/account-workspace-provider";
import UserNotes from "../app/components/user-notes";
import PropertyNotes from "../app/components/property-notes";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it("shows the signed-in buyer's notes instead of another browser user's local notes", async () => {
  localStorage.setItem("general_user_notes", JSON.stringify([{ id: "other", title: "Other person's note", content: "private", createdAt: "today" }]));
  localStorage.setItem("property_notes_home-a", JSON.stringify([{ id: "other", propertyId: "home-a", content: "Other property note", createdAt: "today" }]));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    user: { userId: 2, username: "sam", email: "sam@example.nz" },
    workspace: {
      savedPropertyIds: [], destinations: [],
      generalNotes: [{ id: "sam-note", title: "Sam's note", content: "safe", createdAt: "today" }],
      propertyNotes: { "home-a": [{ id: "sam-home", propertyId: "home-a", content: "Sam's property note", createdAt: "today" }] },
    },
  }) }));
  render(<AccountWorkspaceProvider><UserNotes /><PropertyNotes propertyId="home-a" /></AccountWorkspaceProvider>);
  expect(await screen.findByText("Sam's note")).toBeInTheDocument();
  expect(await screen.findByText("Sam's property note")).toBeInTheDocument();
  expect(screen.queryByText("Other person's note")).not.toBeInTheDocument();
  expect(screen.queryByText("Other property note")).not.toBeInTheDocument();
});
