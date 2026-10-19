"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Calculator, Compass, House, LayoutGrid, UserRound } from "lucide-react";
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
        <Link
          aria-current={pathname === "/" ? "page" : undefined}
          className="nav-item-discover"
          href="/"
        >
          <Compass className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">Discover</span>
          <span className="nav-label-short" aria-hidden="true">
            Discover
          </span>
        </Link>
        <Link
          aria-current={pathname === "/profile" ? "page" : undefined}
          className="nav-item-workspace"
          href="/profile"
        >
          <LayoutGrid className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">My workspace</span>
          <span className="nav-label-short" aria-hidden="true">
            Workspace
          </span>
        </Link>
        <Link
          className="nav-item-calculator"
          href="/#calculator"
          onClick={(event) => {
            const target = document.getElementById("calculator");
            if (target) {
              event.preventDefault();
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              window.history.replaceState(null, "", "#calculator");
            }
          }}
        >
          <Calculator className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">Mortgage calculator</span>
          <span className="nav-label-short" aria-hidden="true">
            Calculator
          </span>
        </Link>
      </nav>
      <div className="header-actions">
        {children}
        {account?.status === "loading" ? (
          <Skeleton className="h-9 w-[88px] rounded-md" />
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
