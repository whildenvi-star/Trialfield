"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-until";
const DISMISS_DAYS = 7;

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

function isInStandaloneMode(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Don't show if already installed in standalone mode
    if (isInStandaloneMode()) return;

    // Don't show if recently dismissed
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;

    if (isIOS()) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions
      setShowIOSHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      setShowBanner(false);
      setDeferredPrompt(null);
    });
  }

  function handleDismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShowBanner(false);
    setShowIOSHint(false);
  }

  if (!mounted) return null;
  if (!showBanner && !showIOSHint) return null;

  return (
    <div
      role="banner"
      aria-label="Install Glomalin app"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded border border-[#2a2218] bg-[#0e0c0b] p-4 shadow-lg"
    >
      {showBanner && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#e8d8c0]">
            Install Glomalin for offline access
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleInstall}
              className="rounded bg-[#C8860A] px-3 py-1.5 text-sm font-medium text-[#080604] transition-opacity hover:opacity-90"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded border border-[#2a2218] px-3 py-1.5 text-sm text-[#6a5a4a] transition-colors hover:text-[#e8d8c0]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showIOSHint && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#e8d8c0]">
              Install Glomalin
            </p>
            <p className="mt-1 text-xs text-[#6a5a4a]">
              Tap{" "}
              <span className="text-[#C8860A]">Share</span>
              {" "}then{" "}
              <span className="text-[#C8860A]">Add to Home Screen</span>
              {" "}for offline access.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install hint"
            className="shrink-0 text-[#6a5a4a] transition-colors hover:text-[#e8d8c0]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
