"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Calculator,
  Compass,
  House,
  LayoutGrid,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import AccountPanel from "./account-panel";
import { useAccountWorkspace } from "./account-workspace-provider";
import { openMortgageCalculator } from "./mortgage-calculator-sheet";

export type CompactSearchProps = {
  value: string;
  isSearching: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
  /** Return to the main hero search when it has scrolled out of view. */
  onFocus: () => void;
};

export default function SiteHeader({
  children,
  currentPage,
  compactSearch,
}: {
  children?: ReactNode;
  currentPage?: "discover" | "workspace";
  compactSearch?: CompactSearchProps;
}) {
  const pathname = usePathname();
  const account = useAccountWorkspace();
  const [accountOpen, setAccountOpen] = useState(false);

  // Close the account dialog as soon as the visitor is signed in, so no
  // success state is left on screen.
  useEffect(() => {
    if (account?.status === "signedIn") setAccountOpen(false);
  }, [account?.status]);

  function openCalculator(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openMortgageCalculator();
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Haven home">
        <House aria-hidden="true" />
        <span>
          haven<span className="brand-dot">.</span>
        </span>
      </Link>
      {compactSearch ? (
        <form className="header-search" onSubmit={compactSearch.onSubmit}>
          <InputGroup className="header-search-group">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Describe your ideal property"
              onChange={(event) => compactSearch.onChange(event.target.value)}
              onFocus={compactSearch.onFocus}
              placeholder="Search homes…"
              value={compactSearch.value}
            />
            {compactSearch.value ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Clear search query"
                  onClick={compactSearch.onClear}
                  size="icon-sm"
                  type="button"
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
            <InputGroupAddon align="inline-end">
              <Button aria-label="Search" size="sm" type="submit">
                {compactSearch.isSearching ? <Spinner /> : <Search />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </form>
      ) : null}
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

      {/* Main navigation: the bottom tab bar on every screen size. */}
      <nav aria-label="Main navigation" className="main-nav">
        <Link
          aria-current={
            currentPage === "discover" ||
            (!currentPage &&
              (pathname === "/" || pathname?.startsWith("/properties/")))
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
        <a
          className="nav-item-calculator"
          aria-label="Mortgage calculator"
          href="#calculator"
          onClick={openCalculator}
        >
          <Calculator className="nav-icon" aria-hidden="true" />
          <span className="nav-label-full">Mortgage calculator</span>
          <span className="nav-label-short">Calculator</span>
        </a>
      </nav>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="account-dialog" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Your account</DialogTitle>
          <AccountPanel initialMode="login" />
        </DialogContent>
      </Dialog>
    </header>
  );
}
