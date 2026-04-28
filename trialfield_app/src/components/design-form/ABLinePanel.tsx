"use client";

import { useState } from "react";
import { ABLineMap } from "./ABLineMap";
import { BoundaryUpload } from "./BoundaryUpload";
import type { LatLon, GeoJSONPolygon } from "./ABLineMap";

interface Props {
  aLon: string;
  aLat: string;
  bLon: string;
  bLat: string;
  onChange: (field: "aLon" | "aLat" | "bLon" | "bLat", value: string) => void;
  boundary: GeoJSONPolygon | null;
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
}

type Placing = "A" | "B" | null;

function fmt(n: number) {
  return n.toFixed(8);
}

export function ABLinePanel({
  aLon, aLat, bLon, bLat, onChange,
  boundary, onBoundaryChange,
}: Props) {
  const [placing, setPlacing] = useState<Placing>(null);
  const [drawingBoundary, setDrawingBoundary] = useState(false);

  const pointA: LatLon | null =
    aLon && aLat ? { lat: parseFloat(aLat), lon: parseFloat(aLon) } : null;
  const pointB: LatLon | null =
    bLon && bLat ? { lat: parseFloat(bLat), lon: parseFloat(bLon) } : null;

  function handlePlace(point: "A" | "B", lat: number, lon: number) {
    if (point === "A") {
      onChange("aLat", fmt(lat));
      onChange("aLon", fmt(lon));
      if (placing === "A") setPlacing("B");
    } else {
      onChange("bLat", fmt(lat));
      onChange("bLon", fmt(lon));
      if (placing === "B") setPlacing(null);
    }
  }

  function handleDrawToggle() {
    if (boundary) {
      // Clear existing boundary
      onBoundaryChange(null);
      setDrawingBoundary(false);
    } else {
      // Disarm AB placement while drawing, then start draw mode
      setPlacing(null);
      setDrawingBoundary((d) => !d);
    }
  }

  return (
    <div className="space-y-3">
      <ABLineMap
        pointA={pointA}
        pointB={pointB}
        placing={placing}
        onPlace={handlePlace}
        boundary={boundary}
        drawingBoundary={drawingBoundary}
        onBoundaryChange={onBoundaryChange}
        onDrawingComplete={() => setDrawingBoundary(false)}
      />

      {/* Control buttons row */}
      <div className="flex gap-2 text-sm flex-wrap">
        <button
          type="button"
          onClick={() => {
            setDrawingBoundary(false);
            setPlacing(placing === "A" ? null : "A");
          }}
          className={`flex-1 border rounded py-1 font-medium transition-colors ${
            placing === "A"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {placing === "A" ? "Click map for A…" : "Place A"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDrawingBoundary(false);
            setPlacing(placing === "B" ? null : "B");
          }}
          className={`flex-1 border rounded py-1 font-medium transition-colors ${
            placing === "B"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {placing === "B" ? "Click map for B…" : "Place B"}
        </button>
        <button
          type="button"
          onClick={handleDrawToggle}
          className={`flex-1 border rounded py-1 font-medium transition-colors ${
            drawingBoundary
              ? "bg-green-600 text-white border-green-600"
              : boundary
              ? "bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {drawingBoundary
            ? "Draw boundary…"
            : boundary
            ? "Clear boundary"
            : "Draw boundary"}
        </button>
        {(pointA || pointB) && (
          <button
            type="button"
            onClick={() => {
              onChange("aLon", ""); onChange("aLat", "");
              onChange("bLon", ""); onChange("bLat", "");
              setPlacing(null);
            }}
            className="border rounded px-3 py-1 text-gray-400 hover:text-red-500 hover:bg-red-50"
            title="Clear AB line"
          >
            ×
          </button>
        )}
      </div>

      {/* Coordinate inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            A — Lon, Lat
          </label>
          <div className="flex gap-1">
            <input
              className="border rounded px-2 py-1 text-xs w-full font-mono"
              placeholder="-89.10575"
              type="number"
              step="any"
              value={aLon}
              onChange={(e) => onChange("aLon", e.target.value)}
            />
            <input
              className="border rounded px-2 py-1 text-xs w-full font-mono"
              placeholder="42.56241"
              type="number"
              step="any"
              value={aLat}
              onChange={(e) => onChange("aLat", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            B — Lon, Lat
          </label>
          <div className="flex gap-1">
            <input
              className="border rounded px-2 py-1 text-xs w-full font-mono"
              placeholder="-89.11105"
              type="number"
              step="any"
              value={bLon}
              onChange={(e) => onChange("bLon", e.target.value)}
            />
            <input
              className="border rounded px-2 py-1 text-xs w-full font-mono"
              placeholder="42.56250"
              type="number"
              step="any"
              value={bLat}
              onChange={(e) => onChange("bLat", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Upload path — replaces drawn boundary if used */}
      <BoundaryUpload
        onBoundaryChange={(g) => {
          onBoundaryChange(g);
          setDrawingBoundary(false);
        }}
      />

      <p className="text-xs text-gray-400">
        {drawingBoundary
          ? "Click vertices to trace the field boundary. Click the first point to close."
          : "Click Place A / Place B then click the map, or type coordinates. Markers are draggable."}
      </p>
    </div>
  );
}
