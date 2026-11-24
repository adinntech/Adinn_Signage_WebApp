"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { inUseConflict, type EntryStatus } from "@/lib/catalog-rules";
import { cn } from "@/lib/utils";

/** Active / Inactive / Legacy as a badge (legacy media are never offered for a new board, whatever their switch says). */
export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  if (status === "legacy") return <Badge tone="warning" title="Kept so old records stay readable. Never offered for a new board.">Legacy</Badge>;
  return <Badge tone={status === "active" ? "success" : "neutral"}>{status === "active" ? "Active" : "Inactive"}</Badge>;
}

/** Move up / move down for a row of an ordered list (the first cannot go up, the last cannot go down). */
export function ReorderButtons({ index, count, name, onMove, disabled, disabledReason }: { index: number; count: number; name: string; onMove: (dir: -1 | 1) => void; disabled?: boolean; disabledReason?: string }) {
  const btn = "flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35";
  return (
    <span className="inline-flex flex-col" title={disabled ? disabledReason : undefined}>
      <button type="button" className={btn} aria-label={`Move ${name} up`} disabled={disabled || index <= 0} onClick={() => onMove(-1)}>
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={btn} aria-label={`Move ${name} down`} disabled={disabled || index >= count - 1} onClick={() => onMove(1)}>
        <ChevronDown className="size-4" aria-hidden />
      </button>
    </span>
  );
}

/** A titled block of a form (the long forms are cut into these). */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** One switch line inside a form: the title and a one-line explanation on the left, the switch on the right. */
export function SwitchRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The red box at the top of a form for a refusal that belongs to no single field. */
export function FormBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}

/**
 * Delete with the "still used" rule. The first click runs the delete. If the server answers 409 "... is used by N boards already", the dialog shows
 * that message and offers "Mark inactive" instead (when it makes sense); any other refusal is shown as an error and the dialog stays open.
 */
export function DeleteEntryDialog({
  title,
  confirmLabel = "Delete",
  children,
  onDelete,
  onMarkInactive,
  onClose,
}: {
  title: string;
  confirmLabel?: string;
  /** What deleting does, in words and counts. */
  children: ReactNode;
  /** Runs the delete and shows its own success toast. Rejects with the server's error. */
  onDelete: () => Promise<unknown>;
  /** Offered after a "still used" refusal; leave it out when the entry is already inactive or cannot be made inactive. */
  onMarkInactive?: () => Promise<unknown>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<"delete" | "inactive" | null>(null);
  const [conflict, setConflict] = useState<{ count: number; message: string } | null>(null);

  async function run(kind: "delete" | "inactive") {
    setBusy(kind);
    try {
      await (kind === "delete" ? onDelete() : onMarkInactive!());
      onClose();
    } catch (e) {
      const c = kind === "delete" ? inUseConflict(e) : null;
      if (c) setConflict(c);
      else toast(errorMessage(e), "error");
      setBusy(null);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={conflict ? "It is still in use" : title}
      className="max-w-md"
      footer={
        conflict ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={!!busy}>Close</Button>
            {onMarkInactive && <Button className="bg-royal hover:bg-royal/90" loading={busy === "inactive"} onClick={() => void run("inactive")}>Mark inactive</Button>}
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={!!busy}>Cancel</Button>
            <Button variant="destructive" loading={busy === "delete"} onClick={() => void run("delete")}>{confirmLabel}</Button>
          </>
        )
      }
    >
      {conflict ? (
        <div className="space-y-3 text-sm">
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {conflict.message}
          </p>
          <p className="text-muted-foreground">
            {onMarkInactive
              ? "Boards already recorded keep it, so it cannot be deleted. Marking it inactive stops it being offered for new boards; the boards that use it keep their saved values."
              : "Boards already recorded keep it, so it cannot be deleted. It is already not offered for new boards."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      )}
    </Modal>
  );
}
