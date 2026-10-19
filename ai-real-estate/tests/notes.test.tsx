import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import UserNotes from "../app/components/user-notes";
import PropertyNotes from "../app/components/property-notes";
import ProfilePage from "../app/profile/page";

describe("Notes and Profile Components", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("UserNotes", () => {
    it("renders empty state initially", async () => {
      render(<UserNotes />);
      expect(await screen.findByText(/No general notes yet/i)).toBeInTheDocument();
      expect(screen.getByText(/0 notes/i)).toBeInTheDocument();
    });

    it("adds a note and persists to localStorage", async () => {
      const user = userEvent.setup();
      render(<UserNotes />);

      const titleInput = await screen.findByPlaceholderText(/Note title/i);
      const contentInput = screen.getByPlaceholderText(/Write your note here/i);
      const submitButton = screen.getByRole("button", { name: /Add General Note/i });

      await user.type(titleInput, "Auckland Suburbs to Watch");
      await user.type(contentInput, "Check out Grey Lynn and Onehunga auctions.");
      await user.click(submitButton);

      expect(await screen.findByText("Auckland Suburbs to Watch")).toBeInTheDocument();
      expect(screen.getByText("Check out Grey Lynn and Onehunga auctions.")).toBeInTheDocument();
      expect(screen.getByText(/1 note/i)).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem("general_user_notes") || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe("Auckland Suburbs to Watch");
    });

    it("edits an existing note", async () => {
      localStorage.setItem(
        "general_user_notes",
        JSON.stringify([
          {
            id: "note-1",
            title: "Original Title",
            content: "Original Content",
            createdAt: "19 Oct 2026",
          },
        ])
      );

      const user = userEvent.setup();
      render(<UserNotes />);

      expect(await screen.findByText("Original Title")).toBeInTheDocument();
      const editButton = screen.getByRole("button", { name: "Edit" });
      await user.click(editButton);

      const editTitle = screen.getByLabelText("Edit note title");
      const editContent = screen.getByLabelText("Edit note content");
      const saveButton = screen.getByRole("button", { name: "Save" });

      await user.clear(editTitle);
      await user.type(editTitle, "Updated Title");
      await user.clear(editContent);
      await user.type(editContent, "Updated Content");
      await user.click(saveButton);

      expect(await screen.findByText("Updated Title")).toBeInTheDocument();
      expect(screen.getByText("Updated Content")).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem("general_user_notes") || "[]");
      expect(stored[0].title).toBe("Updated Title");
    });

    it("deletes a note", async () => {
      localStorage.setItem(
        "general_user_notes",
        JSON.stringify([
          {
            id: "note-1",
            title: "Delete Me",
            content: "Going away soon",
            createdAt: "19 Oct 2026",
          },
        ])
      );

      const user = userEvent.setup();
      render(<UserNotes />);

      expect(await screen.findByText("Delete Me")).toBeInTheDocument();
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
      });

      const stored = JSON.parse(localStorage.getItem("general_user_notes") || "[]");
      expect(stored).toHaveLength(0);
    });
  });

  describe("PropertyNotes", () => {
    it("renders empty state with property title", async () => {
      render(
        <PropertyNotes
          propertyId="prop-123"
          propertyTitle="123 Queen Street, Auckland"
        />
      );

      expect(
        await screen.findByText(/My Notes for 123 Queen Street, Auckland/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No notes for this property yet/i)
      ).toBeInTheDocument();
    });

    it("adds a note with selected category and persists to property key", async () => {
      const user = userEvent.setup();
      render(
        <PropertyNotes
          propertyId="prop-123"
          propertyTitle="123 Queen Street"
        />
      );

      const inspectionTag = await screen.findByRole("button", { name: "Inspection" });
      await user.click(inspectionTag);

      const textarea = screen.getByLabelText("Add note content");
      const submitBtn = screen.getByRole("button", { name: /Save Property Note/i });

      await user.type(textarea, "Roof looks newly painted, ask for code compliance certificate.");
      await user.click(submitBtn);

      expect(
        await screen.findByText("Roof looks newly painted, ask for code compliance certificate.")
      ).toBeInTheDocument();
      expect(screen.getAllByText("Inspection").length).toBeGreaterThanOrEqual(2);

      const stored = JSON.parse(localStorage.getItem("property_notes_prop-123") || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].category).toBe("Inspection");
      expect(stored[0].content).toContain("code compliance");
    });

    it("deletes a property note", async () => {
      localStorage.setItem(
        "property_notes_prop-456",
        JSON.stringify([
          {
            id: "pnote-1",
            propertyId: "prop-456",
            content: "Check foundation before auction",
            category: "Auction / Offer",
            createdAt: "19 Oct 2026",
          },
        ])
      );

      const user = userEvent.setup();
      render(<PropertyNotes propertyId="prop-456" />);

      expect(await screen.findByText("Check foundation before auction")).toBeInTheDocument();
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText("Check foundation before auction")).not.toBeInTheDocument();
      });

      const stored = JSON.parse(localStorage.getItem("property_notes_prop-456") || "[]");
      expect(stored).toHaveLength(0);
    });
  });

  describe("ProfilePage", () => {
    it("renders buyer workspace and switches tabs", async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      expect(screen.getByText(/Buyer Workspace/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Account & Notes/i })).toBeInTheDocument();

      // Default tab is General Notes
      expect(screen.getByText(/General Account Notes/i)).toBeInTheDocument();

      // Switch to Account Management tab
      const accountTab = screen.getByRole("button", { name: /Account Management/i });
      await user.click(accountTab);

      expect(screen.getByText(/Account Profile/i)).toBeInTheDocument();
      expect(screen.getByText(/demo_buyer/i)).toBeInTheDocument();
      expect(screen.getByText(/buyer@example.nz/i)).toBeInTheDocument();
    });
  });
});
