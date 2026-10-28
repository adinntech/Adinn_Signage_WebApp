"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./map-view";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div role="status" className="flex h-[460px] items-center justify-center rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground">Loading map…</div>,
});

/** Leaflet needs the browser, so the map is loaded on the client only. */
export function AllocationMap(props: MapViewProps) {
  return <MapView {...props} />;
}
