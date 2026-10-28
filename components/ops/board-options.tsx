"use client";

import { useState } from "react";
import { Ban, Check, Download, Pencil, Plus, Repeat2, RotateCcw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  DECISION_LABEL,
  downloadBoards,
  useBoardSummary,
  useBoards,
  useDecideBoard,
  useDeleteBoard,
  useSaveBoard,
  type BoardDecision,
  type BoardOption,
} from "@/lib/api/boards";
import { UNITS, useSites, type Site } from "@/lib/api/sites";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<BoardDecision, "neutral" | "success" | "danger" | "warning"> = { PENDING: "neutral", APPROVED: "success", REJECTED: "danger", CHANGED: "warning" };
const BOARD_TYPES = ["GSB Glow Sign", "ACP Board", "Non-Lit Board", "Pole Board", "Vinyl / Flex", "Acrylic Letters", "Wall Painting"];
const siteName = (s: Site) => s.shopName || s.dealerName || s.siteCode;

/**
 * For each shop, note every board that could fit, then record what the client decided:
 * OK, Cancelled (with reason) or Board changed (with reason). Export gives the sheet for the client PPT / discussion.
 */
export function BoardOptions({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [siteId, setSiteId] = useState("");
  const sites = useSites(projectId, { q: dq || undefined, page, limit: 12, sort: "seq" });
  const summary = useBoardSummary(projectId);
  const boards = useBoards(projectId, siteId || undefined);
  const save = useSaveBoard(projectId);
  const decide = useDecideBoard(projectId);
  const del = useDeleteBoard(projectId);

  const [edit, setEdit] = useState<{ open: boolean; board?: BoardOption }>({ open: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<{ board: BoardOption; decision: "REJECTED" | "CHANGED" } | null>(null);
  const [remark, setRemark] = useState("");
  const [toDelete, setToDelete] = useState<BoardOption | null>(null);

  const rows = sites.data?.data ?? [];
  const selected = rows.find((s) => s._id === siteId);
  const t = summary.data?.totals;

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const text = (k: string) => String(fd.get(k) ?? "").trim();
    const numOrUndef = (k: string) => (text(k) === "" ? undefined : Number(text(k)));
    const e: Record<string, string> = {};
    if (text("boardType").length < 2) e.boardType = "Enter the board type";
    for (const k of ["width", "height"]) if (text(k) && !(Number(text(k)) > 0)) e[k] = "Enter a number above 0";
    if (!/^\d+$/.test(text("quantity")) || Number(text("quantity")) < 1) e.quantity = "Whole number, 1 or more";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate(
      {
        id: edit.board?._id,
        body: {
          ...(edit.board ? {} : { siteId }),
          boardType: text("boardType"),
          width: numOrUndef("width"),
          height: numOrUndef("height"),
          unit: text("unit") as never,
          quantity: Number(text("quantity")),
          notes: text("notes"),
        },
      },
      {
        onSuccess: () => {
          toast(edit.board ? "Board option updated" : "Board option added");
          setEdit({ open: false });
        },
        onError: (err) => {
          const fe = fieldErrorsOf(err);
          if (Object.keys(fe).length) setErrors(fe);
          else toast(errorMessage(err), "error");
        },
      },
    );
  }

  const send = (board: BoardOption, decision: BoardDecision, why?: string) =>
    decide.mutate(
      { id: board._id, decision, remark: why },
      { onSuccess: () => { toast(`${board.boardType}: ${DECISION_LABEL[decision]}`); setAsk(null); setRemark(""); }, onError: (e) => toast(errorMessage(e), "error") },
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["PENDING", "APPROVED", "REJECTED", "CHANGED"] as const).map((d) => (
          <div key={d} className="rounded-xl border border-border bg-surface p-3 shadow-soft">
            <p className="text-xs font-medium text-muted-foreground">{DECISION_LABEL[d]}</p>
            <p className={cn("text-2xl font-bold tabular-nums", d === "APPROVED" && "text-finance", d === "REJECTED" && "text-loss", d === "CHANGED" && "text-approval", d === "PENDING" && "text-navy")}>{summary.isPending ? "–" : (t?.[d] ?? 0)}</p>
          </div>
        ))}
        <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-border bg-surface p-3 shadow-soft">
          <Button size="sm" variant="outline" onClick={() => downloadBoards(projectId).catch((e) => toast(errorMessage(e), "error"))}><Download className="size-4" aria-hidden /> All options</Button>
          <Button size="sm" variant="outline" onClick={() => downloadBoards(projectId, "APPROVED").catch((e) => toast(errorMessage(e), "error"))}><Check className="size-4" aria-hidden /> Only OK</Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search shops…" className="pl-9" aria-label="Search shops" />
          </div>
          {sites.isPending ? (
            <RowsSkeleton rows={5} className="p-3" />
          ) : sites.isError ? (
            <ErrorState error={sites.error} onRetry={() => sites.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="No shops yet" description="Add shops in the Shop details tab first." />
          ) : (
            <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
              {rows.map((s) => {
                const c = summary.data?.perSite[s._id] ?? {};
                const n = Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
                return (
                  <li key={s._id}>
                    <button type="button" onClick={() => setSiteId(s._id)} aria-current={siteId === s._id} className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[#f4f8ff]", siteId === s._id && "bg-[#e8f0ff]")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-navy">{siteName(s)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[s.location, s.district].filter(Boolean).join(" · ") || s.siteCode}</span>
                      </span>
                      {n > 0 ? <Badge tone={c.APPROVED ? "success" : "neutral"}>{c.APPROVED ?? 0}/{n}</Badge> : <span className="text-xs text-muted-foreground">none</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination meta={sites.data?.meta} onPage={setPage} />
        </section>

        <section className="rounded-xl border border-border bg-surface shadow-soft">
          {!siteId ? (
            <EmptyState title="Select a shop" description="Pick a shop to note which boards can fit and what the client decided." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-navy">{selected ? siteName(selected) : "Shop"}</h3>
                  <p className="truncate text-xs text-muted-foreground">{selected ? [selected.address1, selected.location, selected.district, selected.mobile].filter(Boolean).join(" · ") : ""}</p>
                </div>
                {canEdit && (
                  <Button size="sm" className="bg-royal hover:bg-royal/90" onClick={() => { setErrors({}); setEdit({ open: true }); }}>
                    <Plus className="size-4" aria-hidden /> Add board option
                  </Button>
                )}
              </div>
              {boards.isPending ? (
                <RowsSkeleton rows={3} className="p-4" />
              ) : boards.isError ? (
                <ErrorState error={boards.error} onRetry={() => boards.refetch()} />
              ) : boards.data.length === 0 ? (
                <EmptyState title="No board options noted" description="Add every board type that could fit this shop." />
              ) : (
                <ul className="divide-y divide-border">
                  {boards.data.map((b) => (
                    <li key={b._id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-navy">{b.boardType}</p>
                          <p className="text-sm text-muted-foreground">
                            {b.width && b.height ? `${b.width} × ${b.height} ${b.unit}` : "Size not noted"} · Qty {b.quantity}{b.sqft ? ` · ${b.sqft} sq.ft` : ""}
                          </p>
                          {b.notes && <p className="mt-0.5 text-xs text-muted-foreground">{b.notes}</p>}
                        </div>
                        <Badge tone={TONE[b.decision]}>{DECISION_LABEL[b.decision]}</Badge>
                        {canEdit && (
                          <div className="flex">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${b.boardType}`} onClick={() => { setErrors({}); setEdit({ open: true, board: b }); }}><Pencil className="size-4" aria-hidden /></Button>
                            <Button variant="ghost" size="icon" className="text-loss" aria-label={`Delete ${b.boardType}`} onClick={() => setToDelete(b)}><Trash2 className="size-4" aria-hidden /></Button>
                          </div>
                        )}
                      </div>
                      {b.decisionRemark && b.decision !== "PENDING" && (
                        <p className="rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">{b.decisionRemark}{b.decidedAt ? ` · ${formatDate(b.decidedAt)}` : ""}</p>
                      )}
                      {canEdit && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="text-finance" disabled={b.decision === "APPROVED" || decide.isPending} onClick={() => send(b, "APPROVED")}><Check className="size-4" aria-hidden /> OK</Button>
                          <Button size="sm" variant="outline" className="text-loss" disabled={b.decision === "REJECTED"} onClick={() => { setRemark(""); setAsk({ board: b, decision: "REJECTED" }); }}><Ban className="size-4" aria-hidden /> Cancel</Button>
                          <Button size="sm" variant="outline" className="text-approval" disabled={b.decision === "CHANGED"} onClick={() => { setRemark(""); setAsk({ board: b, decision: "CHANGED" }); }}><Repeat2 className="size-4" aria-hidden /> Board changed</Button>
                          {b.decision !== "PENDING" && <Button size="sm" variant="ghost" onClick={() => send(b, "PENDING")}><RotateCcw className="size-4" aria-hidden /> Reset</Button>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <Modal
        open={edit.open}
        onOpenChange={(o) => setEdit((e) => ({ ...e, open: o }))}
        title={edit.board ? "Edit board option" : "Add board option"}
        description={edit.board ? "Editing a board sends it back to the client as waiting." : undefined}
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEdit({ open: false })}>Cancel</Button>
            <Button className="bg-royal hover:bg-royal/90" type="submit" form="board-form" loading={save.isPending}>{edit.board ? "Save changes" : "Add option"}</Button>
          </div>
        }
      >
        <form id="board-form" key={edit.board?._id ?? "new"} noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="space-y-4">
          <Field label="Board type" htmlFor="boardType" required error={errors.boardType}>
            <Input id="boardType" name="boardType" list="board-types" defaultValue={edit.board?.boardType} aria-invalid={!!errors.boardType} />
            <datalist id="board-types">{BOARD_TYPES.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Width" htmlFor="width" error={errors.width}><Input id="width" name="width" format="decimal" defaultValue={edit.board?.width} /></Field>
            <Field label="Height" htmlFor="height" error={errors.height}><Input id="height" name="height" format="decimal" defaultValue={edit.board?.height} /></Field>
            <Field label="Unit" htmlFor="unit"><Select id="unit" name="unit" defaultValue={edit.board?.unit ?? "ft"}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
            <Field label="Qty" htmlFor="quantity" required error={errors.quantity}><Input id="quantity" name="quantity" format="digits" defaultValue={edit.board?.quantity ?? 1} /></Field>
          </div>
          <Field label="Notes" htmlFor="notes" error={errors.notes}><Textarea id="notes" name="notes" rows={2} defaultValue={edit.board?.notes} /></Field>
        </form>
      </Modal>

      <Modal
        open={!!ask}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask?.decision === "REJECTED" ? "Cancel this board" : "Client wants another board"}
        description={ask ? `${ask.board.boardType} — give the client's reason.` : undefined}
        className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAsk(null)}>Back</Button>
            <Button className="bg-royal hover:bg-royal/90" loading={decide.isPending} disabled={remark.trim().length < 3} onClick={() => ask && send(ask.board, ask.decision, remark.trim())}>Save decision</Button>
          </div>
        }
      >
        <Field label="Reason / remark" htmlFor="remark" required>
          <Textarea id="remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={ask?.decision === "CHANGED" ? "Which board does the client want instead?" : "Why was it cancelled?"} />
        </Field>
      </Modal>

      <ConfirmDialog
        autoClose
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete board option?"
        description={toDelete ? `${toDelete.boardType} will be removed from this shop.` : ""}
        confirmLabel="Delete option"
        destructive
        onConfirm={() => { if (toDelete) del.mutate(toDelete._id, { onSuccess: () => toast("Board option deleted"), onError: (e) => toast(errorMessage(e), "error") }); }}
      />
    </div>
  );
}
