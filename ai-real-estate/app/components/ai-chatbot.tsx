"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message as ConversationMessage,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  MessageCircle,
  Sparkles,
  X,
  FileText,
  Paperclip,
  ArrowUp,
} from "lucide-react";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type {
  PropertyChatSummary,
  LimReportContext,
} from "../../lib/chatbot-knowledge";
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
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    <div className="chat-formatted">
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
              <span
                style={{ fontSize: "12px", opacity: 0.7, marginTop: "1px" }}
              >
                •
              </span>
              <div style={{ flex: 1 }}>
                {renderInlineFormattedText(bulletMatch[1])}
              </div>
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
              <div style={{ flex: 1 }}>
                {renderInlineFormattedText(numberedMatch[2])}
              </div>
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
  const [savedProperties, setSavedProperties] = useState<PropertyChatSummary[]>(
    initialSavedProperties,
  );
  const [comparedProperties, setComparedProperties] = useState<
    PropertyChatSummary[]
  >(initialComparedProperties);

  const account = useAccountWorkspace();
  const accountStatus = account?.status;
  const accountUserId = account?.user?.userId;
  const accountChatHistory = account?.workspace?.chatHistory;
  const accountSavedIds = account?.workspace?.savedPropertyIds;

  const defaultWelcomeMessage: Message = useMemo(
    () => ({
      id: "welcome",
      role: "model",
      text: "Kia ora! Tell me what home you have in mind, compare your shortlist, or attach a LIM to explore its details.",
      time: "Just now",
    }),
    [],
  );

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
          })),
        );
      } else {
        setMessages([defaultWelcomeMessage]);
      }
    } else if (accountStatus === "guest") {
      setMessages([defaultWelcomeMessage]);
    }
  }, [accountStatus, accountUserId, accountChatHistory, defaultWelcomeMessage]);

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
        setError(
          data.error || "Failed to upload LIM report. Please try again.",
        );
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

    window.addEventListener(
      "haven_properties_context_updated",
      handleContextEvent,
    );
    window.addEventListener("storage", loadPropertiesFromStorage);

    return () => {
      window.removeEventListener(
        "haven_properties_context_updated",
        handleContextEvent,
      );
      window.removeEventListener("storage", loadPropertiesFromStorage);
    };
  }, []);

  const dynamicSuggestions = useMemo(() => {
    const list: string[] = [];
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMessage =
      userMessages[userMessages.length - 1]?.text.toLowerCase() ?? "";
    const assistantReplies = messages.filter(
      (m, idx) => m.role === "model" && idx > 0,
    );
    const lastAssistantMessage =
      assistantReplies[assistantReplies.length - 1]?.text.toLowerCase() ?? "";
    const conversationTopic = lastUserMessage || lastAssistantMessage;
    const userHasSentMessages = userMessages.length > 0;

    if (comparedProperties.length >= 2) {
      if (userHasSentMessages) {
        if (
          conversationTopic.includes("flood") ||
          conversationTopic.includes("hazard")
        ) {
          list.push("Which compared home has mapped Council flood hazards?");
          list.push("What is the price difference between them?");
          list.push("Compare my selected homes");
          list.push("What is a LIM report?");
        } else if (
          conversationTopic.includes("price") ||
          conversationTopic.includes("cost") ||
          conversationTopic.includes("difference")
        ) {
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
        if (
          conversationTopic.includes("lim") ||
          conversationTopic.includes("consent") ||
          conversationTopic.includes("title")
        ) {
          list.push("What is a LIM report?");
          list.push("What red flags should I look for in a LIM?");
          list.push("How do I request a LIM report in Auckland?");
          list.push("Help me think about my search campaign");
        } else if (
          conversationTopic.includes("flood") ||
          conversationTopic.includes("hazard")
        ) {
          list.push("Which flood hazard layers does Haven show?");
          list.push("How do I interpret mapped flood hazards?");
          list.push("What is a LIM report?");
          list.push("Help me think about my search campaign");
        } else if (
          conversationTopic.includes("mortgage") ||
          conversationTopic.includes("calculator") ||
          conversationTopic.includes("price") ||
          conversationTopic.includes("deposit")
        ) {
          list.push("How does the mortgage calculator work?");
          list.push("How much deposit do I need in NZ?");
          list.push("What is a LIM report?");
          list.push("Help me think about my search campaign");
        } else if (
          conversationTopic.includes("campaign") ||
          conversationTopic.includes("search") ||
          conversationTopic.includes("organis")
        ) {
          list.push("Help me think about my search campaign");
          list.push("How should I prioritize suburbs and budgets?");
          list.push("What is a LIM report?");
          list.push("What architectural styles can I filter?");
        } else if (
          conversationTopic.includes("style") ||
          conversationTopic.includes("architect") ||
          conversationTopic.includes("villa") ||
          conversationTopic.includes("bungalow")
        ) {
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

      const effectiveSavedProperties =
        accountStatus === "signedIn" && accountSavedIds
          ? savedProperties.filter((p) => accountSavedIds.includes(p.id))
          : accountStatus === "guest" || !account
            ? savedProperties
            : [];
      const propertyRoute = /^\/properties\/([^/]+)\/?$/.exec(window.location.pathname);

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          currentPropertyId: propertyRoute ? decodeURIComponent(propertyRoute[1]) : undefined,
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

      const data = (await res.json()) as {
        reply: string;
        source?: "gemini" | "local";
      };

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
              .map((m) => ({ role: m.role, text: m.text, time: m.time })),
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
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <DialogTrigger asChild>
          <Button
            aria-label="Open AI chat"
            className="chat-launcher"
            size="icon"
            type="button"
          >
            <MessageCircle />
          </Button>
        </DialogTrigger>
        <DialogContent
          className="chat-dialog"
          onInteractOutside={(event) => event.preventDefault()}
          aria-label="Haven AI Assistant"
          aria-describedby={undefined}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <div className="chat-header">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>
                <Sparkles />
                Haven AI Assistant
              </DialogTitle>
              <DialogClose asChild>
                <Button
                  aria-label="Close chat"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                >
                  <X />
                </Button>
              </DialogClose>
            </div>
            <p>A little help with your next move.</p>
          </div>
          {(comparedProperties.length > 0 || savedProperties.length > 0) && (
            <div className="chat-context">
              <Marker>
                <MarkerContent>
                  {comparedProperties.length > 0 &&
                    `${comparedProperties.length} compared`}
                  {comparedProperties.length > 0 &&
                    savedProperties.length > 0 &&
                    " · "}
                  {savedProperties.length > 0 &&
                    `${savedProperties.length} saved`}
                </MarkerContent>
              </Marker>
            </div>
          )}
          <MessageScrollerProvider>
            <MessageScroller className="chat-stream">
              <MessageScrollerViewport
                role="log"
                aria-label="Conversation"
                aria-live="polite"
              >
                <MessageScrollerContent>
                  {messages.map((message) => (
                    <MessageScrollerItem
                      messageId={message.id}
                      key={message.id}
                    >
                      <ConversationMessage
                        align={message.role === "user" ? "end" : "start"}
                      >
                        <MessageContent>
                          <Bubble
                            variant={
                              message.role === "user" ? "default" : "secondary"
                            }
                          >
                            <BubbleContent>
                              <FormattedMessage text={message.text} />
                            </BubbleContent>
                          </Bubble>
                          <MessageFooter>{message.time}</MessageFooter>
                        </MessageContent>
                      </ConversationMessage>
                    </MessageScrollerItem>
                  ))}
                  {loading && (
                    <MessageScrollerItem messageId="thinking">
                      <div className="chat-thinking" role="status">
                        <Spinner />
                        Haven AI is thinking…
                      </div>
                    </MessageScrollerItem>
                  )}
                  {error && (
                    <MessageScrollerItem messageId="error">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
          {messages.length <= 3 && !loading && (
            <div className="chat-suggestions">
              {dynamicSuggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => void sendMessage(suggestion)}
                  type="button"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
          <div className="chat-footer">
            {limReport && (
              <Attachment size="sm">
                <AttachmentMedia>
                  <FileText />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{limReport.filename}</AttachmentTitle>
                  <AttachmentDescription>
                    {limReport.pageCount ?? 1} pages
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label="Remove LIM report"
                    onClick={() => setLimReport(null)}
                    type="button"
                  >
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              aria-label="Upload LIM report file"
              onChange={handleFileUpload}
              className="sr-only"
              tabIndex={-1}
            />
            <InputGroup>
              <InputGroupAddon>
                <InputGroupButton
                  aria-label="Upload LIM report"
                  title="Upload LIM report (PDF)"
                  disabled={isUploadingLim}
                  onClick={() => fileInputRef.current?.click()}
                  size="icon-sm"
                >
                  {isUploadingLim ? <Spinner /> : <Paperclip />}
                </InputGroupButton>
              </InputGroupAddon>
              <InputGroupInput
                ref={inputRef}
                aria-label="Ask a question"
                placeholder={
                  isUploadingLim ? "Reading your LIM…" : "Ask a question…"
                }
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || isUploadingLim}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Send"
                  variant="default"
                  size="icon-sm"
                  disabled={!input.trim() || loading || isUploadingLim}
                  onClick={() => void sendMessage()}
                >
                  <ArrowUp />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
