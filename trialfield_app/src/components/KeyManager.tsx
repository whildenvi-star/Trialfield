"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  clearStoredKey,
  fetchCredits,
  getStoredKey,
  setStoredKey,
} from "@/lib/credits";

export function KeyManager() {
  const [key, setKey] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [inputError, setInputError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = getStoredKey();
    setKey(k);
    if (k) loadCredits(k);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadCredits(k: string) {
    const info = await fetchCredits(k);
    setCredits(info?.valid ? info.credits : null);
  }

  async function handleSetKey() {
    const trimmed = inputVal.trim().toUpperCase();
    if (!trimmed.startsWith("TF-") || trimmed.length < 5) {
      setInputError("Keys start with TF- followed by characters");
      return;
    }
    const info = await fetchCredits(trimmed);
    if (!info?.valid) {
      setInputError("Key not found — check for typos");
      return;
    }
    setStoredKey(trimmed);
    setKey(trimmed);
    setCredits(info.credits);
    setInputVal("");
    setInputError("");
    setOpen(false);
  }

  function handleClear() {
    clearStoredKey();
    setKey("");
    setCredits(null);
    setOpen(false);
  }

  const creditsLabel =
    credits === -1 ? "∞" : credits !== null ? String(credits) : "?";
  const isLow = credits !== null && credits !== -1 && credits <= 2;

  if (!key) {
    return (
      <Link
        href="/buy"
        className="text-sm font-medium text-stone-500 hover:text-green-700 transition-colors"
      >
        Get access
      </Link>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 text-sm font-mono px-3 py-1 rounded-full border transition-colors ${
          isLow
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-stone-200 bg-stone-50 text-stone-600 hover:border-green-400"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isLow ? "bg-amber-500" : "bg-green-500"}`} />
        {key.slice(0, 9)}…
        <span className="font-sans font-semibold">{creditsLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 bg-white border border-stone-200 rounded-xl shadow-lg p-4 space-y-3 z-50">
          <div className="space-y-0.5">
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Access key</p>
            <p className="font-mono text-sm text-stone-800 break-all">{key}</p>
            <p className="text-xs text-stone-400">
              {credits === -1 ? "Unlimited access" : `${credits} run${credits !== 1 ? "s" : ""} remaining`}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/buy"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-full font-medium transition-colors"
            >
              Buy more
            </Link>
            <button
              onClick={handleClear}
              className="flex-1 text-xs border border-stone-200 text-stone-500 hover:text-red-500 hover:border-red-300 py-1.5 rounded-full transition-colors"
            >
              Remove key
            </button>
          </div>

          <div className="border-t border-stone-100 pt-3 space-y-1.5">
            <p className="text-xs text-stone-400">Enter a different key</p>
            <div className="flex gap-1.5">
              <input
                className="border border-stone-300 rounded-lg px-2 py-1 text-xs font-mono flex-1"
                placeholder="TF-XXXXXXXX"
                value={inputVal}
                onChange={(e) => { setInputVal(e.target.value); setInputError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSetKey()}
              />
              <button
                onClick={handleSetKey}
                className="text-xs bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg font-medium transition-colors"
              >
                Use
              </button>
            </div>
            {inputError && <p className="text-xs text-red-500">{inputError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
