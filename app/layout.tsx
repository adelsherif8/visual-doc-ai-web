import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Visual Document AI — extract structured data from documents",
  description:
    "Upload an invoice, receipt, or ID and get bounding boxes over every field, structured JSON with confidence, and a baseline-vs-VLM comparison. Next.js + OpenAI vision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
