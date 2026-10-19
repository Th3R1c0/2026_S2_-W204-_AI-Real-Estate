import type { Metadata } from "next";
import "./globals.css";
import AIChatbot from "./components/ai-chatbot";
import { AccountWorkspaceProvider } from "./components/account-workspace-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Haven — Find your place",
  description:
    "Find New Zealand homes by architecture, sunlight, flood risk, building age and natural-language search.",
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
