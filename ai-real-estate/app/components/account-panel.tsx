"use client";

import { type FormEvent, useState } from "react";
import { useAccountWorkspace } from "./account-workspace-provider";

type AccountUser = { username: string; email: string };

export default function AccountPanel() {
  const [mode, setMode] = useState<"register" | "login">("register");
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
      if (!response.ok) throw new Error(result.error || "Account request failed.");
      setUser(result.user);
      window.dispatchEvent(new Event("haven_account_changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account request failed.");
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
    } finally { setBusy(false); }
  }

  const signedInUser = account?.status === "signedIn" ? account.user : user;
  if (signedInUser) return <section className="account-panel">
    <h2>Your account</h2><p>Signed in as {signedInUser.username}</p><p>{signedInUser.email}</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
  </section>;
  if (account?.status === "loading") return <section className="account-panel"><p>Loading account...</p></section>;

  return (
    <section className="account-panel">
      <h2>Your account</h2>
      <p>Sign in to keep your saved homes, notes, and locations together.</p>
      {account?.status === "error" && <p role="alert">{account.error}</p>}
      <div className="account-panel-tabs">
        <button type="button" onClick={() => setMode("register")}>Register</button>
        <button type="button" onClick={() => setMode("login")}>Sign in</button>
      </div>
      <form onSubmit={submit}>
        {mode === "register" && <label>Username<input name="username" autoComplete="username" required /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
    </section>
  );
}
