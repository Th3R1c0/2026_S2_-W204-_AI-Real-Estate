"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { emptyWorkspace, type BuyerWorkspace, type WorkspaceField } from "../../lib/account/workspace";

type AccountUser = { userId: number; username: string; email: string };
type AccountContextValue = {
  status: "loading" | "guest" | "signedIn" | "error";
  user: AccountUser | null;
  workspace: BuyerWorkspace;
  error: string;
  refresh: () => Promise<void>;
  save: <K extends WorkspaceField>(field: K, value: BuyerWorkspace[K]) => Promise<boolean>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountContextValue["status"]>("loading");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [workspace, setWorkspace] = useState<BuyerWorkspace>(emptyWorkspace);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const saveChains = useRef<Partial<Record<WorkspaceField, Promise<boolean>>>>({});

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    saveChains.current = {};
    setStatus("loading");
    setUser(null);
    setWorkspace(emptyWorkspace);
    try {
      const response = await fetch("/api/account/workspace", { cache: "no-store" });
      if (generation.current !== currentGeneration) return;
      if (response.status === 401) { setStatus("guest"); setError(""); return; }
      if (!response.ok) throw new Error("Could not load your account data.");
      const result = await response.json();
      if (generation.current !== currentGeneration) return;
      setUser(result.user);
      setWorkspace(result.workspace);
      setStatus("signedIn");
      setError("");
    } catch (cause) {
      if (generation.current !== currentGeneration) return;
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Could not load your account data.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const onAccountChange = () => { void refresh(); };
    window.addEventListener("haven_account_changed", onAccountChange);
    return () => { active = false; window.removeEventListener("haven_account_changed", onAccountChange); };
  }, [refresh]);

  const save: AccountContextValue["save"] = (field, value) => {
    if (status !== "signedIn") return Promise.resolve(false);
    const currentGeneration = generation.current;
    const previous = saveChains.current[field] ?? Promise.resolve(true);
    const pending = previous.then(async () => {
      if (generation.current !== currentGeneration) return false;
      try {
        const response = await fetch("/api/account/workspace", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value }),
        });
        if (!response.ok) throw new Error("Could not save your account data. Please try again.");
        if (generation.current !== currentGeneration) return false;
        setWorkspace(current => ({ ...current, [field]: value }));
        setError("");
        return true;
      } catch (cause) {
        if (generation.current !== currentGeneration) return false;
        setError(cause instanceof Error ? cause.message : "Could not save your account data.");
        return false;
      }
    });
    saveChains.current[field] = pending;
    return pending;
  };

  return <AccountContext.Provider value={{ status, user, workspace, error, refresh, save }}>{children}</AccountContext.Provider>;
}

export function useAccountWorkspace() { return useContext(AccountContext); }
