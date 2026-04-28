import { unzipSync } from "fflate";
import shpjs from "shpjs";

export interface ABPoints {
  aLon: number;
  aLat: number;
  bLon: number;
  bLat: number;
}

function pairFromCoords(coords: number[][]): ABPoints {
  if (coords.length < 2) throw new Error("Line geometry has fewer than 2 points");
  const [aLon, aLat] = coords[0];
  const [bLon, bLat] = coords[coords.length - 1];
  return { aLon, aLat, bLon, bLat };
}

function parseGpx(text: string): ABPoints {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  let pts = Array.from(doc.querySelectorAll("trkpt"));
  if (!pts.length) pts = Array.from(doc.querySelectorAll("rtept"));
  if (pts.length < 2) throw new Error("GPX file has fewer than 2 track/route points");
  const first = pts[0];
  const last = pts[pts.length - 1];
  return {
    aLon: parseFloat(first.getAttribute("lon")!),
    aLat: parseFloat(first.getAttribute("lat")!),
    bLon: parseFloat(last.getAttribute("lon")!),
    bLat: parseFloat(last.getAttribute("lat")!),
  };
}

function parseKmlText(text: string): ABPoints {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const coordEl = doc.querySelector("LineString coordinates");
  if (!coordEl?.textContent) throw new Error("No LineString found in KML");
  const tokens = coordEl.textContent.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) throw new Error("KML LineString has fewer than 2 points");
  const parse = (t: string) => {
    const [lon, lat] = t.split(",").map(Number);
    return { lon, lat };
  };
  const a = parse(tokens[0]);
  const b = parse(tokens[tokens.length - 1]);
  return { aLon: a.lon, aLat: a.lat, bLon: b.lon, bLat: b.lat };
}

async function parseKmz(buf: ArrayBuffer): Promise<ABPoints> {
  const files = unzipSync(new Uint8Array(buf));
  const kmlEntry =
    Object.entries(files).find(([name]) => name === "doc.kml") ??
    Object.entries(files).find(([name]) => name.endsWith(".kml"));
  if (!kmlEntry) throw new Error("No .kml file found inside KMZ");
  const text = new TextDecoder().decode(kmlEntry[1]);
  return parseKmlText(text);
}

function parseGeoJsonLine(parsed: unknown): ABPoints {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geo = parsed as any;
  let coords: number[][] | null = null;

  if (geo.type === "FeatureCollection") {
    for (const f of geo.features ?? []) {
      const g = f.geometry;
      if (g?.type === "LineString") { coords = g.coordinates; break; }
      if (g?.type === "MultiLineString") { coords = g.coordinates[0]; break; }
    }
  } else if (geo.type === "Feature") {
    const g = geo.geometry;
    if (g?.type === "LineString") coords = g.coordinates;
    if (g?.type === "MultiLineString") coords = g.coordinates[0];
  } else if (geo.type === "LineString") {
    coords = geo.coordinates;
  } else if (geo.type === "MultiLineString") {
    coords = geo.coordinates[0];
  }

  if (!coords) throw new Error("No line geometry found in GeoJSON");
  return pairFromCoords(coords);
}

async function parseShapefileZip(buf: ArrayBuffer): Promise<ABPoints> {
  const result = await shpjs(buf);
  const fc = Array.isArray(result) ? result[0] : result;
  for (const feat of fc.features ?? []) {
    const g = feat.geometry as { type: string; coordinates: unknown } | null;
    if (!g) continue;
    if (g.type === "LineString") return pairFromCoords(g.coordinates as number[][]);
    if (g.type === "MultiLineString") return pairFromCoords((g.coordinates as number[][][])[0]);
  }
  throw new Error("No line geometry found in shapefile");
}

export async function parseGuidanceLineFile(file: File): Promise<ABPoints> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".gpx")) {
    return parseGpx(await file.text());
  }

  if (lower.endsWith(".kml")) {
    return parseKmlText(await file.text());
  }

  if (lower.endsWith(".kmz")) {
    return parseKmz(await file.arrayBuffer());
  }

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    return parseGeoJsonLine(JSON.parse(await file.text()));
  }

  if (lower.endsWith(".zip")) {
    // Try shapefile first; if shpjs finds no line, the error bubbles up clearly.
    return parseShapefileZip(await file.arrayBuffer());
  }

  throw new Error(
    "Unsupported format — use .gpx, .kml, .kmz, .geojson, .json, or a shapefile .zip"
  );
}
