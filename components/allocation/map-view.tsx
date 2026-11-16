"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export interface MapPin { id: string; name: string; sub?: string; lat: number; lng: number; color: string; label?: string }
export interface MapRoute { color: string; coords: [number, number][]; /** Draw a direction arrow on every leg, so the visiting order can be followed. */ arrows?: boolean }

/** A small arrow in the middle of a leg, turned the way the trip goes. It never takes clicks, so it does not hide a pin. */
function legArrow(a: [number, number], b: [number, number], color: string) {
  const bearing = (Math.atan2((b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180), b[0] - a[0]) * 180) / Math.PI;
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;pointer-events:none;transform:rotate(${bearing.toFixed(0)}deg);color:${color};font-size:13px;line-height:14px;text-align:center;text-shadow:0 0 2px #fff,0 0 2px #fff">▲</div>`,
  });
}
export interface MapViewProps {
  pins: MapPin[];
  origin?: { lat: number; lng: number; name: string } | null;
  routes?: MapRoute[];
  /** When set, a click on the map reports its position (used to place the start point or a shop). */
  onPick?: ((lat: number, lng: number) => void) | undefined;
  height?: number | string;
  /** A pin to zoom to and highlight (its popup opens). While set, the map does not re-fit to all pins. */
  focusId?: string | null;
}

function Fit({ pins, origin, paused }: { pins: MapPin[]; origin?: MapViewProps["origin"]; paused: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (paused) return;
    const pts: [number, number][] = pins.map((p) => [p.lat, p.lng]);
    if (origin) pts.push([origin.lat, origin.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 13 });
  }, [map, pins, origin, paused]);
  return null;
}

/** Flies to the focused pin and opens its popup. */
function Focus({ pin, markers }: { pin: MapPin | undefined; markers: React.RefObject<Map<string, L.CircleMarker>> }) {
  const map = useMap();
  const id = pin?.id;
  const lat = pin?.lat;
  const lng = pin?.lng;
  useEffect(() => {
    if (id === undefined || lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    const t = setTimeout(() => markers.current.get(id)?.openPopup(), 650);
    return () => clearTimeout(t);
  }, [map, id, lat, lng, markers]);
  return null;
}
function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6) });
  return null;
}

/** OpenStreetMap view. Tiles come from OpenStreetMap (no key needed); markers are drawn as circles. */
export default function MapView({ pins, origin, routes = [], onPick, height = 460, focusId = null }: MapViewProps) {
  const markers = useRef(new Map<string, L.CircleMarker>());
  const focused = focusId ? pins.find((p) => p.id === focusId) : undefined;
  const centre: [number, number] = origin ? [origin.lat, origin.lng] : pins[0] ? [pins[0].lat, pins[0].lng] : [10.8505, 78.6866]; // Tamil Nadu
  return (
    <div style={{ height }} className={`overflow-hidden rounded-xl border border-border ${onPick ? "cursor-crosshair" : ""}`}>
      <MapContainer center={centre} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit pins={pins} origin={origin} paused={!!focused} />
        <Focus pin={focused} markers={markers} />
        {onPick && <Picker onPick={onPick} />}
        {focused && <CircleMarker center={[focused.lat, focused.lng]} radius={18} interactive={false} pathOptions={{ color: "#102449", weight: 3, fillColor: "#102449", fillOpacity: 0.12 }} />}
        {routes.map((r, i) => <Polyline key={i} positions={r.coords} pathOptions={{ color: r.color, weight: 3, opacity: 0.8 }} />)}
        {routes.flatMap((r, i) => (r.arrows ? r.coords.slice(1).map((to, j) => {
          const from = r.coords[j]!;
          return <Marker key={`a${i}-${j}`} position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]} icon={legArrow(from, to, r.color)} interactive={false} keyboard={false} />;
        }) : []))}
        {pins.map((p) => (
          <CircleMarker key={p.id} ref={(m) => { if (m) markers.current.set(p.id, m); else markers.current.delete(p.id); }} center={[p.lat, p.lng]} radius={p.id === focusId ? 11 : p.label ? 11 : 7} pathOptions={{ color: p.id === focusId ? "#102449" : "#ffffff", weight: p.id === focusId ? 3 : 2, fillColor: p.color, fillOpacity: 0.95 }}>
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
