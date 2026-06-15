"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getStoredKey, fetchCredits } from "@/lib/credits";

export default function SuccessPage() {
  const [key, setKey] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const k = getStoredKey();
    setKey(k);
    if (!k) return;

    let attempts = 0;
    const MAX = 15; // 15 × 2 s = 30 s

    pollRef.current = setInterval(async () => {
      attempts++;
      const info = await fetchCredits(k);
      if (info && info.credits > 0) {
        setCredits(info.credits);
        clearInterval(pollRef.current!);
      } else if (attempts >= MAX) {
        setTimedOut(true);
        clearInterval(pollRef.current!);
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function copyKey() {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-stone-50 min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 space-y-6 text-center">

        {credits !== null ? (
          <>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto text-2xl">
              ✓
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-stone-900">You&apos;re all set!</h1>
              <p className="text-stone-500 text-sm">
                {credits} design run{credits !== 1 ? "s" : ""} loaded. Save your access key below — you&apos;ll need it each time you use the app.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Your access key</p>
              <p className="font-mono text-xl font-bold text-stone-900 tracking-widest">{key}</p>
              <button
                onClick={copyKey}
                className="text-sm text-green-700 hover:text-green-900 font-medium"
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>

            <Link
              href="/design"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-sm"
            >
              Design a trial →
            </Link>
          </>
        ) : timedOut ? (
          <>
            <h1 className="text-xl font-bold text-stone-900">Payment received</h1>
            <p className="text-stone-500 text-sm">
              Your key is being activated — this can take a minute. Come back shortly or refresh the page.
            </p>
            {key && (
              <p className="font-mono text-lg font-bold text-stone-700">{key}</p>
            )}
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto animate-pulse text-2xl">
              ⏳
            </div>
            <h1 className="text-xl font-bold text-stone-900">Activating your key…</h1>
            <p className="text-stone-400 text-sm">Just a moment while we confirm your payment.</p>
          </>
        )}
      </div>
    </div>
  );
}
