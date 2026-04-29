"use client";

import dynamic from "next/dynamic";

const KeyManager = dynamic(
  () => import("@/components/KeyManager").then((m) => m.KeyManager),
  { ssr: false }
);

export function NavKeyManager() {
  return <KeyManager />;
}
