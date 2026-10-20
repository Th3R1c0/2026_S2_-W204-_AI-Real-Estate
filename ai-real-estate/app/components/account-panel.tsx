"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { type FormEvent, useState } from "react";
import { useAccountWorkspace } from "./account-workspace-provider";

type AccountUser = { username: string; email: string };

export default function AccountPanel({
  initialMode = "register",
}: {
  initialMode?: "register" | "login";
}) {
  const [mode, setMode] = useState<"register" | "login">(initialMode);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const account = useAccountWorkspace();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Account request failed.");
      setUser(result.user);
      window.dispatchEvent(new Event("haven_account_changed"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Account request failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out.");
      setUser(null);
      window.dispatchEvent(new Event("haven_account_changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth?action=delete_account", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete account.");
      setUser(null);
      window.dispatchEvent(new Event("haven_account_changed"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete account.",
      );
    } finally {
      setBusy(false);
    }
  }

  const signedInUser = account?.status === "signedIn" ? account.user : user;
  if (signedInUser)
    return (
      <section className="account-panel">
        <h2>Your account</h2>
        <p>Signed in as {signedInUser.username}</p>
        <p>{signedInUser.email}</p>
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void signOut()}>
            {busy && <Spinner data-icon="inline-start" />}Sign out
          </Button>
          <Button
            variant="destructive"
            type="button"
            disabled={busy}
            onClick={() => void handleDeleteAccount()}
          >
            Delete Account
          </Button>
        </div>
      </section>
    );
  if (account?.status === "loading")
    return (
      <div role="status" aria-label="Loading account">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
    );
  return (
    <section className="account-panel">
      <div>
        <h2>{mode === "login" ? "Welcome back" : "Make yourself at home"}</h2>
        <p>Save your homes, notes, and places.</p>
      </div>
      {account?.status === "error" && <p role="alert">{account.error}</p>}
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "register" | "login")}
      >
        <TabsList>
          <TabsTrigger value="login">Sign in</TabsTrigger>
          <TabsTrigger value="register">Sign up</TabsTrigger>
        </TabsList>
      </Tabs>
      <form onSubmit={submit}>
        <FieldGroup>
          {mode === "register" && (
            <Field>
              <FieldLabel htmlFor="account-username">Username</FieldLabel>
              <Input
                id="account-username"
                name="username"
                autoComplete="username"
                required
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="account-email">Email</FieldLabel>
            <Input
              id="account-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-password">Password</FieldLabel>
            <Input
              id="account-password"
              name="password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
            />
          </Field>
        </FieldGroup>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {busy
            ? "Please wait…"
            : mode === "register"
              ? "Sign up"
              : "Sign in"}
        </Button>
      </form>
    </section>
  );
}
