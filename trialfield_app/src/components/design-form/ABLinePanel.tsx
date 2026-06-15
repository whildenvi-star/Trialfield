"use client";

import { useState } from "react";
import { ABLineMap } from "./ABLineMap";
import { ABLineUpload } from "./ABLineUpload";
import { BoundaryUpload } from "./BoundaryUpload";
import { fetchSoilZones } from "@/lib/api";
import type { LatLon, GeoJSONPolygon, SoilZoneFeature } from "./ABLineMap";
import type { ABPoints } from "@/lib/abline";

interface Props {
  aLon: string;
  aLat: string;
  bLon: string;
  bLat: string;
  onChange: (field: "aLon" | "aLat" | "bLon" | "bLat", value: string) => void;
  boundary: GeoJSONPolygon | null;
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
  trialZone: GeoJSONPolygon | null;
  onTrialZoneChange: (geojson: GeoJSONPolygon | null) => void;
}

type Placing = "A" | "B" | null;

function fmt(n: number) {
  return n.toFixed(8);
}

export function ABLinePanel({
  aLon, aLat, bLon, bLat, onChange,
  boundary, onBoundaryChange,
  trialZone, onTrialZoneChange,
}: Props) {
  const [placing, setPlacing] = useState<Placing>(null);
  const [drawingBoundary, setDrawingBoundary] = useState(false);
  const [drawingTrialZone, setDrawingTrialZone] = useState(false);
  const [soilZones, setSoilZones] = useState<SoilZoneFeature[]>([]);
  const [loadingSoilZones, setLoadingSoilZones] = useState(false);

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
    setDrawingTrialZone(false);
    if (boundary) {
      onBoundaryChange(null);
      setDrawingBoundary(false);
    } else {
      setPlacing(null);
      setDrawingBoundary((d) => !d);
    }
  }

  function handleTrialZoneToggle() {
    setDrawingBoundary(false);
    if (trialZone) {
      onTrialZoneChange(null);
      setDrawingTrialZone(false);
    } else {
      setPlacing(null);
      setDrawingTrialZone((d) => !d);
    }
  }

  async function handleSoilZonesToggle() {
    if (soilZones.length > 0) {
      setSoilZones([]);
      return;
    }
    if (!boundary) return;
    setLoadingSoilZones(true);
    const fc = await fetchSoilZones(boundary);
    setSoilZones(fc.features as SoilZoneFeature[]);
    setLoadingSoilZones(false);
  }

  function handleSoilZoneClick(feature: SoilZoneFeature) {
    // Convert soil zone geometry to GeoJSONPolygon (Polygon only)
    let geom: GeoJSONPolygon;
    if (feature.geometry.type === "Polygon") {
      geom = feature.geometry as GeoJSONPolygon;
    } else {
      // MultiPolygon: use first polygon
      const firstPoly = (feature.geometry.coordinates as number[][][][])[0];
      geom = { type: "Polygon", coordinates: firstPoly };
    }
    onTrialZoneChange(geom);
    setSoilZones([]);
  }

  let hint = "Click Place A / Place B then click the map, or type coordinates. Markers are draggable.";
  if (drawingBoundary) hint = "Click vertices to trace the field boundary. Click the first point to close.";
  else if (drawingTrialZone) hint = "Click vertices to trace the trial zone (sub-area for plot placement). Click the first point to close.";
  else if (soilZones.length > 0) hint = "Click a soil zone to use it as the trial zone. Soil zones are colored by map unit.";

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
        trialZone={trialZone}
        drawingTrialZone={drawingTrialZone}
        onTrialZoneChange={onTrialZoneChange}
        onTrialZoneDrawComplete={() => setDrawingTrialZone(false)}
        soilZones={soilZones}
        onSoilZoneClick={handleSoilZoneClick}
        snappingField={false}
        onSnapDone={() => {}}
        onSnapFail={() => {}}
      />

      {/* Control buttons row */}
      <div className="flex gap-2 text-sm flex-wrap">
        <button
          type="button"
          onClick={() => {
            setDrawingBoundary(false);
            setDrawingTrialZone(false);
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
            setDrawingTrialZone(false);
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
          {drawingBoundary ? "Drawing boundary…" : boundary ? "Clear boundary" : "Draw boundary"}
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

      {/* Trial zone row — only shown when field boundary is set */}
      {boundary && (
        <div className="flex gap-2 text-sm flex-wrap">
          <button
            type="button"
            onClick={handleTrialZoneToggle}
            className={`flex-1 border rounded py-1 font-medium transition-colors ${
              drawingTrialZone
                ? "bg-orange-500 text-white border-orange-500"
                : trialZone
                ? "bg-orange-100 text-orange-800 border-orange-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {drawingTrialZone ? "Drawing trial zone…" : trialZone ? "Clear trial zone" : "Draw trial zone"}
          </button>
          <button
            type="button"
            onClick={handleSoilZonesToggle}
            disabled={loadingSoilZones}
            className={`flex-1 border rounded py-1 font-medium transition-colors disabled:opacity-50 ${
              soilZones.length > 0
                ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {loadingSoilZones ? "Loading…" : soilZones.length > 0 ? "Clear soil zones" : "Load soil zones"}
          </button>
        </div>
      )}

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

      {/* Guidance line upload — populates A/B from file */}
      <ABLineUpload
        onABChange={(pts: ABPoints) => {
          onChange("aLon", fmt(pts.aLon));
          onChange("aLat", fmt(pts.aLat));
          onChange("bLon", fmt(pts.bLon));
          onChange("bLat", fmt(pts.bLat));
          setPlacing(null);
        }}
      />

      {/* Upload path — replaces drawn boundary if used */}
      <BoundaryUpload
        onBoundaryChange={(g) => {
          onBoundaryChange(g);
          setDrawingBoundary(false);
        }}
      />

      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  );
}
