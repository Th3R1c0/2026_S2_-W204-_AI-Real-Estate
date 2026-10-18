"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { PropertyChatSummary } from "../../lib/chatbot-knowledge";

type Message = {
  id: string;
  role: "user" | "model";
  text: string;
  source?: "gemini" | "local";
  time: string;
};

const BASE_SUGGESTIONS = [
  "What is a LIM report?",
  "How does the mortgage calculator work?",
  "Help me think about my search campaign",
];

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      text: "Kia ora! I'm your Haven AI Assistant. Ask me anything about finding properties, architectural styles, flood risks, LIM reports, or ask me to compare your selected homes and help plan your search campaign!",
      time: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (comparedProperties.length >= 2) {
      list.push("Compare my selected homes");
    }
    if (savedProperties.length >= 1) {
      list.push("Review my saved listings");
    }
    list.push(...BASE_SUGGESTIONS);
    return list.slice(0, 4);
  }, [comparedProperties, savedProperties]);

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

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: {
            savedProperties,
            comparedProperties,
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

      setMessages((prev) => [...prev, botMessage]);
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
                  Online Helpdesk
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
          {(comparedProperties.length > 0 || savedProperties.length > 0) && (
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
                      whiteSpace: "pre-wrap",
                      boxShadow: isUser ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                      border: isUser ? "none" : "1px solid #e4e4e7",
                    }}
                  >
                    {m.text}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#71717a",
                      marginTop: "3px",
                      display: "flex",
                      gap: "6px",
                    }}
                  >
                    <span>{m.time}</span>
                    {m.source && (
                      <span style={{ fontStyle: "italic" }}>
                        {m.source === "gemini" ? "• Powered by Gemini" : "• Haven Guide"}
                      </span>
                    )}
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
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              aria-label="Ask a question"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
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
              disabled={!input.trim() || loading}
              onClick={() => void sendMessage()}
              style={{
                backgroundColor: input.trim() && !loading ? "#18181b" : "#e4e4e7",
                color: input.trim() && !loading ? "#ffffff" : "#a1a1aa",
                border: "none",
                borderRadius: "10px",
                padding: "9px 14px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
