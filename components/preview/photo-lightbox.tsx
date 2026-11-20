"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type LightboxPhoto = {
  id: string;
  /** Address the picture is read from (signed link for Spaces, signed API link for local files). */
  src: string | null | undefined;
  title: string;
  subtitle?: string;
  /** Small facts shown in the side panel (captured time, size, GPS ...). */
  facts?: string[];
  /** Saves the file under its own name. Without it the picture opens in a new tab. */
  onDownload?: () => void;
};

const MIN = 1;
const MAX = 5;

/**
 * Full-screen photo viewer used for every uploaded picture (local disk or Spaces alike): the picture fills the screen,
 * previous / next (arrow keys), zoom (buttons, +/-, wheel, double click), rotate, thumbnail strip, download.
 */
export function PhotoLightbox({ photos, index, onIndexChange, onClose }: { photos: LightboxPhoto[]; index: number | null; onIndexChange: (i: number) => void; onClose: () => void }) {
  const open = index !== null && photos.length > 0;
  const i = open ? Math.min(Math.max(index!, 0), photos.length - 1) : 0;
  const photo = photos[i];
  // View state belongs to one picture: a different picture starts fitted to the screen (derived, no reset effect).
  const viewKey = `${photo?.id}|${photo?.src}`;
  const [view, setView] = useState({ key: viewKey, zoom: 1, turns: 0, failed: false });
  const cur = view.key === viewKey ? view : { key: viewKey, zoom: 1, turns: 0, failed: false };
  const { zoom, turns, failed } = cur;
  const patch = (p: Partial<{ zoom: number; turns: number; failed: boolean }>) => setView({ ...cur, ...p });
  const setZoom = (f: number | ((z: number) => number)) => patch({ zoom: typeof f === "function" ? f(zoom) : f });
  const setTurns = (f: (t: number) => number) => patch({ turns: f(turns) });
  const setFailed = (v: boolean) => patch({ failed: v });
  const scroller = useRef<HTMLDivElement>(null);

  const go = useCallback((d: number) => onIndexChange((i + d + photos.length) % photos.length), [i, photos.length, onIndexChange]);
  const zoomBy = (d: number) => setZoom((z) => Math.min(MAX, Math.max(MIN, +(z + d).toFixed(2))));

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(0.5);
      else if (e.key === "-") zoomBy(-0.5);
      else if (e.key === "0") setZoom(1);
      else if (e.key.toLowerCase() === "r") setTurns((t) => t + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // Re-registered every render so the handler always sees the current zoom / rotation.
  });

  // Keep the thumbnail of the current picture in view.
  useEffect(() => {
    if (open) document.getElementById(`lb-thumb-${i}`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open, i]);

  if (!photo) return null;
  const rotated = turns % 2 !== 0;
  const btn = "inline-flex size-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/95" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[70] flex flex-col text-white focus:outline-none" data-testid="photo-lightbox">
          <header className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold">{photo.title}</Dialog.Title>
              <p className="truncate text-xs text-white/70">{photos.length > 1 ? `${i + 1} of ${photos.length}` : ""}{photo.subtitle ? `${photos.length > 1 ? " · " : ""}${photo.subtitle}` : ""}</p>
            </div>
            <button className={btn} aria-label="Zoom out" disabled={zoom <= MIN} onClick={() => zoomBy(-0.5)}><ZoomOut className="size-4" /></button>
            <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button className={btn} aria-label="Zoom in" disabled={zoom >= MAX} onClick={() => zoomBy(0.5)}><ZoomIn className="size-4" /></button>
            <button className={btn} aria-label="Fit to screen" onClick={() => setZoom(1)}><Maximize2 className="size-4" /></button>
            <button className={btn} aria-label="Rotate" onClick={() => setTurns((t) => t + 1)}><RotateCw className="size-4" /></button>
            {photo.src && (photo.onDownload ? (
              <button className={btn} aria-label="Download" onClick={photo.onDownload}><Download className="size-4" /></button>
            ) : (
              <a className={btn} aria-label="Open in new tab" href={photo.src} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
            ))}
            <Dialog.Close className={btn} aria-label="Close"><X className="size-5" /></Dialog.Close>
          </header>

          <div className="relative flex min-h-0 flex-1 gap-3 px-2 sm:px-4">
            <div
              ref={scroller}
              className={cn("min-h-0 min-w-0 flex-1 overflow-auto rounded-lg bg-black/40", zoom === 1 && "flex items-center justify-center")}
              onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 0.25 : -0.25); } }}
              tabIndex={0}
              aria-label="Photo, scroll to pan when zoomed"
            >
              {!photo.src || failed ? (
                <p className="p-10 text-center text-sm text-white/80">This file is not available.</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.src}
                  src={photo.src}
                  alt={photo.title}
                  data-testid="lightbox-image"
                  draggable={false}
                  onError={() => setFailed(true)}
                  onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
                  style={zoom === 1 ? { transform: `rotate(${turns * 90}deg)`, maxWidth: rotated ? "calc(100dvh - 11rem)" : "100%", maxHeight: rotated ? "100%" : "100%" } : { width: `${zoom * 100}%`, maxWidth: "none", transform: `rotate(${turns * 90}deg)` }}
                  className={cn("select-none object-contain transition-[width] duration-150 motion-reduce:transition-none", zoom === 1 ? "h-full w-auto cursor-zoom-in" : "mx-auto block h-auto cursor-zoom-out")}
                />
              )}
            </div>
            {photo.facts && photo.facts.length > 0 && (
              <aside className="hidden w-64 shrink-0 overflow-y-auto rounded-lg bg-white/10 p-3 text-xs text-white/90 xl:block" aria-label="Photo details">
                <ul className="flex flex-col gap-2">{photo.facts.map((f) => <li key={f}>{f}</li>)}</ul>
              </aside>
            )}
            {photos.length > 1 && (
              <>
                <button className={cn(btn, "absolute left-4 top-1/2 size-11 -translate-y-1/2 bg-black/60")} aria-label="Previous photo" onClick={() => go(-1)}><ChevronLeft className="size-6" /></button>
                <button className={cn(btn, "absolute right-4 top-1/2 size-11 -translate-y-1/2 bg-black/60 xl:right-[17.5rem]")} aria-label="Next photo" onClick={() => go(1)}><ChevronRight className="size-6" /></button>
              </>
            )}
          </div>

          {photos.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto px-4 py-3" role="listbox" aria-label="All photos">
              {photos.map((p, n) => (
                <button key={p.id} id={`lb-thumb-${n}`} role="option" aria-selected={n === i} aria-label={p.title} onClick={() => onIndexChange(n)} className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 focus-visible:outline-2 focus-visible:outline-white", n === i ? "border-white" : "border-transparent opacity-60 hover:opacity-100")}>
                  {p.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.src} alt="" loading="lazy" className="size-full object-cover" />
                  ) : <span className="text-[10px]">No file</span>}
                </button>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
