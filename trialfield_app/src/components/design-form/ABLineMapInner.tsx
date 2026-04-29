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
// Setting it here (module body, after static imports) ensures it's available
// when we load geoman via dynamic import() inside GeomanController.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).L = L;
}

// Fix Leaflet's broken default icon path in webpack builds
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
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
  onDrawingComplete: () => void;
}

function GeomanController({
  drawingBoundary,
  onBoundaryChange,
  onDrawingComplete,
}: GeomanControllerProps) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  // Load geoman once, after window.L is guaranteed to be set
  useEffect(() => {
    import("@geoman-io/leaflet-geoman-free").then(() => setReady(true));
  }, []);

  // Arm / disarm draw mode
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = (map as any).pm;
    if (!pm) return;
    if (drawingBoundary) {
      pm.enableDraw("Polygon", { snappable: false, tooltips: false });
    } else {
      pm.disableDraw();
    }
  }, [drawingBoundary, ready, map]);

  // Capture drawn polygon, remove geoman layer, let react-leaflet render it
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleCreate(e: any) {
      const geojson = e.layer.toGeoJSON().geometry as GeoJSONPolygon;
      map.removeLayer(e.layer);
      onBoundaryChange(geojson);
      onDrawingComplete();
    }
    map.on("pm:create", handleCreate);
    return () => {
      map.off("pm:create", handleCreate);
    };
  }, [ready, map, onBoundaryChange, onDrawingComplete]);

  return null;
}

// ── USDA CLU field boundary snap handler ─────────────────────────────────────

interface FieldSnapHandlerProps {
  snappingField: boolean;
  onBoundaryChange: (geojson: GeoJSONPolygon | null) => void;
  onSnapDone: () => void;
  onSnapFail: (msg: string) => void;
  onFetchingChange: (fetching: boolean) => void;
}

function FieldSnapHandler({
  snappingField,
  onBoundaryChange,
  onSnapDone,
  onSnapFail,
  onFetchingChange,
}: FieldSnapHandlerProps) {
  async function fetchCLU(lat: number, lng: number) {
    onFetchingChange(true);
    try {
      const url = new URL("https://gis.fsa.usda.gov/api/public/map/CLU/MapServer/0/query");
      url.searchParams.set("geometry", `${lng},${lat}`);
      url.searchParams.set("geometryType", "esriGeometryPoint");
      url.searchParams.set("inSR", "4326");
      url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
      url.searchParams.set("outFields", "*");
      url.searchParams.set("returnGeometry", "true");
      url.searchParams.set("f", "geojson");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("CLU request failed");
      const data = await res.json();
      if (!data.features?.length) {
        onSnapFail("No field boundary found here — try drawing one manually.");
        return;
      }
      onBoundaryChange(data.features[0].geometry as GeoJSONPolygon);
      onSnapDone();
    } catch {
      onSnapFail("No field boundary found here — try drawing one manually.");
    } finally {
      onFetchingChange(false);
    }
  }

  useMapEvents({
    click(e) {
      if (!snappingField) return;
      void fetchCLU(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
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
  snappingField,
  onSnapDone,
  onSnapFail,
}: Props) {
  const fixedRef = useRef(false);
  const [satellite, setSatellite] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!fixedRef.current) {
      fixLeafletIcons();
      fixedRef.current = true;
    }
  }, []);

  const center: [number, number] = pointA
    ? [pointA.lat, pointA.lon]
    : DEFAULT_CENTER;
  const zoom = pointA ? 14 : DEFAULT_ZOOM;

  const boundaryPositions: [number, number][] | null = boundary
    ? boundary.coordinates[0].map(([lon, lat]) => [lat, lon])
    : null;

  const cursor = placing || drawingBoundary || snappingField || fetching ? "cursor-crosshair" : "";

  return (
    <div style={{ position: "relative" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "320px", width: "100%", borderRadius: "0.5rem" }}
        className={cursor}
      >
        {satellite ? (
          <TileLayer
            attribution='Imagery &copy; <a href="https://www.esri.com">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <ClickHandler placing={placing} onPlace={onPlace} />
        <GeomanController
          drawingBoundary={drawingBoundary}
          onBoundaryChange={onBoundaryChange}
          onDrawingComplete={onDrawingComplete}
        />
        <FieldSnapHandler
          snappingField={snappingField}
          onBoundaryChange={onBoundaryChange}
          onSnapDone={onSnapDone}
          onSnapFail={onSnapFail}
          onFetchingChange={setFetching}
        />

        {boundaryPositions && (
          <Polygon
            positions={boundaryPositions}
            pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.12, weight: 2 }}
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

      {/* CLU lookup in-progress indicator */}
      {fetching && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
          className="bg-white border border-gray-200 rounded px-3 py-1 text-xs shadow-sm text-gray-600"
        >
          Looking up field boundary…
        </div>
      )}
    </div>
  );
}
