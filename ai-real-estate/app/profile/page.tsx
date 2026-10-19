"use client";

import { useState } from "react";
import Link from "next/link";
import UserNotes from "../components/user-notes";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"notes" | "account">("notes");

  return (
    <div className="site-shell" style={{ minHeight: "100vh", background: "var(--paper, #fcfcf8)" }}>
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 4.5vw",
          borderBottom: "1px solid var(--line, #dfe4dc)",
          background: "rgba(252, 252, 248, 0.95)",
          backdropFilter: "blur(18px)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
            color: "var(--ink-deep, #0e241d)",
            fontWeight: 800,
            fontSize: "1.25rem",
          }}
        >
          <span>haven</span>
          <span style={{ color: "var(--forest, #285e4a)" }}>.</span>
        </Link>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--forest, #285e4a)",
            textDecoration: "none",
            padding: "0.4rem 0.8rem",
            borderRadius: "8px",
            border: "1px solid var(--line, #dfe4dc)",
            background: "var(--white, #fff)",
          }}
        >
          ← Back to Discover
        </Link>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "840px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <header
          style={{
            marginBottom: "2rem",
            borderBottom: "1px solid var(--line, #dfe4dc)",
            paddingBottom: "1.5rem",
          }}
        >
          <p
            className="eyebrow"
            style={{
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--forest, #285e4a)",
              fontWeight: 700,
              margin: "0 0 0.4rem 0",
            }}
          >
            Buyer Workspace
          </p>
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 800,
              color: "var(--ink-deep, #0e241d)",
              margin: "0 0 0.5rem 0",
              letterSpacing: "-0.02em",
            }}
          >
            Account & Notes
          </h1>
          <p style={{ color: "var(--muted, #6f7d76)", fontSize: "1rem", margin: 0 }}>
            Manage your account details, research notes, and personal search preferences.
          </p>
        </header>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "2rem",
            borderBottom: "1px solid var(--line, #dfe4dc)",
          }}
        >
          <button
            onClick={() => setActiveTab("notes")}
            style={{
              padding: "0.85rem 1.25rem",
              fontWeight: activeTab === "notes" ? 700 : 500,
              borderBottom: activeTab === "notes" ? "3px solid var(--forest, #285e4a)" : "3px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              color: activeTab === "notes" ? "var(--forest, #285e4a)" : "var(--muted, #6f7d76)",
              fontSize: "0.95rem",
              transition: "color 0.15s ease",
            }}
            type="button"
          >
            General Notes
          </button>
          <button
            onClick={() => setActiveTab("account")}
            style={{
              padding: "0.85rem 1.25rem",
              fontWeight: activeTab === "account" ? 700 : 500,
              borderBottom: activeTab === "account" ? "3px solid var(--forest, #285e4a)" : "3px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              color: activeTab === "account" ? "var(--forest, #285e4a)" : "var(--muted, #6f7d76)",
              fontSize: "0.95rem",
              transition: "color 0.15s ease",
            }}
            type="button"
          >
            Account Management
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "notes" ? (
            <UserNotes />
          ) : (
            <div
              style={{
                background: "var(--white, #fff)",
                padding: "2rem",
                borderRadius: "14px",
                border: "1px solid var(--line, #dfe4dc)",
                boxShadow: "var(--shadow-soft, 0 8px 30px rgba(21, 48, 39, 0.05))",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    margin: "0 0 0.5rem 0",
                    color: "var(--ink-deep, #0e241d)",
                  }}
                >
                  Account Profile
                </h3>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted, #6f7d76)" }}>
                  Your profile is active with local preferences and session persistence.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1.25rem",
                  padding: "1.25rem",
                  background: "var(--cream, #f4f2e9)",
                  borderRadius: "10px",
                }}
              >
                <div>
                  <small style={{ color: "var(--muted, #6f7d76)", display: "block", marginBottom: "0.2rem" }}>
                    Username
                  </small>
                  <strong style={{ color: "var(--ink-deep, #0e241d)" }}>demo_buyer</strong>
                </div>
                <div>
                  <small style={{ color: "var(--muted, #6f7d76)", display: "block", marginBottom: "0.2rem" }}>
                    Email
                  </small>
                  <strong style={{ color: "var(--ink-deep, #0e241d)" }}>buyer@example.nz</strong>
                </div>
                <div>
                  <small style={{ color: "var(--muted, #6f7d76)", display: "block", marginBottom: "0.2rem" }}>
                    Account Tier
                  </small>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.2rem 0.6rem",
                      background: "var(--sage, #dce8da)",
                      color: "var(--forest, #285e4a)",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    Active Buyer
                  </span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line, #dfe4dc)", paddingTop: "1.25rem" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--ink-deep, #0e241d)" }}>
                  Storage & Data Privacy
                </h4>
                <p style={{ fontSize: "0.88rem", color: "var(--muted, #6f7d76)", lineHeight: 1.5, margin: 0 }}>
                  Notes, saved properties, and mortgage calculations are saved locally to your device.
                  No private notes are shared or transmitted to external servers without your permission.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
