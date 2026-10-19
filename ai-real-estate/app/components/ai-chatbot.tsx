"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { PropertyChatSummary, LimReportContext } from "../../lib/chatbot-knowledge";
import { useAccountWorkspace } from "./account-workspace-provider";

type Message = {
  id: string;
  role: "user" | "model";
  text: string;
  source?: "gemini" | "local";
  time: string;
};

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderInlineFormattedText(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(https?:\/\/[^\s)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} style={{ fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            backgroundColor: "rgba(0, 0, 0, 0.08)",
            padding: "1px 5px",
            borderRadius: "4px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = /^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline" }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} style={{ height: "4px" }} />;
        }

        const headingMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
        if (headingMatch) {
          return (
            <div
              key={idx}
              style={{
                fontWeight: 700,
                fontSize: "14px",
                marginTop: idx > 0 ? "4px" : "0",
              }}
            >
              {renderInlineFormattedText(headingMatch[2])}
            </div>
          );
        }

        const bulletMatch = /^[-*•]\s+(.*)$/.exec(trimmed);
        if (bulletMatch) {
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                paddingLeft: "4px",
                lineHeight: "1.45",
              }}
            >
              <span style={{ fontSize: "12px", opacity: 0.7, marginTop: "1px" }}>•</span>
              <div style={{ flex: 1 }}>{renderInlineFormattedText(bulletMatch[1])}</div>
            </div>
          );
        }

        const numberedMatch = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
        if (numberedMatch) {
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                paddingLeft: "4px",
                lineHeight: "1.45",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  opacity: 0.8,
                  minWidth: "16px",
                  marginTop: "1px",
                }}
              >
                {numberedMatch[1]}.
              </span>
              <div style={{ flex: 1 }}>{renderInlineFormattedText(numberedMatch[2])}</div>
            </div>
          );
        }

        return (
          <div key={idx} style={{ lineHeight: "1.5" }}>
            {renderInlineFormattedText(line)}
          </div>
        );
      })}
    </div>
  );
}

export default function AIChatbot({
  initialSavedProperties = [],
  initialComparedProperties = [],
}: {
  initialSavedProperties?: PropertyChatSummary[];
  initialComparedProperties?: PropertyChatSummary[];
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedProperties, setSavedProperties] = useState<PropertyChatSummary[]>(initialSavedProperties);
  const [comparedProperties, setComparedProperties] = useState<PropertyChatSummary[]>(initialComparedProperties);

  const account = useAccountWorkspace();
  const accountStatus = account?.status;
  const accountUserId = account?.user?.userId;
  const accountChatHistory = account?.workspace?.chatHistory;
  const accountSavedIds = account?.workspace?.savedPropertyIds;

  const defaultWelcomeMessage: Message = useMemo(() => ({
    id: "welcome",
    role: "model",
    text: "Kia ora! I'm your Haven AI Assistant. Ask me anything about finding properties, architectural styles, flood risks, LIM reports, or ask me to compare your selected homes and help plan your search campaign!",
    time: "Just now",
  }), []);

  const [messages, setMessages] = useState<Message[]>([defaultWelcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountStatus === "signedIn") {
      if (accountChatHistory && accountChatHistory.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages(
          accountChatHistory.map((m, idx) => ({
            id: `account-msg-${idx}`,
            role: m.role,
            text: m.text,
            time: m.time || "Recently",
          }))
        );
      } else {
        setMessages([defaultWelcomeMessage]);
      }
    } else if (accountStatus === "guest") {
      setMessages([defaultWelcomeMessage]);
    }
  }, [accountStatus, accountUserId, accountChatHistory, defaultWelcomeMessage]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [limReport, setLimReport] = useState<LimReportContext | null>(null);
  const [isUploadingLim, setIsUploadingLim] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLim(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/chatbot/upload-lim", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as {
        filename?: string;
        text?: string;
        pageCount?: number;
        warning?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "Failed to upload LIM report. Please try again.");
      } else if (data.text !== undefined && data.filename) {
        setLimReport({
          filename: data.filename,
          text: data.text,
          pageCount: data.pageCount,
        });

        if (data.warning) {
          setError(data.warning);
        }
      }
    } catch {
      setError("Network error uploading LIM report. Please try again.");
    } finally {
      setIsUploadingLim(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Sync saved and compared properties from localStorage and window event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadPropertiesFromStorage = () => {
      try {
        const savedRaw = localStorage.getItem("haven_saved_properties");
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (Array.isArray(parsed)) setSavedProperties(parsed);
        }
        const comparedRaw = localStorage.getItem("haven_compared_properties");
        if (comparedRaw) {
          const parsed = JSON.parse(comparedRaw);
          if (Array.isArray(parsed)) setComparedProperties(parsed);
        }
      } catch {}
    };

    loadPropertiesFromStorage();

    const handleContextEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        savedProperties?: PropertyChatSummary[];
        comparedProperties?: PropertyChatSummary[];
      }>;
      if (customEvent.detail) {
        if (customEvent.detail.savedProperties) {
          setSavedProperties(customEvent.detail.savedProperties);
        }
        if (customEvent.detail.comparedProperties) {
          setComparedProperties(customEvent.detail.comparedProperties);
        }
      }
    };

    window.addEventListener("haven_properties_context_updated", handleContextEvent);
    window.addEventListener("storage", loadPropertiesFromStorage);

    return () => {
      window.removeEventListener("haven_properties_context_updated", handleContextEvent);
      window.removeEventListener("storage", loadPropertiesFromStorage);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, loading]);

  const dynamicSuggestions = useMemo(() => {
    const list: string[] = [];
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1]?.text.toLowerCase() ?? "";
    const assistantReplies = messages.filter((m, idx) => m.role === "model" && idx > 0);
    const lastAssistantMessage = assistantReplies[assistantReplies.length - 1]?.text.toLowerCase() ?? "";
    const conversationTopic = lastUserMessage || lastAssistantMessage;
    const userHasSentMessages = userMessages.length > 0;

    if (comparedProperties.length >= 2) {
      if (userHasSentMessages) {
        if (conversationTopic.includes("flood") || conversationTopic.includes("hazard")) {
          list.push("Which compared home has mapped Council flood hazards?");
          list.push("What is the price difference between them?");
          list.push("Compare my selected homes");
          list.push("What is a LIM report?");
        } else if (conversationTopic.includes("price") || conversationTopic.includes("cost") || conversationTopic.includes("difference")) {
          list.push("What is the price difference between them?");
          list.push("Which compared home has mapped Council flood hazards?");
          list.push("Compare my selected homes");
          list.push("What is a LIM report?");
        } else {
          list.push("Compare my selected homes");
          list.push("What is the price difference between them?");
          list.push("Which compared home has mapped Council flood hazards?");
          list.push("What is a LIM report?");
        }
      } else {
        list.push("Compare my selected homes");
        list.push("What is the price difference between them?");
        list.push("Which compared home has mapped Council flood hazards?");
        list.push("What is a LIM report?");
      }
    } else if (comparedProperties.length === 1) {
      list.push(`Tell me about ${comparedProperties[0].address}`);
      list.push("How do I select another home to compare?");
      if (savedProperties.length >= 1) {
        list.push("Review my saved listings");
      }
      list.push("What is a LIM report?");
    } else if (savedProperties.length >= 1) {
      list.push("Review my saved listings");
      list.push("How do I compare two of my saved homes?");
      list.push("Help me think about my search campaign");
      list.push("What is a LIM report?");
    } else {
      if (userHasSentMessages) {
        if (conversationTopic.includes("lim") || conversationTopic.includes("consent") || conversationTopic.includes("title")) {
          list.push("What is a LIM report?");
          list.push("What red flags should I look for in a LIM?");
          list.push("How do I request a LIM report in Auckland?");
          list.push("Help me think about my search campaign");
        } else if (conversationTopic.includes("flood") || conversationTopic.includes("hazard")) {
          list.push("Which flood hazard layers does Haven show?");
          list.push("How do I interpret mapped flood hazards?");
          list.push("What is a LIM report?");
          list.push("Help me think about my search campaign");
        } else if (conversationTopic.includes("mortgage") || conversationTopic.includes("calculator") || conversationTopic.includes("price") || conversationTopic.includes("deposit")) {
          list.push("How does the mortgage calculator work?");
          list.push("How much deposit do I need in NZ?");
          list.push("What is a LIM report?");
          list.push("Help me think about my search campaign");
        } else if (conversationTopic.includes("campaign") || conversationTopic.includes("search") || conversationTopic.includes("organis")) {
          list.push("Help me think about my search campaign");
          list.push("How should I prioritize suburbs and budgets?");
          list.push("What is a LIM report?");
          list.push("What architectural styles can I filter?");
        } else if (conversationTopic.includes("style") || conversationTopic.includes("architect") || conversationTopic.includes("villa") || conversationTopic.includes("bungalow")) {
          list.push("What architectural styles can I filter?");
          list.push("What are common maintenance needs for 1920s bungalows?");
          list.push("What is a LIM report?");
          list.push("Help me think about my search campaign");
        } else {
          list.push("Help me think about my search campaign");
          list.push("What architectural styles can I filter?");
          list.push("What is a LIM report?");
          list.push("How does the mortgage calculator work?");
        }
      } else {
        list.push("Help me think about my search campaign");
        list.push("What architectural styles can I filter?");
        list.push("What is a LIM report?");
        list.push("How does the mortgage calculator work?");
      }
    }

    if (limReport) {
      list.unshift(
        "Summarize key findings in this LIM",
        "Are there any unconsented works or missing CCCs?",
        "What natural or flood hazards are noted in this LIM?",
        "What are the council rates and zoning rules?",
      );
    }

    return Array.from(new Set(list)).slice(0, 4);
  }, [comparedProperties, savedProperties, messages, limReport]);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: generateId("user"),
      role: "user",
      text,
      time: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, text: m.text }));

      const effectiveSavedProperties = accountStatus === "signedIn" && accountSavedIds
        ? savedProperties.filter((p) => accountSavedIds.includes(p.id))
        : (accountStatus === "guest" || !account) ? savedProperties : [];

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: {
            savedProperties: effectiveSavedProperties,
            comparedProperties,
            ...(limReport ? { limReport } : {}),
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to connect to assistant");
      }

      const data = (await res.json()) as { reply: string; source?: "gemini" | "local" };

      const botMessage: Message = {
        id: generateId("bot"),
        role: "model",
        text: data.reply,
        source: data.source,
        time: getTimestamp(),
      };

      setMessages((prev) => {
        const next = [...prev, botMessage];
        if (account?.status === "signedIn") {
          void account.save(
            "chatHistory",
            next
              .filter((m) => m.id !== "welcome")
              .map((m) => ({ role: m.role, text: m.text, time: m.time }))
          );
        }
        return next;
      });
    } catch {
      setError("Service is currently unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          aria-label="Open AI chat"
          onClick={() => setIsOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#18181b",
            color: "#f4f4f5",
            border: "1px solid #3f3f46",
            borderRadius: "9999px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.backgroundColor = "#27272a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.backgroundColor = "#18181b";
          }}
        >
          <span style={{ fontSize: "18px" }}>✨</span>
          <span>Ask Haven AI</span>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              display: "inline-block",
            }}
          />
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Haven AI Assistant"
          style={{
            width: "360px",
            maxWidth: "calc(100vw - 32px)",
            height: "520px",
            maxHeight: "calc(100vh - 100px)",
            backgroundColor: "#ffffff",
            color: "#18181b",
            borderRadius: "18px",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.35)",
            border: "1px solid #e4e4e7",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#18181b",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #27272a",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "#27272a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                }}
              >
                ✨
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700" }}>Haven AI Assistant</div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#a1a1aa" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                      display: "inline-block",
                    }}
                  />
                  Powered by Gemini
                </div>
              </div>
            </div>

            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                fontSize: "18px",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
            >
              ✕
            </button>
          </div>

          {/* Active Context Banner */}
          {(comparedProperties.length > 0 || savedProperties.length > 0 || limReport) && (
            <div
              style={{
                padding: "7px 16px",
                backgroundColor: "#f0fdf4",
                borderBottom: "1px solid #dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "#166534",
                fontWeight: 600,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📋</span>
                <span>
                  Context Active:{" "}
                  {limReport && `📄 ${limReport.filename}`}
                  {limReport && (comparedProperties.length > 0 || savedProperties.length > 0) && " · "}
                  {comparedProperties.length > 0 && `${comparedProperties.length} compared`}
                  {comparedProperties.length > 0 && savedProperties.length > 0 && " · "}
                  {savedProperties.length > 0 && `${savedProperties.length} saved`}
                </span>
              </div>
              <span
                style={{
                  fontSize: "10px",
                  color: "#15803d",
                  backgroundColor: "#dcfce7",
                  padding: "2px 6px",
                  borderRadius: "10px",
                }}
              >
                AI Ready
              </span>
            </div>
          )}

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              backgroundColor: "#fcfcfc",
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                      backgroundColor: isUser ? "#18181b" : "#f4f4f5",
                      color: isUser ? "#ffffff" : "#18181b",
                      fontSize: "13.5px",
                      lineHeight: "1.5",
                      boxShadow: isUser ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                      border: isUser ? "none" : "1px solid #e4e4e7",
                    }}
                  >
                    <FormattedMessage text={m.text} />
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#71717a",
                      marginTop: "3px",
                    }}
                  >
                    <span>{m.time}</span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", color: "#71717a", fontSize: "12px" }}>
                <span>Haven AI is thinking</span>
                <span style={{ animation: "pulse 1s infinite" }}>...</span>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  fontSize: "12px",
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions (if fewer than 4 messages) */}
          {messages.length <= 3 && !loading && (
            <div
              style={{
                padding: "8px 14px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                borderTop: "1px solid #f4f4f5",
                backgroundColor: "#ffffff",
              }}
            >
              {dynamicSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void sendMessage(item)}
                  style={{
                    backgroundColor: "#f4f4f5",
                    border: "1px solid #e4e4e7",
                    borderRadius: "9999px",
                    padding: "4px 10px",
                    fontSize: "11.5px",
                    color: "#3f3f46",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e4e4e7")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f4f4f5")}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid #e4e4e7",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {limReport && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "5px 10px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  color: "#166534",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>📄</span>
                  <span style={{ fontWeight: 600 }}>{limReport.filename}</span>
                  <span style={{ opacity: 0.75 }}>({limReport.pageCount ?? 1} pgs)</span>
                </div>
                <button
                  type="button"
                  aria-label="Remove LIM report"
                  onClick={() => setLimReport(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#166534",
                    fontSize: "13px",
                    cursor: "pointer",
                    padding: "2px 4px",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                aria-label="Upload LIM report file"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                type="button"
                aria-label="Upload LIM report"
                title="Upload LIM Report (PDF)"
                disabled={isUploadingLim}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  backgroundColor: "#f4f4f5",
                  border: "1px solid #d4d4d8",
                  borderRadius: "10px",
                  padding: "9px 11px",
                  fontSize: "14px",
                  cursor: isUploadingLim ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3f3f46",
                  transition: "all 0.15s ease",
                }}
              >
                {isUploadingLim ? "⏳" : "📎"}
              </button>
              <input
                ref={inputRef}
                type="text"
                aria-label="Ask a question"
                placeholder={isUploadingLim ? "Uploading & parsing LIM..." : "Ask a question..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || isUploadingLim}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: "1px solid #d4d4d8",
                  fontSize: "13px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#18181b",
                }}
              />
              <button
                type="button"
                aria-label="Send"
                disabled={!input.trim() || loading || isUploadingLim}
                onClick={() => void sendMessage()}
                style={{
                  backgroundColor: input.trim() && !loading && !isUploadingLim ? "#18181b" : "#e4e4e7",
                  color: input.trim() && !loading && !isUploadingLim ? "#ffffff" : "#a1a1aa",
                  border: "none",
                  borderRadius: "10px",
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: input.trim() && !loading && !isUploadingLim ? "pointer" : "not-allowed",
                  transition: "all 0.15s ease",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
