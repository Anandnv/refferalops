import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KHOPS Referral Tracker",
  description: "Personal referral incentive tracking for KHOPS operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
