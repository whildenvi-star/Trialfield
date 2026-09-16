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
        {/* Pre-paint theme + text restore. Shared with the six Express apps
            from shared/platform/theme-boot.js so the default lives in one
            place — the portal previously defaulted to dark here while
            settings-panel.js defaulted to light, and the shell visibly
            swapped themes on first load. Plain <script> rather than next/script:
            this has to block paint, which beforeInteractive does not guarantee. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-boot.js?v=1" />
      </head>
      <body className={`${jetbrains.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement,m=r.className.match(/([a-z]+)-pending/);if(m){r.classList.add(m[1]);document.body.classList.add(m[1]);r.classList.remove(m[1]+'-pending')}if(r.classList.contains('in-iframe'))document.body.classList.add('in-iframe')})();`,
          }}
        />
        {children}
        <InstallPrompt />
        <Script src="/settings-panel.js" strategy="afterInteractive" />
        <Script src="/formatting-agent.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
