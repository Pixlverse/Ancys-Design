import { Suspense } from "react";
import type { Metadata } from "next";
import { Encode_Sans_Semi_Expanded, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/shell/navigation-progress";

/**
 * Encode Sans Semi Expanded: wide, even letterforms that stay legible on a phone
 * held at arm's length in a busy shop. Body runs at 500 rather than 400 — at the
 * sizes this portal uses, 400 reads as washed out.
 *
 * The CSS variable is deliberately NOT called `--font-sans`: the Tailwind theme
 * defines `--font-sans` in terms of this one, and giving them the same name makes
 * the reference circular. A circular var() is invalid at computed-value time, and
 * font-family then falls back to the browser default — serif.
 */
const sans = Encode_Sans_Semi_Expanded({
  variable: "--font-encode-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ancys Design",
  description: "Order and measurement portal for shop staff.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The variables go on <html>, the same element whose font-family uses them,
    // so resolution never depends on where the class landed.
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
