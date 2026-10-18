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

  it("displays context indicator and sends property context when compared homes exist", async () => {
    let capturedBody: {
      message?: string;
      context?: { comparedProperties?: Array<{ address: string }> };
    } | null = null;
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({
          reply: "Both homes look great. Hardington Street has better sunlight.",
          source: "gemini",
        }),
      };
    });

    const mockCompared = [
      {
        id: "comp-1",
        address: "2/30 Hardington Street",
        suburb: "Onehunga",
        city: "Auckland",
        price: 740_000,
        bedrooms: 3,
        bathrooms: 2,
        propertyType: "Townhouse",
      },
      {
        id: "comp-2",
        address: "54 Kelmarna Avenue",
        suburb: "Ponsonby",
        city: "Auckland",
        price: 2_525_000,
        bedrooms: 3,
        bathrooms: 1,
        propertyType: "Villa",
      },
    ];

    const user = userEvent.setup();
    render(<AIChatbot initialComparedProperties={mockCompared} />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    // Verify context indicator banner is displayed
    expect(screen.getByText(/context active: 2 compared/i)).toBeInTheDocument();

    // Verify dynamic suggestion button appears
    const compareSuggestion = screen.getByRole("button", { name: /compare my selected homes/i });
    expect(compareSuggestion).toBeInTheDocument();
    await user.click(compareSuggestion);

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      const body = capturedBody as unknown as {
        context?: { comparedProperties?: Array<{ address: string }> };
      };
      expect(body?.context?.comparedProperties).toHaveLength(2);
      expect(body?.context?.comparedProperties?.[0].address).toBe("2/30 Hardington Street");
      expect(screen.getByText(/both homes look great/i)).toBeInTheDocument();
    });
  });

  it("keeps conversation history visible on screen when sending multiple questions", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    // Question 1
    await user.type(input, "First question: Tell me about LIM");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/first question: tell me about lim/i)).toBeInTheDocument();
    });

    // Question 2
    await user.type(input, "Second question: How about flood risk?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/first question: tell me about lim/i)).toBeInTheDocument();
      expect(screen.getByText(/second question: how about flood risk\?/i)).toBeInTheDocument();
    });
  });

  it("shows a retry note when the service fails", async () => {
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 503,
    }));

    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await user.type(input, "Is this working?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/service is currently unavailable\. please try again\./i)).toBeInTheDocument();
    });
  });

  it("displays 'Powered by Gemini' in the header and removes source tags from message bubbles", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    // Header has Powered by Gemini
    expect(screen.getByText("Powered by Gemini")).toBeInTheDocument();
    expect(screen.queryByText("Online Helpdesk")).not.toBeInTheDocument();

    // Source tags are not in message bubbles
    expect(screen.queryByText(/• powered by gemini/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/• haven guide/i)).not.toBeInTheDocument();
  });

  it("applies bold styling to formatted markdown in assistant responses", async () => {
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        reply: "The price difference between them is **$232,000**.",
        source: "gemini",
      }),
    }));

    const user = userEvent.setup();
    const { container } = render(<AIChatbot />);

    await user.click(screen.getByRole("button", { name: /open ai chat|ask haven ai/i }));

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await user.type(input, "What is the price difference?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("$232,000")).toBeInTheDocument();
      const boldElement = container.querySelector("strong");
      expect(boldElement).not.toBeNull();
      expect(boldElement?.textContent).toBe("$232,000");
    });
  });
});
