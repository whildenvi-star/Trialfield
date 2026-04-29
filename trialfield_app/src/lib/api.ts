import type { DesignRequest } from "./types";
import { getStoredKey } from "./credits";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function postDesign(req: DesignRequest): Promise<Blob> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NEXT_PUBLIC_PAYMENT_ENABLED === "true") {
    const key = getStoredKey();
    if (key) headers["X-Access-Key"] = key;
  }

  const res = await fetch(`${API_URL}/design`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.blob();
}
