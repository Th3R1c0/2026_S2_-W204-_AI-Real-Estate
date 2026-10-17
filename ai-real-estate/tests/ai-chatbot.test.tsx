import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIChatbot from "../app/components/ai-chatbot";

describe("AIChatbot component (TDD)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/chatbot")) {
        return {
          ok: true,
          json: async () => ({
            reply: "Haven helps you discover homes by architectural style, flood risk, and sunlight.",
            source: "gemini",
          }),
        };
      }
      return { ok: false, status: 404 };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders the floating trigger button in closed state", () => {
    render(<AIChatbot />);
    const triggerBtn = screen.getByRole("button", { name: /open ai chat|ask haven ai/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /haven ai assistant/i })).not.toBeInTheDocument();
  });

  it("opens the chat panel when the trigger button is clicked", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    const triggerBtn = screen.getByRole("button", { name: /open ai chat|ask haven ai/i });
    await user.click(triggerBtn);

    const dialog = screen.getByRole("dialog", { name: /haven ai assistant/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/kia ora|hello! i'm your haven ai assistant/i)).toBeInTheDocument();
  });

  it("sends a message and displays the response", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    // Open chat
    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await user.type(input, "Tell me about architectural styles");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/tell me about architectural styles/i)).toBeInTheDocument();
      expect(
        screen.getByText(/haven helps you discover homes by architectural style/i),
      ).toBeInTheDocument();
    });
  });

  it("allows clicking a quick suggestion prompt", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    const suggestion = screen.getByRole("button", { name: /what is a lim report\?/i });
    await user.click(suggestion);

    await waitFor(() => {
      expect(screen.getAllByText(/what is a lim report\?/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("closes the chat panel when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));
    expect(screen.getByRole("dialog", { name: /haven ai assistant/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close chat/i });
    await user.click(closeBtn);

    expect(screen.queryByRole("dialog", { name: /haven ai assistant/i })).not.toBeInTheDocument();
  });
});
