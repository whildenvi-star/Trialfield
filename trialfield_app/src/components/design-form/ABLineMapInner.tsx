"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";

// Geoman expects window.L to exist before its module body runs.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).L = L;
}

function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface SoilZoneFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: { mukey: string; muname: string; compname: string };
}

// ── Fit map to boundary / trial zone when set ────────────────────────────────

function BoundaryFitter({
  boundary,
  trialZone,
}: {
  boundary: GeoJSONPolygon | null;
  trialZone: GeoJSONPolygon | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!boundary) return;
    const latlngs = boundary.coordinates[0].map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );
    map.fitBounds(latlngs, { padding: [24, 24] });
  }, [boundary, map]);
  useEffect(() => {
    if (!trialZone) return;
    const latlngs = trialZone.coordinates[0].map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );
    map.fitBounds(latlngs, { padding: [24, 24] });
  }, [trialZone, map]);
  return null;
}

// ── Click handler for AB point placement ──────────────────────────────────────

interface ClickHandlerProps {
  placing: "A" | "B" | null;
  onPlace: (point: "A" | "B", lat: number, lon: number) => void;
}

function ClickHandler({ placing, onPlace }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (placing) onPlace(placing, e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Geoman polygon draw controller ────────────────────────────────────────────

interface GeomanControllerProps {
  drawingBoundary: boolean;
  drawingTrialZone: boolean;
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
  onBoundaryDrawComplete: () => void;
  onTrialZoneChange: (geojson: GeoJSONPolygon | null) => void;
  onTrialZoneDrawComplete: () => void;
}

function GeomanController({
  drawingBoundary,
  drawingTrialZone,
  onBoundaryChange,
  onBoundaryDrawComplete,
  onTrialZoneChange,
  onTrialZoneDrawComplete,
}: GeomanControllerProps) {
  const map = useMap();
  const activeRef = useRef<"boundary" | "trialZone" | null>(null);

  useEffect(() => {
    activeRef.current = drawingBoundary ? "boundary" : drawingTrialZone ? "trialZone" : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = (map as any).pm;
    if (!pm) return;
    if (drawingBoundary || drawingTrialZone) {
      pm.enableDraw("Polygon", { snappable: false, tooltips: false });
    } else {
      pm.disableDraw();
    }
  }, [drawingBoundary, drawingTrialZone, map]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleCreate(e: any) {
      const geojson = e.layer.toGeoJSON().geometry as GeoJSONPolygon;
      map.removeLayer(e.layer);
      if (activeRef.current === "boundary") {
        onBoundaryChange(geojson);
        onBoundaryDrawComplete();
      } else if (activeRef.current === "trialZone") {
        onTrialZoneChange(geojson);
        onTrialZoneDrawComplete();
      }
    }
    map.on("pm:create", handleCreate);
    return () => {
      map.off("pm:create", handleCreate);
    };
  }, [map, onBoundaryChange, onBoundaryDrawComplete, onTrialZoneChange, onTrialZoneDrawComplete]);

  return null;
}

// ── Soil zone polygon renderer ────────────────────────────────────────────────

const SOIL_COLORS = [
  "#c8a97d", "#8fbc8f", "#d4b896", "#a0b4a0",
  "#c9b08a", "#9ab09a", "#d2c4a0", "#94a894",
];

function SoilZones({
  features,
  onSoilZoneClick,
}: {
  features: SoilZoneFeature[];
  onSoilZoneClick: (f: SoilZoneFeature) => void;
}) {
  return (
    <>
      {features.map((f, fi) => {
        const color = SOIL_COLORS[fi % SOIL_COLORS.length];
        const pathOptions = { color: "#7c5c2e", fillColor: color, fillOpacity: 0.40, weight: 1.5 };

        const rings: [number, number][][] = [];
        if (f.geometry.type === "Polygon") {
          for (const ring of f.geometry.coordinates as number[][][]) {
            rings.push(ring.map(([lon, lat]) => [lat, lon]));
          }
          return (
            <Polygon
              key={f.properties.mukey}
              positions={rings as [number, number][][]}
              pathOptions={pathOptions}
              eventHandlers={{ click: () => onSoilZoneClick(f) }}
            />
          );
        } else {
          return (f.geometry.coordinates as number[][][][]).map((poly, pi) => {
            const polyRings = poly.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number]));
            return (
              <Polygon
                key={`${f.properties.mukey}-${pi}`}
                positions={polyRings}
                pathOptions={pathOptions}
                eventHandlers={{ click: () => onSoilZoneClick(f) }}
              />
            );
          });
        }
      })}
    </>
  );
}

// ── Main map component ────────────────────────────────────────────────────────

export interface Props {
  pointA: LatLon | null;
  pointB: LatLon | null;
  placing: "A" | "B" | null;
  onPlace: (point: "A" | "B", lat: number, lon: number) => void;
  boundary: GeoJSONPolygon | null;
  drawingBoundary: boolean;
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
  onDrawingComplete: () => void;
  trialZone: GeoJSONPolygon | null;
  drawingTrialZone: boolean;
  onTrialZoneChange: (geojson: GeoJSONPolygon | null) => void;
  onTrialZoneDrawComplete: () => void;
  soilZones: SoilZoneFeature[];
  onSoilZoneClick: (feature: SoilZoneFeature) => void;
  snappingField: boolean;
  onSnapDone: () => void;
  onSnapFail: (msg: string) => void;
}

const MARKER_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const DEFAULT_CENTER: [number, number] = [41.5, -93.0];
const DEFAULT_ZOOM = 5;

export function ABLineMapInner({
  pointA,
  pointB,
  placing,
  onPlace,
  boundary,
  drawingBoundary,
  onBoundaryChange,
  onDrawingComplete,
  trialZone,
  drawingTrialZone,
  onTrialZoneChange,
  onTrialZoneDrawComplete,
  soilZones,
  onSoilZoneClick,
}: Props) {
  const fixedRef = useRef(false);
  const [satellite, setSatellite] = useState(true);
  const [geomanReady, setGeomanReady] = useState(false);

  useEffect(() => {
    if (!fixedRef.current) {
      fixLeafletIcons();
      fixedRef.current = true;
    }
    import("@geoman-io/leaflet-geoman-free").then(() => setGeomanReady(true));
  }, []);

  const center: [number, number] = pointA
    ? [pointA.lat, pointA.lon]
    : DEFAULT_CENTER;
  const zoom = pointA ? 14 : DEFAULT_ZOOM;

  const boundaryPositions: [number, number][] | null = boundary
    ? boundary.coordinates[0].map(([lon, lat]) => [lat, lon])
    : null;

  const trialZonePositions: [number, number][] | null = trialZone
    ? trialZone.coordinates[0].map(([lon, lat]) => [lat, lon])
    : null;

  const cursor = placing || drawingBoundary || drawingTrialZone ? "cursor-crosshair" : "";

  if (!geomanReady) {
    return <div className="h-[320px] bg-gray-100 rounded-lg animate-pulse" />;
  }

  return (
    <div style={{ position: "relative" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "320px", width: "100%", borderRadius: "0.5rem" }}
        className={cursor}
      >
        {satellite ? (
          <>
            <TileLayer
              attribution='Imagery &copy; <a href="https://www.esri.com">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </>
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <BoundaryFitter boundary={boundary} trialZone={trialZone} />
        <ClickHandler placing={placing} onPlace={onPlace} />
        <GeomanController
          drawingBoundary={drawingBoundary}
          drawingTrialZone={drawingTrialZone}
          onBoundaryChange={onBoundaryChange}
          onBoundaryDrawComplete={onDrawingComplete}
          onTrialZoneChange={onTrialZoneChange}
          onTrialZoneDrawComplete={onTrialZoneDrawComplete}
        />

        {/* Soil zone overlays — rendered below field boundary */}
        {soilZones.length > 0 && (
          <SoilZones features={soilZones} onSoilZoneClick={onSoilZoneClick} />
        )}

        {boundaryPositions && (
          <Polygon
            positions={boundaryPositions}
            pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.12, weight: 2 }}
          />
        )}

        {/* Trial zone: orange, more opaque than field boundary */}
        {trialZonePositions && (
          <Polygon
            positions={trialZonePositions}
            pathOptions={{ color: "#ea580c", fillColor: "#f97316", fillOpacity: 0.20, weight: 2.5, dashArray: "6 3" }}
          />
        )}

        {pointA && pointB && (
          <Polyline
            positions={[[pointA.lat, pointA.lon], [pointB.lat, pointB.lon]]}
            color="#2563eb"
            weight={3}
            dashArray="6 4"
          />
        )}

        {pointA && (
          <Marker
            position={[pointA.lat, pointA.lon]}
            icon={MARKER_ICON}
            draggable
            eventHandlers={{
              dragend(e) {
                const ll = (e.target as L.Marker).getLatLng();
                onPlace("A", ll.lat, ll.lng);
              },
            }}
          />
        )}

        {pointB && (
          <Marker
            position={[pointB.lat, pointB.lon]}
            icon={MARKER_ICON}
            draggable
            eventHandlers={{
              dragend(e) {
                const ll = (e.target as L.Marker).getLatLng();
                onPlace("B", ll.lat, ll.lng);
              },
            }}
          />
        )}
      </MapContainer>

      {/* Satellite / street toggle */}
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        style={{ position: "absolute", top: 8, right: 8, zIndex: 1000 }}
        className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs font-medium shadow-sm hover:bg-gray-50"
      >
        {satellite ? "Street" : "Satellite"}
      </button>
    </div>
  );
}
