import type { Metadata, Viewport } from "next";
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
  applicationName: "Glomalin",
  appleWebApp: {
    capable: true,
    // The home-screen label. Without this iOS uses the <title>, so the icon
    // would read "GLOMALIN" in shouting caps under a 60px icon.
    title: "Glomalin",
    statusBarStyle: "black-translucent",
  },
};

// viewport-fit=cover is what makes env(safe-area-inset-*) return real values on
// iOS. Without it the insets are all 0 — and since the status bar style is
// black-translucent, the bar draws straight over the app chrome with nothing
// padding it out of the way.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080604",
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
        {/* theme-color and every apple-mobile-web-app-* tag are emitted by the
            metadata/viewport exports above — declaring them here too would
            duplicate them in the head. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS picks the 180x180 for the home screen; giving it the exact size
            avoids Safari downscaling the 192 and softening the mark. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
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
