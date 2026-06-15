"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/credits";

const PACKS = [
  {
    id: "starter" as const,
    name: "Starter",
    runs: 5,
    price: "$5",
    perRun: "$1.00 / run",
    badge: null,
    description: "Perfect for a single field season.",
  },
  {
    id: "pro" as const,
    name: "Pro",
    runs: 15,
    price: "$10",
    perRun: "$0.67 / run",
    badge: "Best value",
    description: "Ideal for multiple trials or a full operation.",
  },
];

export default function BuyPage() {
  const [loading, setLoading] = useState<"starter" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(pack: "starter" | "pro") {
    setLoading(pack);
    setError(null);
    try {
      await startCheckout(pack);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div className="bg-stone-50 min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-stone-900">Get access</h1>
          <p className="text-stone-500">
            Buy a credit pack. Each credit = one design run. Credits never expire.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative bg-white rounded-xl p-6 space-y-4 shadow-sm border-2 transition-colors ${
                pack.badge ? "border-green-500" : "border-stone-100"
              }`}
            >
              {pack.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  {pack.badge}
                </span>
              )}

              <div>
                <h2 className="font-bold text-stone-900 text-lg">{pack.name}</h2>
                <p className="text-stone-400 text-sm">{pack.description}</p>
              </div>

              <div>
                <span className="text-4xl font-bold text-stone-900">{pack.price}</span>
                <span className="text-stone-400 text-sm ml-2">· {pack.runs} runs</span>
                <p className="text-xs text-stone-400 mt-0.5">{pack.perRun}</p>
              </div>

              <button
                onClick={() => handleBuy(pack.id)}
                disabled={loading !== null}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-full font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading === pack.id ? "Redirecting…" : `Buy ${pack.name}`}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        <p className="text-center text-xs text-stone-400">
          Payments processed securely by Stripe. Credits are tied to your access key — keep it safe.
        </p>
      </div>
    </div>
  );
}
