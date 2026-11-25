"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useCatalog } from "@/lib/api/catalog";
import type { BoardItem, ShopInstallation } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import type { CatalogQuestion } from "@/types/catalog";

/**
 * Read-only parts of a board in the review workspace: its facts (sides, condition, position), the installation requirement with the answers to
 * the site questions, and the remarks. The question labels come from the media catalog, so an answer reads as "Power point available: Yes",
 * not as a stored key. The answers and the shop-level feasibility fold, so a reviewer can keep them out of the way.
 */

/** A section that folds. The title row is the button. */
export function Collapse({ title, hint, defaultOpen = false, children }: { title: string; hint?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {hint && <span className="shrink-0 text-xs font-normal text-muted-foreground">{hint}</span>}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="border-t border-border px-3 py-3">{children}</div>}
    </section>
  );
}

const SIDE: Record<string, string> = { SINGLE: "Single side", DOUBLE: "Double side" };
const CONDITION: Record<string, string> = { EXISTING: "Existing", PROPOSED: "Proposed" };

/** Sides, condition, unit and position of one board (size, quantity and media type are the selectable cards next to it). */
export function BoardFacts({ board }: { board: BoardItem }) {
  const rows: [string, string][] = [
    ["Sides", SIDE[board.sided ?? ""] ?? "-"],
    ["Condition", CONDITION[board.condition ?? ""] ?? "-"],
    ["Unit", board.unit ?? "-"],
    ["Position", board.position?.trim() || "-"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm sm:grid-cols-4" aria-label="More details of this board">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="truncate font-medium" title={v}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One stored answer as text: Yes / No for a boolean, the number with its unit, else the text. */
export function answerText(q: Pick<CatalogQuestion, "unit"> | undefined, v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const t = String(v).trim();
  if (!t) return "-";
  if (t === "true" || t === "false") return t === "true" ? "Yes" : "No";
  return typeof v === "number" && q?.unit ? `${t} ${q.unit}` : t;
}

/** "power_point" -> "Power point" for an answer whose question is no longer in the catalog. */
const keyLabel = (k: string) => {
  const s = k.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : k;
};

export interface AnswerRow { key: string; label: string; value: string }

/** The answers of a board with the catalog's question label, in the catalog order (installation questions, then media type, then common). Unknown keys go last. */
export function answerRows(board: BoardItem, questions: CatalogQuestion[]): AnswerRow[] {
  const rank = (q: CatalogQuestion) => (q.scope === "INSTALLATION" ? 0 : q.scope === "MEDIA" ? 1 : 2);
  const applies = (q: CatalogQuestion) => q.scope === "COMMON" || (q.scope === "MEDIA" && q.scopeCode === board.mediaCode) || (q.scope === "INSTALLATION" && q.scopeCode === board.installationType);
  return Object.entries(board.answers ?? {})
    .map(([key, value]) => {
      const q = questions.filter((x) => x.id === key && applies(x)).sort((a, b) => rank(a) - rank(b))[0] ?? questions.find((x) => x.id === key);
      return { key, label: q?.label ?? keyLabel(key), value: answerText(q, value), sort: q ? rank(q) * 1000 + q.order : 9999 };
    })
    .sort((a, b) => a.sort - b.sort)
    .map((r): AnswerRow => ({ key: r.key, label: r.label, value: r.value }));
}

const TRI: Record<string, string> = { YES: "Yes", NO: "No", NOT_ASSESSED: "Not assessed", AVAILABLE: "Available", NOT_AVAILABLE: "Not available" };
const tri = (v: string) => TRI[v] ?? v;

/** The shop-level feasibility answers that have something to show. */
export function feasibilityRows(i: ShopInstallation): AnswerRow[] {
  const rows: [string, string][] = [
    ["Ladder required", tri(i.ladderRequired)],
    ["Scaffolding required", tri(i.scaffoldingRequired)],
    ["Crane required", tri(i.craneRequired)],
    ["Hydra required", tri(i.hydraRequired)],
    ["Manual installation possible", tri(i.manualInstallationPossible)],
    ["Electrical access", tri(i.electricalAccess)],
    ["Installation height", i.installationHeightFt != null ? `${i.installationHeightFt} ft` : ""],
    ["Access restrictions", i.accessRestrictions.join(", ")],
    ["Obstruction", i.obstruction],
    ["Roadside constraints", i.roadsideConstraints],
    ["Safety notes", i.safetyNotes],
    ["Additional equipment", i.additionalEquipment.join(", ")],
    ["Notes", i.notes],
  ];
  return rows.filter(([, v]) => v.trim() !== "").map(([label, value]) => ({ key: label, label, value }));
}

function Answers({ rows, empty }: { rows: AnswerRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.key} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
          <dt className="min-w-0 text-muted-foreground">{r.label}</dt>
          <dd className={cn("shrink-0 text-right font-medium", r.value === "Not assessed" && "font-normal text-muted-foreground")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The Installation tab of a board: the chosen installation method, its notes, the site-question answers (folded) and the feasibility of the whole shop (folded). */
export function InstallationPanel({ board, shop }: { board: BoardItem; shop?: ShopInstallation | undefined }) {
  const catalog = useCatalog();
  const method = board.installationType ? catalog.data?.installations.find((i) => i.code === board.installationType) : undefined;
  const rows = useMemo(() => answerRows(board, catalog.data?.questions ?? []), [board, catalog.data]);
  const shopRows = useMemo(() => (shop ? feasibilityRows(shop) : []), [shop]);
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Installation method</dt><dd className="font-medium">{method?.name ?? board.installationType ?? "Not chosen"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Installation notes</dt><dd className="font-medium">{board.installationNotes?.trim() || "-"}</dd></div>
      </dl>
      <Collapse title="Site questions and answers" hint={`${rows.length} answered`} defaultOpen>
        <Answers rows={rows} empty="The recce person did not answer any site question for this board." />
      </Collapse>
      {shop && (
        <Collapse title="Shop installation feasibility" hint="whole shop">
          <Answers rows={shopRows} empty="Nothing was recorded for the shop." />
        </Collapse>
      )}
    </div>
  );
}

export interface RemarkRow { key: string; title: string; meta: string; reason: string }

/** The Remarks tab of a board: what the recce person wrote, then everything the reviewers said about this board, newest first. */
export function RemarksPanel({ recceNotes, board, rows }: { recceNotes: string; board: BoardItem | null; rows: RemarkRow[] }) {
  const notes = [recceNotes.trim() && ["Notes for the reviewer", recceNotes.trim()], board?.notes?.trim() && ["Board notes", board.notes.trim()]].filter(Boolean) as [string, string][];
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Notes of the recce person">
        <h3 className="text-sm font-semibold">Recce person&apos;s notes</h3>
        {notes.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">No notes were written.</p> : (
          <ul className="mt-1.5 flex flex-col gap-2">
            {notes.map(([k, v]) => <li key={k} className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="block text-xs text-muted-foreground">{k}</span><span className="whitespace-pre-wrap wrap-break-word">{v}</span></li>)}
          </ul>
        )}
      </section>
      <section aria-label="Review history of this board">
        <h3 className="text-sm font-semibold">Review history ({rows.length})</h3>
        {rows.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Nothing was marked on this board yet.</p> : (
          <ol className="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto border-l border-border pl-3 text-xs">
            {rows.map((r) => (
              <li key={r.key}>
                <span className="font-medium">{r.title}</span>
                <span className="text-muted-foreground"> · {r.meta}</span>
                {r.reason && <span className="block">{r.reason}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
