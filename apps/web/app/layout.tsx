import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Numeron",
  description: "Hybrid native + Next.js + Bevy WASM game starter",
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
