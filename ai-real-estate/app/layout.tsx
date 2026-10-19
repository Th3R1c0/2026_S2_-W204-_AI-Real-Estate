import type { Metadata } from "next";
import "./globals.css";
import AIChatbot from "./components/ai-chatbot";
import { AccountWorkspaceProvider } from "./components/account-workspace-provider";

export const metadata: Metadata = {
  title: "Haven — AI property discovery",
  description:
    "Find New Zealand homes by architecture, sunlight, flood risk, building age and natural-language search.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NZ">
      <body>
        <AccountWorkspaceProvider>
          {children}
          <AIChatbot />
        </AccountWorkspaceProvider>
      </body>
    </html>
  );
}
