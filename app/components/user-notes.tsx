"use client";

import React, { useState, useEffect } from "react";

interface UserNote {
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

  const storageKey = "general_user_notes";

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse general user notes:", e);
      }
    }
  }, []);

  const saveToStorage = (updatedNotes: UserNote[]) => {
    setNotes(updatedNotes);
    localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newNote: UserNote = {
      id: Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date().toLocaleDateString("en-US", {
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

  return (
    <div className="user-notes-container" style={{ maxWidth: "600px", margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>General Account Notes</h3>
        <span>{notes.length} notes</span>
      </div>

      <form onSubmit={handleAddNote} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Note title (e.g., Preferred Suburbs)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <textarea
          placeholder="Write your note here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc", resize: "vertical" }}
        />
        <button
          type="submit"
          disabled={!title.trim() || !content.trim()}
          style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Add General Note
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {notes.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666" }}>No general notes yet. Add one above!</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} style={{ padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#f9fafb" }}>
              {editingId === note.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button onClick={() => setEditingId(null)} type="button">Cancel</button>
                    <button onClick={() => handleSaveEdit(note.id)} type="button" style={{ background: "#2563eb", color: "#fff", padding: "0.2rem 0.6rem", borderRadius: "4px" }}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h4 style={{ margin: "0 0 0.25rem 0" }}>{note.title}</h4>
                    <small style={{ color: "#888" }}>{note.createdAt}</small>
                  </div>
                  <p style={{ margin: "0 0 0.75rem 0", whiteSpace: "pre-wrap" }}>{note.content}</p>
                  <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.85rem" }}>
                    <button onClick={() => handleStartEdit(note)} type="button" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }}>Edit</button>
                    <button onClick={() => handleDelete(note.id)} type="button" style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 0 }}>Delete</button>
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