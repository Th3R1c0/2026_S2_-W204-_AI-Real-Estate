"use client";

import React, { useState, useEffect } from "react";

export interface PropertyNote {
  id: string;
  propertyId: string;
  content: string;
  category?: string;
  createdAt: string;
}

interface PropertyNotesProps {
  propertyId: string;
  propertyTitle?: string;
}

const NOTE_TAGS = [
  "Inspection",
  "Auction / Offer",
  "Renovation",
  "LIM & Title",
  "Neighbourhood",
  "General",
];

export default function PropertyNotes({ propertyId, propertyTitle }: PropertyNotesProps) {
  const [notes, setNotes] = useState<PropertyNote[]>([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [mounted, setMounted] = useState(false);

  const storageKey = `property_notes_${propertyId}`;

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNotes(JSON.parse(saved));
      } else {
        setNotes([]);
      }
    } catch (e) {
      console.error("Failed to parse property notes:", e);
    }
  }, [storageKey]);

  const saveToStorage = (updatedNotes: PropertyNote[]) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error("Failed to save property notes:", e);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newNote: PropertyNote = {
      id: Date.now().toString(),
      propertyId,
      content: content.trim(),
      category,
      createdAt: new Date().toLocaleDateString("en-NZ", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };

    saveToStorage([newNote, ...notes]);
    setContent("");
  };

  const handleDelete = (id: string) => {
    saveToStorage(notes.filter((note) => note.id !== id));
  };

  const handleStartEdit = (note: PropertyNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditCategory(note.category || "General");
  };

  const handleSaveEdit = (id: string) => {
    if (!editContent.trim()) return;
    saveToStorage(
      notes.map((note) =>
        note.id === id
          ? {
              ...note,
              content: editContent.trim(),
              category: editCategory,
            }
          : note
      )
    );
    setEditingId(null);
  };

  if (!mounted) {
    return <div style={{ padding: "1.5rem 0", color: "var(--muted, #6b7280)" }}>Loading property notes...</div>;
  }

  return (
    <div className="property-notes-widget" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="tool-heading">
        <div>
          <p className="eyebrow">Private Buyer Notes</p>
          <h3 style={{ margin: 0 }}>My Notes {propertyTitle ? `for ${propertyTitle}` : ""}</h3>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--muted, #6f7d76)" }}>
            Notes are saved privately to your browser for your due diligence and inspection visits.
          </p>
        </div>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            background: "var(--sage, #dce8da)",
            color: "var(--forest, #285e4a)",
            padding: "0.25rem 0.65rem",
            borderRadius: "999px",
            alignSelf: "flex-start",
          }}
        >
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div>

      <form
        onSubmit={handleAddNote}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          background: "var(--white, #fff)",
          padding: "1rem",
          borderRadius: "10px",
          border: "1px solid var(--line, #dfe4dc)",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted, #6f7d76)" }}>Category:</span>
          {NOTE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setCategory(tag)}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: category === tag ? "var(--forest, #285e4a)" : "var(--line, #dfe4dc)",
                background: category === tag ? "var(--sage, #dce8da)" : "var(--paper, #fcfcf8)",
                color: category === tag ? "var(--forest, #285e4a)" : "var(--ink, #18332b)",
                fontWeight: category === tag ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        <textarea
          aria-label="Add note content"
          placeholder="e.g. Roof looks updated, asked agent for vendor disclosure, auction limit $1.2M..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "8px",
            border: "1px solid var(--line, #dfe4dc)",
            fontSize: "0.92rem",
            background: "var(--paper, #fcfcf8)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={!content.trim()}
            style={{
              padding: "0.5rem 1rem",
              background: !content.trim() ? "var(--muted, #9ca3af)" : "var(--forest, #285e4a)",
              color: "var(--white, #fff)",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: !content.trim() ? "not-allowed" : "pointer",
            }}
          >
            Save Property Note
          </button>
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {notes.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 1rem",
              background: "var(--cream, #f4f2e9)",
              borderRadius: "10px",
              border: "1px dashed var(--line, #dfe4dc)",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "var(--ink, #18332b)", fontSize: "0.95rem" }}>
              No notes for this property yet
            </p>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "var(--muted, #6f7d76)" }}>
              Add observations, auction strategies, or open home questions above.
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: "1rem",
                border: "1px solid var(--line, #dfe4dc)",
                borderRadius: "10px",
                background: "var(--white, #fff)",
              }}
            >
              {editingId === note.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {NOTE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setEditCategory(tag)}
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          border: "1px solid",
                          borderColor: editCategory === tag ? "var(--forest, #285e4a)" : "var(--line, #dfe4dc)",
                          background: editCategory === tag ? "var(--sage, #dce8da)" : "var(--paper, #fcfcf8)",
                          color: editCategory === tag ? "var(--forest, #285e4a)" : "var(--ink, #18332b)",
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    aria-label="Edit note content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    style={{
                      padding: "0.5rem",
                      borderRadius: "6px",
                      border: "1px solid var(--forest, #285e4a)",
                      fontSize: "0.9rem",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setEditingId(null)}
                      type="button"
                      style={{
                        padding: "0.3rem 0.7rem",
                        background: "var(--paper, #fcfcf8)",
                        border: "1px solid var(--line, #dfe4dc)",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      type="button"
                      style={{
                        padding: "0.3rem 0.7rem",
                        background: "var(--forest, #285e4a)",
                        color: "var(--white, #fff)",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        background: "var(--sage, #dce8da)",
                        color: "var(--forest, #285e4a)",
                      }}
                    >
                      {note.category || "General"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted, #6f7d76)" }}>{note.createdAt}</span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 0.75rem 0",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                      color: "var(--ink, #18332b)",
                    }}
                  >
                    {note.content}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      fontSize: "0.8rem",
                      borderTop: "1px solid var(--line, #dfe4dc)",
                      paddingTop: "0.5rem",
                    }}
                  >
                    <button
                      onClick={() => handleStartEdit(note)}
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--forest, #285e4a)",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger, #bd684f)",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
