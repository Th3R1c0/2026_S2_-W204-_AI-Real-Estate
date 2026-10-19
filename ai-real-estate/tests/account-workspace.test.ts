import { describe, expect, it } from "vitest";
import { emptyWorkspace, validateWorkspaceChange } from "../lib/account/workspace";

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

  it("validates chatHistory messages and preserves empty array in emptyWorkspace", () => {
    expect(emptyWorkspace.chatHistory).toEqual([]);
    expect(validateWorkspaceChange({
      field: "chatHistory",
      value: [{ role: "user", text: "Looking for 3 bed villa", time: "10:00" }, { role: "model", text: "Here are some options", time: "10:01" }]
    })).toEqual({
      field: "chatHistory",
      value: [{ role: "user", text: "Looking for 3 bed villa", time: "10:00" }, { role: "model", text: "Here are some options", time: "10:01" }]
    });
    expect(validateWorkspaceChange({ field: "chatHistory", value: [{ role: "invalid", text: 123 }] })).toEqual({ error: expect.any(String) });
  });
});

