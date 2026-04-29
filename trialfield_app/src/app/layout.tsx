import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trialfield",
  description: "On-farm strip trial designer",
};

import { NavKeyManager } from "@/components/NavKeyManager";

const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_ENABLED === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-bold text-green-700 text-lg tracking-tight hover:text-green-800 transition-colors"
            >
              Trialfield
            </Link>
            <div className="flex items-center gap-4">
              {PAYMENT_ENABLED && <NavKeyManager />}
              <Link
                href="/design"
                className="text-sm font-medium text-stone-500 hover:text-green-700 transition-colors"
              >
                Design a trial →
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="py-6 border-t border-stone-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-stone-400">
            <span>Built for farmers, by farmers.</span>
            <a
              href="https://paypal.me/whildenhughes"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-1.5 rounded-full border border-stone-300 text-stone-500 hover:border-green-500 hover:text-green-700 transition-colors"
            >
              Support this project
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
