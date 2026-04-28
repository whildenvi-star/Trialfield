"use client";

import dynamic from "next/dynamic";
import type { Props as ABLineMapInnerProps } from "./ABLineMapInner";

// Leaflet + geoman manipulate the DOM and read window — must be client-only.
const ABLineMapInner = dynamic(
  () => import("./ABLineMapInner").then((m) => m.ABLineMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] bg-gray-100 rounded-lg animate-pulse" />
    ),
  }
);

export type { LatLon, GeoJSONPolygon } from "./ABLineMapInner";
export type ABLineMapProps = ABLineMapInnerProps;

export function ABLineMap(props: ABLineMapProps) {
  return <ABLineMapInner {...props} />;
}
