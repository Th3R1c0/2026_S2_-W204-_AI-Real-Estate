"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import UserNotes from "../components/user-notes";
import AccountPanel from "../components/account-panel";
import PropertyNotes from "../components/property-notes";
import SiteHeader from "../components/site-header";
import { useAccountWorkspace } from "../components/account-workspace-provider";
import { properties } from "../../lib/property-data";

function SavedHomesTab() {
  const account = useAccountWorkspace();
  const [, refresh] = useState(0);
  let guestIds: string[] = [];
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("haven_saved_property_ids") ?? "[]",
    );
    if (Array.isArray(parsed))
      guestIds = parsed.filter((id): id is string => typeof id === "string");
  } catch {}
  const savedIds =
    account?.status === "signedIn"
      ? account.workspace.savedPropertyIds
      : guestIds;
  function unsave(id: string) {
    const next = savedIds.filter((item) => item !== id);
    if (account?.status === "signedIn")
      void account.save("savedPropertyIds", next);
    else {
      try {
        localStorage.setItem("haven_saved_property_ids", JSON.stringify(next));
        window.dispatchEvent(new Event("haven_account_changed"));
        refresh((value) => value + 1);
      } catch {}
    }
  }
  if (!savedIds.length)
    return (
      <Empty>
        <EmptyHeader>
          <Heart />
          <EmptyTitle>No saved homes yet</EmptyTitle>
          <EmptyDescription>
            Your favourites will feel at home here.
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline">
          <Link href="/">Explore homes</Link>
        </Button>
      </Empty>
    );
  return (
    <div className="saved-workspace-list">
      {savedIds.map((id) => {
        const property = properties.find((item) => item.id === id);
        return (
          <article key={id} className="saved-workspace-home">
            <div className="saved-workspace-heading">
              <div>
                <h2>
                  <Link href={`/properties/${encodeURIComponent(id)}`}>
                    {property?.address ?? id}
                  </Link>
                </h2>
                <p>
                  {property
                    ? `${property.suburb} · $${property.price.toLocaleString("en-NZ")} · ${property.bedrooms} beds · ${property.bathrooms} baths`
                    : "Saved home"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unsave(id)}
                type="button"
              >
                Unsave
              </Button>
            </div>
            <PropertyNotes propertyId={id} propertyTitle={property?.address} />
          </article>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const account = useAccountWorkspace();
  const [tab, setTab] = useState("notes");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const syncTab = () => {
      if (window.location.hash === "#saved-homes") setTab("saved");
    };
    queueMicrotask(() => {
      syncTab();
      setMounted(true);
    });
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="profile-main">
        <header className="profile-heading">
          <h1>My workspace</h1>
        </header>
        {!mounted || account?.status === "loading" ? (
          <div role="status" aria-label="Loading workspace">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mt-8 h-40 w-full" />
          </div>
        ) : account?.status === "error" ? (
          <>
            <p role="alert">{account.error}</p>
            <Button onClick={() => void account.refresh()}>Retry</Button>
          </>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="saved">Saved homes</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            <TabsContent value="notes">
              <UserNotes />
            </TabsContent>
            <TabsContent value="saved">
              <SavedHomesTab />
            </TabsContent>
            <TabsContent value="account">
              <AccountPanel />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
