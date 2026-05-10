import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClawMind",
  description:
    "Multi-agent Web3 due diligence with adversarial review and on-chain report anchoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
