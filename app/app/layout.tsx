import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polaris – Fight AI Fakes",
  description: "Upload, encrypt, hash, and verify photos/videos.",
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
