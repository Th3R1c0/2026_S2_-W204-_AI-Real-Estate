import { describe, expect, it } from "vitest";
import { validateWorkspaceChange } from "../lib/account/workspace";

describe("account workspace changes", () => {
  it("accepts named locations with valid map coordinates", () => {
    expect(validateWorkspaceChange({ field: "destinations", value: [{ id: "work", name: "Work", address: "1 Queen St", latitude: -36.84, longitude: 174.77 }] })).toEqual({
      field: "destinations",
      value: [{ id: "work", name: "Work", address: "1 Queen St", latitude: -36.84, longitude: 174.77 }],
    });
  });

  it("rejects fields outside the buyer workspace", () => {
    expect(validateWorkspaceChange({ field: "userId", value: 2 })).toEqual({ error: expect.any(String) });
  });

  it("rejects malformed notes and out-of-range coordinates", () => {
    expect(validateWorkspaceChange({ field: "generalNotes", value: [{ id: "1", content: 42 }] })).toEqual({ error: expect.any(String) });
    expect(validateWorkspaceChange({ field: "destinations", value: [{ id: "x", name: "Far away", address: "x", latitude: 200, longitude: 5 }] })).toEqual({ error: expect.any(String) });
  });
});
