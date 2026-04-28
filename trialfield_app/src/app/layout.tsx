import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        {children}
        <footer className="mt-auto py-6 text-center text-sm text-gray-400">
          <a
            href="https://paypal.me/whildenhughes"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-full border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            Support this project
          </a>
        </footer>
      </body>
    </html>
  );
}
