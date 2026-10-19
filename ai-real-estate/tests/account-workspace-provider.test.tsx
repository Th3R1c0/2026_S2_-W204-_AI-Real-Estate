import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountWorkspaceProvider, useAccountWorkspace } from "../app/components/account-workspace-provider";

function WorkspaceView() {
  const account = useAccountWorkspace();
  return <p>{account?.status === "signedIn" ? `${account.user?.username}: ${account.workspace.savedPropertyIds.join(", ")}` : account?.status}</p>;
}

function SaveView() {
  const account = useAccountWorkspace();
  return <>
    <button onClick={() => { void account?.save("savedPropertyIds", ["first"]); }}>Save first</button>
    <button onClick={() => { void account?.save("savedPropertyIds", ["second"]); }}>Save second</button>
    <p>{account?.workspace.savedPropertyIds.join(",")}</p>
  </>;
}

afterEach(() => vi.unstubAllGlobals());

it("replaces one buyer's workspace when another buyer signs in", async () => {
  const fetchStub = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { userId: 1, username: "alex", email: "a@example.nz" }, workspace: { savedPropertyIds: ["home-a"], generalNotes: [], propertyNotes: {}, destinations: [] } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { userId: 2, username: "sam", email: "s@example.nz" }, workspace: { savedPropertyIds: ["home-b"], generalNotes: [], propertyNotes: {}, destinations: [] } }) });
  vi.stubGlobal("fetch", fetchStub);
  render(<AccountWorkspaceProvider><WorkspaceView /></AccountWorkspaceProvider>);
  expect(await screen.findByText("alex: home-a")).toBeInTheDocument();
  await act(async () => { window.dispatchEvent(new Event("haven_account_changed")); });
  expect(await screen.findByText("sam: home-b")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText(/home-a/)).not.toBeInTheDocument());
});

it("sends successive changes to the same field in order", async () => {
  let finishFirst!: (value: unknown) => void;
  const fetchStub = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { userId: 1, username: "alex", email: "a@example.nz" }, workspace: { savedPropertyIds: [], generalNotes: [], propertyNotes: {}, destinations: [] } }) })
    .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ workspace: { savedPropertyIds: ["second"], generalNotes: [], propertyNotes: {}, destinations: [] } }) });
  vi.stubGlobal("fetch", fetchStub);
  const user = userEvent.setup();
  render(<AccountWorkspaceProvider><SaveView /></AccountWorkspaceProvider>);
  await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole("button", { name: "Save first" }));
  await user.click(screen.getByRole("button", { name: "Save second" }));
  expect(fetchStub).toHaveBeenCalledTimes(2);
  await act(async () => { finishFirst({ ok: true, json: async () => ({ workspace: { savedPropertyIds: ["first"], generalNotes: [], propertyNotes: {}, destinations: [] } }) }); });
  expect(await screen.findByText("second")).toBeInTheDocument();
});
