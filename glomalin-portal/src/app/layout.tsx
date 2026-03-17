import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GLOMALIN",
  description: "Farm Operations Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/platform-tokens.css" />
        {/* PWA manifest and theme */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#080604" />
        {/* iOS PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('mru-text-scale');if(s)document.documentElement.style.setProperty('--text-scale',s);if(localStorage.getItem('mru-theme')==='light')document.documentElement.classList.add('light')})();`,
          }}
        />
      </head>
      <body className={`${jetbrains.variable} antialiased`}>
        {children}
        <InstallPrompt />
        <Script src="/settings-panel.js" strategy="afterInteractive" />
        <Script src="/formatting-agent.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
