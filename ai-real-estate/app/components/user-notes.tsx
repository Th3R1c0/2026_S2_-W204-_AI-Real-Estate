"use client";

import React, { useState, useEffect } from "react";

export interface UserNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function UserNotes() {
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [mounted, setMounted] = useState(false);

  const storageKey = "general_user_notes";

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNotes(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse general user notes:", e);
    }
  }, []);

  const saveToStorage = (updatedNotes: UserNote[]) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error("Failed to save notes to localStorage:", e);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newNote: UserNote = {
      id: Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date().toLocaleDateString("en-NZ", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };

    saveToStorage([newNote, ...notes]);
    setTitle("");
    setContent("");
  };

  const handleDelete = (id: string) => {
    saveToStorage(notes.filter((note) => note.id !== id));
  };

  const handleStartEdit = (note: UserNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    saveToStorage(
      notes.map((note) =>
        note.id === id ? { ...note, title: editTitle.trim(), content: editContent.trim() } : note
      )
    );
    setEditingId(null);
  };

  if (!mounted) {
    return <div style={{ padding: "2rem 0", color: "var(--muted, #6b7280)" }}>Loading notes...</div>;
  }

  return (
    <div className="user-notes-container" style={{ maxWidth: "680px", margin: "0 auto", padding: "1rem 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--ink-deep, #0e241d)" }}>
            General Account Notes
          </h3>
          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "var(--muted, #6f7d76)" }}>
            Keep track of suburbs, finance contacts, or general property search criteria.
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
          marginBottom: "2rem",
          background: "var(--white, #fff)",
          padding: "1.25rem",
          borderRadius: "12px",
          border: "1px solid var(--line, #dfe4dc)",
          boxShadow: "var(--shadow-soft, 0 8px 30px rgba(21, 48, 39, 0.05))",
        }}
      >
        <input
          aria-label="Note title"
          type="text"
          placeholder="Note title (e.g., Preferred Suburbs or Solicitor Details)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "8px",
            border: "1px solid var(--line, #dfe4dc)",
            fontSize: "0.95rem",
            background: "var(--paper, #fcfcf8)",
          }}
        />
        <textarea
          aria-label="Note content"
          placeholder="Write your note here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "8px",
            border: "1px solid var(--line, #dfe4dc)",
            fontSize: "0.95rem",
            background: "var(--paper, #fcfcf8)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={!title.trim() || !content.trim()}
            style={{
              padding: "0.6rem 1.25rem",
              background: !title.trim() || !content.trim() ? "var(--muted, #9ca3af)" : "var(--forest, #285e4a)",
              color: "var(--white, #fff)",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: !title.trim() || !content.trim() ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Add General Note
          </button>
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {notes.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2.5rem 1rem",
              background: "var(--cream, #f4f2e9)",
              borderRadius: "12px",
              border: "1px dashed var(--line, #dfe4dc)",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "var(--ink, #18332b)" }}>No general notes yet</p>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.85rem", color: "var(--muted, #6f7d76)" }}>
              Add your first note above to save thoughts and preferences for your property search.
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: "1.25rem",
                border: "1px solid var(--line, #dfe4dc)",
                borderRadius: "12px",
                background: "var(--white, #fff)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              {editingId === note.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <input
                    aria-label="Edit note title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--forest, #285e4a)",
                      fontSize: "0.95rem",
                    }}
                  />
                  <textarea
                    aria-label="Edit note content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--forest, #285e4a)",
                      fontSize: "0.95rem",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setEditingId(null)}
                      type="button"
                      style={{
                        padding: "0.4rem 0.85rem",
                        background: "var(--paper, #fcfcf8)",
                        border: "1px solid var(--line, #dfe4dc)",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      type="button"
                      style={{
                        padding: "0.4rem 0.85rem",
                        background: "var(--forest, #285e4a)",
                        color: "var(--white, #fff)",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
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
                      alignItems: "flex-start",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-deep, #0e241d)" }}>
                      {note.title}
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted, #6f7d76)" }}>{note.createdAt}</span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 1rem 0",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.92rem",
                      lineHeight: 1.5,
                      color: "var(--ink, #18332b)",
                    }}
                  >
                    {note.content}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      fontSize: "0.85rem",
                      borderTop: "1px solid var(--line, #dfe4dc)",
                      paddingTop: "0.6rem",
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
