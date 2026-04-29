const STORAGE_KEY = "trialf_key";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setStoredKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export interface CreditInfo {
  valid: boolean;
  credits: number;
  key: string;
}

export async function fetchCredits(key: string): Promise<CreditInfo | null> {
  try {
    const r = await fetch(`${API}/credits?key=${encodeURIComponent(key)}`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export async function startCheckout(pack: "starter" | "pro"): Promise<void> {
  const r = await fetch(`${API}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack }),
  });
  if (!r.ok) throw new Error("Failed to create checkout session");
  const data = await r.json();
  setStoredKey(data.key);
  window.location.href = data.url;
}
