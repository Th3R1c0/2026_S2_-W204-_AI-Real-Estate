import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, validateRegistration } from "../lib/account/auth";

describe("account credentials", () => {
  it("rejects weak or malformed registration details", () => {
    expect(validateRegistration({ username: "a", email: "not-email", password: "short" })).toEqual({
      error: expect.any(String),
    });
  });

  it("stores a salted password hash and verifies only the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
});
