"use client";

import { useEffect, useState } from "react";

interface Props {
  files: Map<string, Blob>;
}

export function MapPreview({ files }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    // Find the layout PNG by suffix
    const entry = [...files.entries()].find(([name]) => name.endsWith("_layout.png"));
    if (!entry) return;
    const url = URL.createObjectURL(entry[1]);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);

  if (!src) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-700">Field layout preview</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Trial field layout"
        className="w-full rounded border shadow-sm"
      />
    </div>
  );
}
