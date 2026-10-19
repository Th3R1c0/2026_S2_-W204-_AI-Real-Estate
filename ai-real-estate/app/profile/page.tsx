"use client";

import { useState } from "react";
import Link from "next/link";
import UserNotes from "../components/user-notes";
import AccountPanel from "../components/account-panel";
import PropertyNotes from "../components/property-notes";
import { useAccountWorkspace } from "../components/account-workspace-provider";
import { properties } from "../../lib/property-data";
import { readSavedLocations, type SavedLocation } from "../../lib/saved-locations";

function SavedHomesTab() {
  const account = useAccountWorkspace();
  const savedIds = account?.status === "signedIn"
    ? account.workspace.savedPropertyIds
    : (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("haven_saved_property_ids") || "[]") : []);

  const handleUnsave = (id: string) => {
    const nextIds = savedIds.filter((item: string) => item !== id);
    if (account?.status === "signedIn") {
      void account.save("savedPropertyIds", nextIds);
    } else {
      try {
        localStorage.setItem("haven_saved_property_ids", JSON.stringify(nextIds));
        window.dispatchEvent(new Event("haven_account_changed"));
      } catch {}
    }
  };

  if (!savedIds || savedIds.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 1.5rem",
          background: "var(--cream, #f4f2e9)",
          borderRadius: "12px",
          border: "1px dashed var(--line, #dfe4dc)",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "var(--ink-deep, #0e241d)" }}>
          No saved homes yet
        </p>
        <p style={{ margin: "0.5rem 0 1.25rem 0", fontSize: "0.9rem", color: "var(--muted, #6f7d76)", lineHeight: 1.5 }}>
          Browse listings on Discover and save properties you&apos;re interested in to review them and add private inspection notes here.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.2rem",
            background: "var(--forest, #285e4a)",
            color: "var(--white, #fff)",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 650,
            fontSize: "0.9rem",
          }}
        >
          Explore Properties
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {savedIds.map((id: string) => {
        const prop = properties.find((p) => p.id === id) || {
          id,
          address: id,
          suburb: "Auckland",
          price: 0,
          bedrooms: 0,
          bathrooms: 0,
          image: "/properties/address-placeholder.svg",
        };

        return (
          <div
            key={id}
            style={{
              border: "1px solid var(--line, #dfe4dc)",
              borderRadius: "14px",
              background: "var(--white, #fff)",
              padding: "1.5rem",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
                flexWrap: "wrap",
                borderBottom: "1px solid var(--line, #dfe4dc)",
                paddingBottom: "1rem",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1.2rem", color: "var(--ink-deep, #0e241d)", fontWeight: 700 }}>
                  {prop.address}
                </h3>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted, #6f7d76)" }}>
                  {prop.suburb ? `${prop.suburb} • ` : ""}{prop.price ? `$${prop.price.toLocaleString("en-NZ")}` : "Price by negotiation"}
                  {prop.bedrooms ? ` • ${prop.bedrooms} bed` : ""}{prop.bathrooms ? ` • ${prop.bathrooms} bath` : ""}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => handleUnsave(id)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    border: "1px solid var(--line, #dfe4dc)",
                    background: "var(--paper, #fcfcf8)",
                    color: "var(--danger, #bd684f)",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Unsave
                </button>
              </div>
            </div>

            <PropertyNotes propertyId={id} propertyTitle={prop.address} />
          </div>
        );
      })}
    </div>
  );
}

function SavedLocationsTab() {
  const account = useAccountWorkspace();
  const destinations = account?.status === "signedIn"
    ? account.workspace.destinations
    : (typeof window !== "undefined" ? readSavedLocations() : []);

  const handleRemove = (id: string) => {
    const next = destinations.filter((item: SavedLocation) => item.id !== id);
    if (account?.status === "signedIn") {
      void account.save("destinations", next);
    } else {
      try {
        localStorage.setItem("ai-real-estate-commute-destinations", JSON.stringify(next));
        window.dispatchEvent(new Event("haven_account_changed"));
      } catch {}
    }
  };

  if (!destinations || destinations.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 1.5rem",
          background: "var(--cream, #f4f2e9)",
          borderRadius: "12px",
          border: "1px dashed var(--line, #dfe4dc)",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "var(--ink-deep, #0e241d)" }}>
          No saved locations yet
        </p>
        <p style={{ margin: "0.5rem 0 1.25rem 0", fontSize: "0.9rem", color: "var(--muted, #6f7d76)", lineHeight: 1.5 }}>
          Add workplaces, family homes, or regular commute destinations in any property&apos;s Commute tab to track distances and save them to your account.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.2rem",
            background: "var(--forest, #285e4a)",
            color: "var(--white, #fff)",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 650,
            fontSize: "0.9rem",
          }}
        >
          Explore Properties
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "var(--muted, #6f7d76)" }}>
        {account?.status === "signedIn"
          ? "These locations are saved securely to your account and sync across your devices."
          : "Saved locally on this device. Sign in to sync them to your account."}
      </p>
      {destinations.map((loc: SavedLocation) => (
        <div
          key={loc.id}
          style={{
            border: "1px solid var(--line, #dfe4dc)",
            borderRadius: "10px",
            background: "var(--white, #fff)",
            padding: "1rem 1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: "1rem", color: "var(--ink-deep, #0e241d)" }}>
              {loc.name || loc.address || "Untitled location"}
            </strong>
            {loc.name && loc.address && (
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "var(--muted, #6f7d76)" }}>
                {loc.address}
              </p>
            )}
            {loc.latitude !== undefined && loc.longitude !== undefined && (
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.75rem", color: "var(--forest, #285e4a)" }}>
                ✓ Mapped ({loc.latitude.toFixed(3)}, {loc.longitude.toFixed(3)})
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleRemove(loc.id)}
            style={{
              padding: "0.4rem 0.8rem",
              border: "1px solid var(--line, #dfe4dc)",
              background: "var(--paper, #fcfcf8)",
              color: "var(--danger, #bd684f)",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"notes" | "saved" | "locations" | "account">("notes");

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
            flexWrap: "wrap",
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
            onClick={() => setActiveTab("saved")}
            style={{
              padding: "0.85rem 1.25rem",
              fontWeight: activeTab === "saved" ? 700 : 500,
              borderBottom: activeTab === "saved" ? "3px solid var(--forest, #285e4a)" : "3px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              color: activeTab === "saved" ? "var(--forest, #285e4a)" : "var(--muted, #6f7d76)",
              fontSize: "0.95rem",
              transition: "color 0.15s ease",
            }}
            type="button"
          >
            My Saved Homes
          </button>
          <button
            onClick={() => setActiveTab("locations")}
            style={{
              padding: "0.85rem 1.25rem",
              fontWeight: activeTab === "locations" ? 700 : 500,
              borderBottom: activeTab === "locations" ? "3px solid var(--forest, #285e4a)" : "3px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              color: activeTab === "locations" ? "var(--forest, #285e4a)" : "var(--muted, #6f7d76)",
              fontSize: "0.95rem",
              transition: "color 0.15s ease",
            }}
            type="button"
          >
            Saved Locations
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
          ) : activeTab === "saved" ? (
            <SavedHomesTab />
          ) : activeTab === "locations" ? (
            <SavedLocationsTab />
          ) : (
            <AccountPanel />
          )}
        </div>
      </main>
    </div>
  );
}

