import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Savra Question Paper Generator — AI exam papers for teachers",
  description:
    "Describe an exam in plain English and get a complete, board-ready question paper with real math, a blueprint, and an answer key — in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
