"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export interface MapPin { id: string; name: string; sub?: string; lat: number; lng: number; color: string; label?: string }
export interface MapRoute { color: string; coords: [number, number][] }
export interface MapViewProps {
  pins: MapPin[];
  origin?: { lat: number; lng: number; name: string } | null;
  routes?: MapRoute[];
  /** When set, a click on the map reports its position (used to place the start point or a shop). */
  onPick?: ((lat: number, lng: number) => void) | undefined;
  height?: number;
}

function Fit({ pins, origin }: { pins: MapPin[]; origin?: MapViewProps["origin"] }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = pins.map((p) => [p.lat, p.lng]);
    if (origin) pts.push([origin.lat, origin.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 13 });
  }, [map, pins, origin]);
  return null;
}
function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6) });
  return null;
}

/** OpenStreetMap view. Tiles come from OpenStreetMap (no key needed); markers are drawn as circles. */
export default function MapView({ pins, origin, routes = [], onPick, height = 460 }: MapViewProps) {
  const centre: [number, number] = origin ? [origin.lat, origin.lng] : pins[0] ? [pins[0].lat, pins[0].lng] : [10.8505, 78.6866]; // Tamil Nadu
  return (
    <div style={{ height }} className={`overflow-hidden rounded-xl border border-border ${onPick ? "cursor-crosshair" : ""}`}>
      <MapContainer center={centre} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit pins={pins} origin={origin} />
        {onPick && <Picker onPick={onPick} />}
        {routes.map((r, i) => <Polyline key={i} positions={r.coords} pathOptions={{ color: r.color, weight: 3, opacity: 0.8 }} />)}
        {pins.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.label ? 11 : 7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: p.color, fillOpacity: 0.95 }}>
            {p.label && <Tooltip permanent direction="center" className="map-label">{p.label}</Tooltip>}
            <Popup><strong>{p.name}</strong>{p.sub ? <><br />{p.sub}</> : null}</Popup>
          </CircleMarker>
        ))}
        {origin && (
          <CircleMarker center={[origin.lat, origin.lng]} radius={10} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }}>
            <Popup><strong>{origin.name}</strong><br />Start point</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
