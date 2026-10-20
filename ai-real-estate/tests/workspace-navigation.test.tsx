import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ProfilePage from "../app/profile/page";

it("opens the saved homes tab when arriving from Saved Homes", async () => {
  window.history.replaceState({}, "", "/profile#saved-homes");
  try {
    render(<ProfilePage />);
    expect(
      await screen.findByRole("tab", { name: "Saved homes" }),
    ).toHaveAttribute("aria-selected", "true");
  } finally {
    window.history.replaceState({}, "", "/");
  }
});
