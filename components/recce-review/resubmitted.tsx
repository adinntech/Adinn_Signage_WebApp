"use client";
import { useMemo } from "react";
import { RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { boardLabel, type BoardField, type BoardItem, type ReviewStage, type Workspace, type WsPhoto } from "@/lib/api/recceReview";
import { STAGE_LABEL } from "./common";

/**
 * What the recce person resubmitted after a rework, for the logged-in reviewer.
 *
 * A rework request (`w.reworks`) closes when the recce person submits the next version: every item it carried is then `resolved` with
 * `resolvedInVersion` = that version. This reads those items for the version on screen and joins each to its answer: the new photo that
 * `replaces` the flagged one (or, for an extra photo asked for, the photo added in that version), the board detail as it is now, or the
 * checklist item. Items the logged-in reviewer's own stage asked for come first ("for you"); the other team's are listed after them.
 */

export interface ResubmittedItem {
  id: string;
  /** The stage that asked for it. */
  stage: ReviewStage;
  /** Asked by the stage of the logged-in reviewer. */
  mine: boolean;
  kind: "PHOTO" | "EXTRA" | "BOARD" | "CHECK";
  what: string;
  /** The reviewer's own remark that the recce person answered. */
  asked: string;
  rejected: boolean;
  /** The photo that answers a photo request (null: none found, or the item is not a photo). */
  newPhoto: WsPhoto | null;
  /** A board detail: which board and field, and its value in this version. */
  mediaKey: string;
  field: BoardField | null;
  now: string | null;
}

const FIELD_OF: Record<string, BoardField> = { FIX_MEDIA_TYPE: "MEDIA_TYPE", FIX_QUANTITY: "QUANTITY", FIX_MEASUREMENT: "SIZE" };
const FIELD_WORD: Record<BoardField, string> = { MEDIA_TYPE: "media type", QUANTITY: "quantity", SIZE: "size" };

const valueOf = (b: BoardItem | undefined, f: BoardField): string | null => {
  if (!b) return null;
  if (f === "MEDIA_TYPE") return b.name;
  if (f === "QUANTITY") return `${b.quantity ?? 1}`;
  return b.width && b.height ? `${b.width} × ${b.height} ${b.unit ?? ""}`.trim() : "Not measured";
};

/** The items answered by version [cur], the logged-in stage's own first. Empty for the first version. */
export function resubmittedItems(w: Workspace, cur: number): ResubmittedItem[] {
  const version = w.versions.find((v) => v.version === cur);
  if (!version || cur < 2) return [];
  const boards = version.mediaItems ?? [];
  const added = new Set(version.addedIds ?? []);
  const category = (key: string | null, label: string | null) => label ?? w.categories.find((c) => c.key === key)?.label ?? key ?? "Photo";
  const out: ResubmittedItem[] = [];
  for (const r of w.reworks) {
    for (const i of r.items) {
      if (!i.resolved || i.resolvedInVersion !== cur) continue;
      const base = { id: i.id, stage: r.stage, mine: r.stage === w.me.stage, asked: i.note, rejected: !!i.rejected };
      if (i.type === "REPLACE_PHOTO" || i.type === "ADDITIONAL_PHOTO") {
        const extra = i.type === "ADDITIONAL_PHOTO";
        const old = i.photo ? w.photos.find((p) => p.id === i.photo) : undefined;
        const mediaKey = i.mediaKey || old?.mediaKey || "";
        const board = boards.find((b) => b.key === mediaKey);
        const newPhoto = extra
          ? (w.photos.find((p) => added.has(p.id) && p.state !== "REMOVED" && p.category === i.category && (!mediaKey || p.mediaKey === mediaKey)) ?? null)
          : (i.photo ? (w.photos.find((p) => p.replaces === i.photo && p.state !== "REMOVED") ?? null) : null);
        out.push({ ...base, kind: extra ? "EXTRA" : "PHOTO", what: `${category(i.category, i.categoryLabel)}${board ? ` of ${boardLabel(board)}` : ""}`, newPhoto, mediaKey, field: null, now: null });
      } else if (i.type in FIELD_OF) {
        const field = FIELD_OF[i.type]!;
        const board = boards.find((b) => b.key === i.mediaKey);
        out.push({ ...base, kind: "BOARD", what: `${board ? boardLabel(board) : "Board"} ${FIELD_WORD[field]}`, newPhoto: null, mediaKey: i.mediaKey, field, now: valueOf(board, field) });
      } else {
        out.push({ ...base, kind: "CHECK", what: i.label || "Reviewer check", newPhoto: null, mediaKey: "", field: null, now: null });
      }
    }
  }
  return out.sort((a, b) => Number(b.mine) - Number(a.mine));
}

/** Photo id -> the item it answers, for a "Resubmitted" mark on the photo tile. */
export const resubmittedByPhoto = (items: ResubmittedItem[]) => new Map(items.filter((i) => i.newPhoto).map((i) => [i.newPhoto!.id, i] as const));
/** "mediaKey:FIELD" -> the item it answers, for a "Rechecked" mark on a board detail. */
export const resubmittedByField = (items: ResubmittedItem[]) => new Map(items.filter((i) => i.kind === "BOARD" && i.field).map((i) => [`${i.mediaKey}:${i.field}`, i] as const));

const KIND_WORD: Record<ResubmittedItem["kind"], string> = { PHOTO: "New photo", EXTRA: "Extra photo", BOARD: "Rechecked", CHECK: "Checked" };

/** Right-hand card of the review workspace: everything the recce person resubmitted in this version, for the logged-in login first. */
export function ResubmittedCard({ w, cur }: { w: Workspace; cur: number }) {
  const items = useMemo(() => resubmittedItems(w, cur), [w, cur]);
  if (items.length === 0) return null;
  const stage = w.me.stage;
  const mine = items.filter((i) => i.mine).length;
  return (
    <Card className="flex flex-col gap-2 border-primary/40 p-3 text-sm" data-testid="resubmitted-items">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-accent"><RefreshCcw className="size-3.5" aria-hidden /> Resubmitted in version {cur} ({items.length})</p>
      {stage && (
        <p className="text-xs text-muted-foreground">
          {mine > 0 ? `${mine} answer${mine === 1 ? "" : "s"} to what ${STAGE_LABEL[stage]} asked.` : `Nothing here was asked by ${STAGE_LABEL[stage]}.`}
          {mine < items.length && mine > 0 ? ` The rest was asked by the other team.` : ""}
        </p>
      )}
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {items.map((i) => (
          <li key={i.id} className="flex gap-2 rounded-lg border border-border bg-surface p-2">
            {i.kind === "PHOTO" || i.kind === "EXTRA" ? (
              i.newPhoto?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.newPhoto.editedUrl ?? i.newPhoto.url} alt={`New photo: ${i.what}`} loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
              ) : <span className="grid h-12 w-16 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">No photo</span>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <Badge tone="info">{KIND_WORD[i.kind]}</Badge>
                <span className="min-w-0 truncate font-medium" title={i.what}>{i.what}</span>
              </div>
              {i.now && <p className="text-xs">Now: <span className="font-medium">{i.now}</span></p>}
              {(i.kind === "PHOTO" || i.kind === "EXTRA") && !i.newPhoto && <p className="text-xs text-warning">No new photo found for this request.</p>}
              <p className="wrap-break-word text-xs text-muted-foreground">Asked by {STAGE_LABEL[i.stage]}{i.mine ? " (you)" : ""}{i.asked ? `: ${i.asked}` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
