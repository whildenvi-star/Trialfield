"use client";

import { useRef, useState } from "react";
import { parseBoundaryFile } from "@/lib/boundary";
import type { GeoJSONPolygon } from "./ABLineMap";

interface Props {
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
}

export function BoundaryUpload({ onBoundaryChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleFile(file: File) {
    setStatus("loading");
    setMessage("");
    try {
      const geojson = await parseBoundaryFile(file);
      onBoundaryChange(geojson);
      setStatus("ok");
      setMessage(file.name);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
      onBoundaryChange(null);
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
          ? "border-green-400 bg-green-50 text-green-700"
          : status === "error"
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-stone-300 bg-stone-50 hover:border-green-400 hover:bg-green-50 text-stone-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,.zip"
        className="hidden"
        onChange={handleChange}
      />
      {status === "loading" && "Parsing…"}
      {status === "ok" && `✓ ${message}`}
      {status === "error" && `Error: ${message}`}
      {status === "idle" && (
        <>Drop or click to upload boundary<br />
          <span className="text-xs text-stone-400">.geojson · .json · shapefile .zip</span>
        </>
      )}
    </div>
  );
}
