"use client";

import { useRef, useState } from "react";
import { parseGuidanceLineFile } from "@/lib/abline";
import type { ABPoints } from "@/lib/abline";

interface Props {
  onABChange: (pts: ABPoints) => void;
}

export function ABLineUpload({ onABChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleFile(file: File) {
    setStatus("loading");
    setMessage("");
    try {
      const pts = await parseGuidanceLineFile(file);
      onABChange(pts);
      setStatus("ok");
      setMessage(file.name);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg px-4 py-3 text-center cursor-pointer transition-colors text-sm ${
        status === "ok"
          ? "border-blue-400 bg-blue-50 text-blue-700"
          : status === "error"
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-gray-300 hover:border-gray-400 text-gray-500"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.kml,.kmz,.geojson,.json,.zip"
        className="hidden"
        onChange={handleChange}
      />
      {status === "loading" && "Parsing…"}
      {status === "ok" && `✓ AB line loaded from ${message}`}
      {status === "error" && `Error: ${message}`}
      {status === "idle" && (
        <>
          Drop or click to load guidance line
          <br />
          <span className="text-xs text-gray-400">
            .gpx · .kml · .kmz · .geojson · shapefile .zip
          </span>
        </>
      )}
    </div>
  );
}
