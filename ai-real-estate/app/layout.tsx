import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { AccountWorkspaceProvider } from "./components/account-workspace-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const AIChatbot = dynamic(() => import("./components/ai-chatbot"), {
  ssr: true,
});

export const metadata: Metadata = {
  title: "Haven — Find your place",
  description:
    "Find New Zealand homes by architecture, mapped flood hazards, building age and natural-language search.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NZ" className="font-sans" data-scroll-behavior="smooth">
      <body>
        <AccountWorkspaceProvider>
          <TooltipProvider>
            {children}
            <AIChatbot />
          </TooltipProvider>
        </AccountWorkspaceProvider>
      </body>
    </html>
  );
}
