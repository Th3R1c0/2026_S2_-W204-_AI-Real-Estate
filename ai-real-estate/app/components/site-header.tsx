"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Calculator,
  Compass,
  House,
  LayoutGrid,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import AccountPanel from "./account-panel";
import { useAccountWorkspace } from "./account-workspace-provider";

export default function SiteHeader({
  children,
  currentPage,
}: {
  children?: ReactNode;
  currentPage?: "discover" | "workspace";
}) {
  const pathname = usePathname();
  const account = useAccountWorkspace();
  const [accountOpen, setAccountOpen] = useState(false);
  const [calculatorActive, setCalculatorActive] = useState(false);

  useEffect(() => {
    const target = document.getElementById("calculator");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCalculatorActive(entry.isIntersecting),
      { rootMargin: "-80px 0px -80px 0px", threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

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
          aria-current={
            !calculatorActive &&
            (currentPage === "discover" ||
              (!currentPage &&
                (pathname === "/" || pathname?.startsWith("/properties/"))))
              ? "page"
              : undefined
          }
          className="nav-item-discover"
          aria-label="Discover"
          href="/"
        >
          <Compass className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">Discover</span>
          <span className="nav-label-short">Discover</span>
        </Link>
        <Link
          aria-current={
            currentPage === "workspace" ||
            (!currentPage && pathname === "/profile")
              ? "page"
              : undefined
          }
          className="nav-item-workspace"
          aria-label="My workspace"
          href="/profile"
        >
          <LayoutGrid className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">My workspace</span>
          <span className="nav-label-short">Workspace</span>
        </Link>
        <Link
          aria-current={calculatorActive ? "location" : undefined}
          className="nav-item-calculator"
          aria-label="Mortgage calculator"
          href={
            pathname?.startsWith("/properties/")
              ? `${pathname}#calculator`
              : "/#calculator"
          }
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            const target = document.getElementById("calculator");
            if (target) {
              event.preventDefault();
              const mobile = window.matchMedia?.("(max-width: 768px)").matches;
              setCalculatorActive(true);
              target.scrollIntoView({
                behavior: mobile ? "instant" : "smooth",
                block: "start",
              });
              window.history.replaceState(null, "", "#calculator");
            }
          }}
        >
          <Calculator className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">Mortgage calculator</span>
          <span className="nav-label-short">Calculator</span>
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
