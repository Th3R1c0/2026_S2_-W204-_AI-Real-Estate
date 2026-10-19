"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import React, { useState, useEffect } from "react";
import { useAccountWorkspace } from "./account-workspace-provider";

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
  const account = useAccountWorkspace();
  const accountStatus = account?.status;
  const accountUserId = account?.user?.userId;
  const accountNotes = account?.workspace.generalNotes;

  const storageKey = "general_user_notes";

  useEffect(() => {
    if (accountStatus === "loading" || accountStatus === "error") return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (accountStatus === "signedIn") setNotes(accountNotes ?? []);
      else {
        try {
          const saved = localStorage.getItem(storageKey);
          setNotes(saved ? JSON.parse(saved) : []);
        } catch (e) {
          console.error("Failed to parse general user notes:", e);
        }
      }
      setMounted(true);
    });
    return () => {
      active = false;
    };
  }, [accountStatus, accountUserId, accountNotes]);

  const saveToStorage = (updatedNotes: UserNote[]) => {
    setNotes(updatedNotes);
    if (account?.status === "signedIn") {
      void account.save("generalNotes", updatedNotes).then((ok) => {
        if (!ok) setNotes(account.workspace.generalNotes);
      });
      return;
    }
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
        note.id === id
          ? { ...note, title: editTitle.trim(), content: editContent.trim() }
          : note,
      ),
    );
    setEditingId(null);
  };

  if (!mounted || account?.status === "loading")
    return (
      <div role="status" aria-label="Loading notes">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  if (account?.status === "error") return <p role="alert">{account.error}</p>;
  return (
    <section className="user-notes-container">
      {account?.error && <p role="alert">{account.error}</p>}
      <div className="notes-heading">
        <div>
          <h3>General notes</h3>
          <p>A little space for your search.</p>
        </div>
        <Badge variant="secondary">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </Badge>
      </div>
      <form className="note-form" onSubmit={handleAddNote}>
        <FieldGroup>
          <Field>
            <FieldLabel className="sr-only" htmlFor="note-title">
              Note title
            </FieldLabel>
            <Input
              id="note-title"
              aria-label="Note title"
              placeholder="Note title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel className="sr-only" htmlFor="note-content">
              Note content
            </FieldLabel>
            <Textarea
              id="note-content"
              aria-label="Note content"
              placeholder="Write your note here…"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
            />
          </Field>
        </FieldGroup>
        <div className="note-form-footer">
          <Button type="submit" disabled={!title.trim() || !content.trim()}>
            Add General Note
          </Button>
        </div>
      </form>
      <div className="notes-list">
        {notes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No general notes yet</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="note-row">
              {editingId === note.id ? (
                <div className="notes-edit">
                  <Input
                    aria-label="Edit note title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
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
                      disabled={!editTitle.trim() || !editContent.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="note-row-header">
                    <h4>{note.title}</h4>
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
