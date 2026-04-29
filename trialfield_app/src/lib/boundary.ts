import shpjs from "shpjs";
import type { GeoJSONPolygon } from "@/components/design-form/ABLineMap";

type GeoJSONGeometry =
  | GeoJSONPolygon
  | { type: "MultiPolygon"; coordinates: number[][][][] };

function closeRings(geom: GeoJSONPolygon): GeoJSONPolygon {
  const coordinates = geom.coordinates.map((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!first || !last || (first[0] === last[0] && first[1] === last[1])) return ring;
    return [...ring, first];
  });
  return { ...geom, coordinates };
}

function firstPolygon(geom: GeoJSONGeometry): GeoJSONPolygon {
  if (geom.type === "Polygon") return closeRings(geom);
  // MultiPolygon → take the largest ring by vertex count
  const rings = geom.coordinates;
  const largest = rings.reduce((a, b) =>
    a[0].length >= b[0].length ? a : b
  );
  return closeRings({ type: "Polygon", coordinates: largest });
}

function geometryFromFeatureCollection(
  fc: GeoJSON.FeatureCollection
): GeoJSONPolygon {
  for (const feat of fc.features) {
    const g = feat.geometry as GeoJSONGeometry | null;
    if (g && (g.type === "Polygon" || g.type === "MultiPolygon")) {
      return firstPolygon(g);
    }
  }
  throw new Error("No Polygon or MultiPolygon feature found in file");
}

export async function parseBoundaryFile(
  file: File
): Promise<GeoJSONPolygon> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    const text = await file.text();
    const parsed = JSON.parse(text) as
      | GeoJSON.FeatureCollection
      | GeoJSON.Feature
      | GeoJSONGeometry;

    if (parsed.type === "FeatureCollection") {
      return geometryFromFeatureCollection(parsed as GeoJSON.FeatureCollection);
    }
    if (parsed.type === "Feature") {
      const g = (parsed as GeoJSON.Feature).geometry as GeoJSONGeometry;
      return firstPolygon(g);
    }
    return firstPolygon(parsed as GeoJSONGeometry);
  }

  if (lower.endsWith(".zip")) {
    const buf = await file.arrayBuffer();
    const result = await shpjs(buf);
    const fc = Array.isArray(result) ? result[0] : result;
    return geometryFromFeatureCollection(fc as GeoJSON.FeatureCollection);
  }

  throw new Error("Unsupported file type. Use .geojson, .json, or a shapefile .zip");
}
