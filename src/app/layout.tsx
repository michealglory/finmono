import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceFlow",
  description: "Personal finance tracker with multi-account, multi-currency and AI imports"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
