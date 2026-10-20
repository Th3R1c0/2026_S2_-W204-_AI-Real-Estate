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
            reply:
              "Haven helps you discover homes by architectural style, mapped flood hazards.",
            source: "gemini",
          }),
        };
      }
      return { ok: false, status: 404 };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.history.replaceState({}, "", "/");
  });

  it("reads the current property for each message and drops it after navigation", async () => {
    const sent: Array<{ currentPropertyId?: string }> = [];
    global.fetch = vi.fn(async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ reply: "Details received", source: "local" });
    });
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/properties/house%20one");
    render(<AIChatbot />);
    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    await user.type(screen.getByRole("textbox", { name: /ask a question/i }), "Tell me about this house{Enter}");
    await screen.findByText("Details received");
    expect(sent[0].currentPropertyId).toBe("house one");
    window.history.replaceState({}, "", "/");
    await user.type(screen.getByRole("textbox", { name: /ask a question/i }), "What is Haven?{Enter}");
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1].currentPropertyId).toBeUndefined();
  });

  it("renders the floating trigger button in closed state", () => {
    render(<AIChatbot />);
    const triggerBtn = screen.getByRole("button", {
      name: /open ai chat|ask haven ai/i,
    });
    expect(triggerBtn).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /haven ai assistant/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the chat panel when the trigger button is clicked", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    const triggerBtn = screen.getByRole("button", {
      name: /open ai chat|ask haven ai/i,
    });
    await user.click(triggerBtn);

    const dialog = screen.getByRole("dialog", { name: /haven ai assistant/i });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/kia ora|hello! i'm your haven ai assistant/i),
    ).toBeInTheDocument();
  });

  it("sends a message and displays the response", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    // Open chat
    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await user.type(input, "Tell me about architectural styles");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/tell me about architectural styles/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /haven helps you discover homes by architectural style/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("allows clicking a quick suggestion prompt", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    const suggestion = screen.getByRole("button", {
      name: /what is a lim report\?/i,
    });
    await user.click(suggestion);

    await waitFor(() => {
      expect(
        screen.getAllByText(/what is a lim report\?/i).length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it("closes the chat panel when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );
    expect(
      screen.getByRole("dialog", { name: /haven ai assistant/i }),
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close chat/i });
    await user.click(closeBtn);

    expect(
      screen.queryByRole("dialog", { name: /haven ai assistant/i }),
    ).not.toBeInTheDocument();
  });

  it("displays context indicator and sends property context when compared homes exist", async () => {
    let capturedBody: {
      message?: string;
      context?: { comparedProperties?: Array<{ address: string }> };
    } | null = null;
    global.fetch = vi
      .fn()
      .mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body));
        return {
          ok: true,
          json: async () => ({
            reply:
              "Both homes look great. Hardington Street has more parking.",
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

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    // Verify context indicator banner is displayed
    expect(screen.getByText(/2 compared/i)).toBeInTheDocument();

    // Verify dynamic suggestion button appears
    const compareSuggestion = screen.getByRole("button", {
      name: /compare my selected homes/i,
    });
    expect(compareSuggestion).toBeInTheDocument();
    await user.click(compareSuggestion);

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      const body = capturedBody as unknown as {
        context?: { comparedProperties?: Array<{ address: string }> };
      };
      expect(body?.context?.comparedProperties).toHaveLength(2);
      expect(body?.context?.comparedProperties?.[0].address).toBe(
        "2/30 Hardington Street",
      );
      expect(screen.getByText(/both homes look great/i)).toBeInTheDocument();
    });
  });

  it("keeps conversation history visible on screen when sending multiple questions", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    // Question 1
    await user.type(input, "First question: Tell me about LIM");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/first question: tell me about lim/i),
      ).toBeInTheDocument();
    });

    // Question 2
    await user.type(input, "Second question: How about flood risk?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/first question: tell me about lim/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/second question: how about flood risk\?/i),
      ).toBeInTheDocument();
    });
  });

  it("shows a retry note when the service fails", async () => {
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 503,
    }));

    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await user.type(input, "Is this working?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /service is currently unavailable\. please try again\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows the assistant identity without repeated provider tags", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    // Header has Powered by Gemini
    expect(
      screen.getByRole("heading", { name: "Haven AI Assistant" }),
    ).toBeInTheDocument();
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
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await user.type(input, "What is the price difference?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("$232,000")).toBeInTheDocument();
      const boldElement = screen.getByRole("dialog").querySelector("strong");
      expect(boldElement).not.toBeNull();
      expect(boldElement?.textContent).toBe("$232,000");
    });
  });

  it("loads user-specific chat history when signed in and isolates from guest users", async () => {
    const { AccountWorkspaceProvider } =
      await import("../app/components/account-workspace-provider");
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/api/account/workspace")) {
        return {
          ok: true,
          json: async () => ({
            user: { userId: 5, username: "testuser", email: "test@example.nz" },
            workspace: {
              savedPropertyIds: [],
              generalNotes: [],
              propertyNotes: {},
              destinations: [],
              chatHistory: [
                {
                  role: "user",
                  text: "My private historical question",
                  time: "10:15",
                },
                {
                  role: "model",
                  text: "My private historical answer",
                  time: "10:16",
                },
              ],
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const user = userEvent.setup();
    render(
      <AccountWorkspaceProvider>
        <AIChatbot />
      </AccountWorkspaceProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: /open ai chat|ask haven ai/i }),
    );
    expect(
      await screen.findByText("My private historical question"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("My private historical answer"),
    ).toBeInTheDocument();
  });

  it("allows uploading a LIM PDF report, shows badge, sends context, and allows removal", async () => {
    let capturedBody: {
      message?: string;
      context?: { limReport?: { filename: string; text: string } };
    } | null = null;

    global.fetch = vi
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        if (
          typeof url === "string" &&
          url.includes("/api/chatbot/upload-lim")
        ) {
          return {
            ok: true,
            json: async () => ({
              filename: "12-queen-street-lim.pdf",
              pageCount: 4,
              text: "Auckland Council LIM: Consents approved, no flood plain.",
            }),
          };
        }
        if (typeof url === "string" && url.includes("/api/chatbot")) {
          capturedBody = JSON.parse(String(init?.body));
          return {
            ok: true,
            json: async () => ({
              reply:
                "LIM analysis: Building consents are approved with Code Compliance Certificates.",
              source: "gemini",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

    const user = userEvent.setup();
    render(<AIChatbot />);

    await user.click(
      screen.getByRole("button", { name: /open ai chat|ask haven ai/i }),
    );

    const fileInput = screen.getByLabelText(/upload lim report file/i);
    const testFile = new File(["%PDF-sample"], "12-queen-street-lim.pdf", {
      type: "application/pdf",
    });

    await user.upload(fileInput, testFile);

    // Verify LIM badge is visible
    await waitFor(() => {
      expect(screen.getByText("12-queen-street-lim.pdf")).toBeInTheDocument();
      expect(screen.getByText("4 pages")).toBeInTheDocument();
    });

    // Verify LIM quick suggestion prompt appears
    expect(
      screen.getByRole("button", {
        name: /summarize key findings in this lim/i,
      }),
    ).toBeInTheDocument();

    // Send a message and check that context.limReport is passed in request
    const input = screen.getByRole("textbox", { name: /ask a question/i });
    const sendBtn = screen.getByRole("button", { name: /send/i });
    await user.type(input, "Are there building consents?");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      expect(capturedBody?.context?.limReport?.filename).toBe(
        "12-queen-street-lim.pdf",
      );
      expect(capturedBody?.context?.limReport?.text).toContain(
        "Consents approved",
      );
      expect(
        screen.getByText(/building consents are approved/i),
      ).toBeInTheDocument();
    });

    // Test removing the LIM report
    const removeBtn = screen.getByRole("button", {
      name: /remove lim report/i,
    });
    await user.click(removeBtn);

    expect(screen.queryByText("4 pages")).not.toBeInTheDocument();
  });
});
