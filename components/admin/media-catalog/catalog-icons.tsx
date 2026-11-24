"use client";

import { useRef, type KeyboardEvent } from "react";
import {
  AppWindow, CaseSensitive, CircleDotDashed, Columns2, Columns3, Construction, DoorOpen, DraftingCompass, Flag, FlipHorizontal, Frame, Hammer, House, Image as ImageIcon,
  LayoutGrid, Layers, Lightbulb, Maximize2, Package, PaintRoller, RectangleHorizontal, RectangleVertical, Rows2, Ruler, Shapes, Signpost, Square, Store, StretchHorizontal,
  Sun, Triangle, Type, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { iconLabel, isCatalogIcon, readableTextOn } from "@/lib/catalog-rules";
import { CATALOG_ICONS, type CatalogIcon } from "@/types/catalog";

/**
 * The catalog stores an icon NAME. The phone maps each name to its own icon; here each name is drawn with the closest lucide icon.
 * An unknown name shows the plain default, like the phone does.
 */
const GLYPHS: Record<CatalogIcon, LucideIcon> = {
  lightbulb_outline: Lightbulb,
  crop_landscape: RectangleHorizontal,
  crop_square: Square,
  rectangle_outlined: RectangleVertical,
  layers_outlined: Layers,
  text_fields: Type,
  text_rotation_none: CaseSensitive,
  flip: FlipHorizontal,
  flag_outlined: Flag,
  blur_on: CircleDotDashed,
  change_history: Triangle,
  window_outlined: AppWindow,
  door_sliding_outlined: DoorOpen,
  storefront_outlined: Store,
  wallpaper: ImageIcon,
  wallpaper_outlined: Frame,
  format_paint_outlined: PaintRoller,
  signpost_outlined: Signpost,
  roofing_outlined: House,
  open_in_full: Maximize2,
  view_week_outlined: Columns3,
  view_quilt_outlined: LayoutGrid,
  view_column_outlined: Columns2,
  view_agenda: StretchHorizontal,
  view_agenda_outlined: Rows2,
  handyman_outlined: Hammer,
  construction: Construction,
  straighten: Ruler,
  inventory_2_outlined: Package,
  category_outlined: Shapes,
  light_mode_outlined: Sun,
  architecture: DraftingCompass,
};

export function CatalogGlyph({ name, className }: { name: string; className?: string }) {
  const Glyph = GLYPHS[name as CatalogIcon] ?? Shapes;
  return <Glyph className={className} aria-hidden />;
}

/** A rounded square holding the icon: in the media type's colour, or a neutral blue when there is no colour (installation methods). */
export function IconChip({ icon, color, className }: { icon: string; color?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", !color && "bg-secondary text-navy", className)}
      style={color ? { backgroundColor: color, color: readableTextOn(color) } : undefined}
    >
      <CatalogGlyph name={icon} className="size-5" />
    </span>
  );
}

/** The 32 icon names as a radio group: arrow keys move the choice, Tab leaves the group. */
export function IconPicker({ value, onChange, color, labelledBy, invalid, disabled }: { value: string; onChange: (name: string) => void; color?: string; labelledBy: string; invalid?: boolean; disabled?: boolean }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const known = isCatalogIcon(value);
  const tabStop = known ? value : CATALOG_ICONS[0];

  function onKey(e: KeyboardEvent, i: number) {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? CATALOG_ICONS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = CATALOG_ICONS[(to + CATALOG_ICONS.length) % CATALOG_ICONS.length]!;
    onChange(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid || undefined} className={cn("grid grid-cols-8 gap-1.5 rounded-lg border bg-surface p-2", invalid ? "border-danger" : "border-border")}>
        {CATALOG_ICONS.map((name, i) => {
          const on = name === value;
          return (
            <button
              key={name}
              ref={(el) => {
                refs.current[name] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={iconLabel(name)}
              title={iconLabel(name)}
              tabIndex={name === tabStop ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(name)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-navy transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
                on ? "border-royal bg-royal/10 text-royal ring-1 ring-royal" : "border-transparent hover:bg-muted",
              )}
            >
              <CatalogGlyph name={name} className="size-5" />
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <IconChip icon={value} {...(color ? { color } : {})} className="size-6 rounded-md [&_svg]:size-3.5" />
        {known ? <>Selected: {iconLabel(value)}</> : <>Current icon &ldquo;{value}&rdquo; is not in the list. Pick one to replace it.</>}
      </p>
    </div>
  );
}
