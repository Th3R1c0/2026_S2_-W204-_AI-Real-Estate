"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import MortgageCalculator from "./mortgage-calculator";

type SheetEvent = "haven:open-mortgage-calculator" | "haven:close-mortgage-calculator";

/** Open the bottom-sheet calculator from anywhere (e.g. the nav bar). */
export function openMortgageCalculator() {
  window.dispatchEvent(new Event("haven:open-mortgage-calculator" satisfies SheetEvent));
}

/**
 * Mortgage calculator presented as a bottom sheet: it slides up from the bottom
 * edge of the screen and back down when closed. Height fits its content.
 */
export default function MortgageCalculatorSheet({
  defaultPrice = 850000,
}: {
  defaultPrice?: number;
}) {
  // Always start closed so server and client markup match; a #calculator
  // deep link is opened by the hash effect below.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    const hide = () => setOpen(false);
    window.addEventListener("haven:open-mortgage-calculator", show);
    window.addEventListener("haven:close-mortgage-calculator", hide);
    // Deep links such as /#calculator or /properties/x#calculator.
    const syncFromHash = () => {
      if (window.location.hash === "#calculator") setOpen(true);
    };
    // Run after hydration rather than during the first client render, which
    // would change the markup before React has hydrated the tree.
    queueMicrotask(syncFromHash);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("haven:open-mortgage-calculator", show);
      window.removeEventListener("haven:close-mortgage-calculator", hide);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && window.location.hash === "#calculator")
          window.history.replaceState(null, "", window.location.pathname);
      }}
    >
      <DialogContent
        className="mortgage-sheet top-auto bottom-0 left-0 right-0 mx-auto translate-none"
        overlayClassName="mortgage-sheet-overlay"
        aria-describedby={undefined}
        showCloseButton
      >
        <DialogTitle className="sr-only">Mortgage calculator</DialogTitle>
        <div className="mortgage-sheet-handle" aria-hidden="true" />
        <MortgageCalculator defaultPrice={defaultPrice} />
      </DialogContent>
    </Dialog>
  );
}
