import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haven — AI property discovery",
  description:
    "Find New Zealand homes by architecture, sunlight, flood risk, building age and natural-language search.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
