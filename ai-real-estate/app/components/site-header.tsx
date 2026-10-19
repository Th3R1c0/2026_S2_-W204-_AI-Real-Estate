"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { House, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import AccountPanel from "./account-panel";
import { useAccountWorkspace } from "./account-workspace-provider";

export default function SiteHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const account = useAccountWorkspace();
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Haven home">
        <House aria-hidden="true" />
        <span>
          haven<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav aria-label="Main navigation" className="main-nav">
        <Link aria-current={pathname === "/" ? "page" : undefined} href="/">
          Discover
        </Link>
        <Link href="/#calculator">Mortgage calculator</Link>
        <Link
          aria-current={pathname === "/profile" ? "page" : undefined}
          href="/profile"
        >
          My workspace
        </Link>
      </nav>
      <div className="header-actions">
        {children}
        {account?.status === "loading" ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <Button
            variant="outline"
            onClick={() => setAccountOpen(true)}
            type="button"
          >
            <UserRound data-icon="inline-start" />
            {account?.status === "signedIn"
              ? account.user?.username
              : "Sign in"}
          </Button>
        )}
      </div>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="account-dialog" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Your account</DialogTitle>
          <AccountPanel initialMode="login" />
        </DialogContent>
      </Dialog>
    </header>
  );
}
