"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import React, { useState, useEffect } from "react";
import { useAccountWorkspace } from "./account-workspace-provider";

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

export default function PropertyNotes({
  propertyId,
  propertyTitle,
}: PropertyNotesProps) {
  const [notes, setNotes] = useState<PropertyNote[]>([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [mounted, setMounted] = useState(false);
  const account = useAccountWorkspace();
  const accountStatus = account?.status;
  const accountUserId = account?.user?.userId;
  const accountNotes = account?.workspace.propertyNotes;

  const storageKey = `property_notes_${propertyId}`;

  useEffect(() => {
    if (accountStatus === "loading" || accountStatus === "error") return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (accountStatus === "signedIn") {
        const existingNotes = accountNotes?.[propertyId] ?? [];
        if (existingNotes.length === 0) {
          try {
            const saved = localStorage.getItem(storageKey);
            const localNotes = saved ? JSON.parse(saved) : [];
            if (Array.isArray(localNotes) && localNotes.length > 0) {
              setNotes(localNotes);
              void account?.save("propertyNotes", {
                ...account?.workspace.propertyNotes,
                [propertyId]: localNotes,
              });
              setMounted(true);
              return;
            }
          } catch {}
        }
        setNotes(existingNotes);
      } else {
        try {
          const saved = localStorage.getItem(storageKey);
          setNotes(saved ? JSON.parse(saved) : []);
        } catch (e) {
          console.error("Failed to parse property notes:", e);
        }
      }
      setMounted(true);
    });
    return () => {
      active = false;
    };
  }, [
    storageKey,
    propertyId,
    accountStatus,
    accountUserId,
    accountNotes,
    account,
  ]);

  const saveToStorage = (updatedNotes: PropertyNote[]) => {
    setNotes(updatedNotes);
    if (account?.status === "signedIn") {
      void account
        .save("propertyNotes", {
          ...account.workspace.propertyNotes,
          [propertyId]: updatedNotes,
        })
        .then((ok) => {
          if (!ok) setNotes(account.workspace.propertyNotes[propertyId] ?? []);
        });
      return;
    }
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
          : note,
      ),
    );
    setEditingId(null);
  };

  if (!mounted || account?.status === "loading")
    return (
      <div role="status" aria-label="Loading property notes">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  if (account?.status === "error") return <p role="alert">{account.error}</p>;
  return (
    <section
      className="property-notes-widget"
      aria-label={
        propertyTitle ? `Notes for ${propertyTitle}` : "Property notes"
      }
    >
      {account?.error && <p role="alert">{account.error}</p>}
      <div className="notes-heading">
        <div>
          <h3>My notes</h3>
          <p>
            {account?.status === "signedIn"
              ? "Private to your account."
              : "Saved on this device."}
          </p>
        </div>
        <Badge variant="secondary">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </Badge>
      </div>
      <form className="note-form" onSubmit={handleAddNote}>
        <FieldGroup>
          <Field>
            <FieldLabel className="sr-only">Category</FieldLabel>
            <ToggleGroup
              type="single"
              className="note-categories"
              value={category}
              onValueChange={(value) => {
                if (value) setCategory(value);
              }}
            >
              {NOTE_TAGS.map((tag) => (
                <ToggleGroupItem value={tag} key={tag}>
                  {tag}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel className="sr-only" htmlFor={`note-${propertyId}`}>
              Add note content
            </FieldLabel>
            <Textarea
              id={`note-${propertyId}`}
              aria-label="Add note content"
              placeholder="What would you like to remember?"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
            />
          </Field>
        </FieldGroup>
        <div className="note-form-footer">
          <Button type="submit" disabled={!content.trim()}>
            Save Property Note
          </Button>
        </div>
      </form>
      <div className="notes-list">
        {notes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No notes for this property yet</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="note-row">
              {editingId === note.id ? (
                <div className="notes-edit">
                  <ToggleGroup
                    type="single"
                    className="note-categories"
                    value={editCategory}
                    onValueChange={(value) => {
                      if (value) setEditCategory(value);
                    }}
                  >
                    {NOTE_TAGS.map((tag) => (
                      <ToggleGroupItem value={tag} key={tag}>
                        {tag}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Textarea
                    aria-label="Edit note content"
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    rows={3}
                  />
                  <div className="note-actions">
                    <Button
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      type="button"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleSaveEdit(note.id)}
                      type="button"
                      disabled={!editContent.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="note-row-header">
                    <Badge variant="secondary">
                      {note.category || "General"}
                    </Badge>
                    <time className="note-date">{note.createdAt}</time>
                  </div>
                  <p className="note-content">{note.content}</p>
                  <div className="note-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(note)}
                      type="button"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(note.id)}
                      type="button"
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
