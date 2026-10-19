"use client";

import { useState } from "react";
import UserNotes from "../components/user-notes";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"notes" | "account">("notes");

  return (
    <div className="site-shell" style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>
        <p className="eyebrow" style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "#6b7280", fontWeight: 600 }}>
          User Dashboard
        </p>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", margin: "0.2rem 0" }}>
          Account & Notes
        </h1>
        <p style={{ color: "#4b5563", fontSize: "0.95rem" }}>
          Manage your account settings, general user notes, and preferences.
        </p>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
        <button
          onClick={() => setActiveTab("notes")}
          style={{
            padding: "0.75rem 1rem",
            fontWeight: activeTab === "notes" ? "bold" : "normal",
            borderBottom: activeTab === "notes" ? "2px solid #2563eb" : "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: activeTab === "notes" ? "#2563eb" : "#4b5563",
          }}
          type="button"
        >
          General Notes
        </button>
        <button
          onClick={() => setActiveTab("account")}
          style={{
            padding: "0.75rem 1rem",
            fontWeight: activeTab === "account" ? "bold" : "normal",
            borderBottom: activeTab === "account" ? "2px solid #2563eb" : "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: activeTab === "account" ? "#2563eb" : "#4b5563",
          }}
          type="button"
        >
          Account Management
        </button>
      </div>

      <div>
        {activeTab === "notes" ? (
          <UserNotes />
        ) : (
          <div style={{ background: "#f9fafb", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Account Status</h3>
            <p style={{ fontSize: "0.95rem", color: "#374151", marginBottom: "0.5rem" }}>
              <strong>Username:</strong> demo_user
            </p>
            <p style={{ fontSize: "0.95rem", color: "#374151", marginBottom: "1rem" }}>
              <strong>Email:</strong> user@example.com
            </p>
            <span
              style={{
                display: "inline-block",
                padding: "0.25rem 0.75rem",
                background: "#dcfce7",
                color: "#166534",
                borderRadius: "4px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              Active Account
            </span>
          </div>
        )}
      </div>
    </div>
  );
}