import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClawMind",
  description:
    "Persistent multi-agent cognitive backbone for autonomous Web3 decision-making.",
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