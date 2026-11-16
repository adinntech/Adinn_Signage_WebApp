"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useSetAdditionalShops } from "@/lib/api/pipeline";
import type { Project } from "@/lib/api/projects";
import { cn } from "@/lib/utils";

/** Shops found beyond the client's list. Saving raises the project's total expected shop count. Collapsed by default to save space. */
export function AdditionalShops({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const toast = useToast();
  const save = useSetAdditionalShops(project._id);
  const base = project.expectedShops ?? 0;
  const saved = project.additionalShops ?? 0;
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(String(saved));
  const [note, setNote] = useState(project.additionalShopsNote ?? "");
  const n = Number(count);
  const valid = /^\d+$/.test(count) && n <= 100000;
  const shown = valid ? n : saved;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="addl-shops-body"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-royal text-white"><PlusCircle className="size-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-navy">Additional Shop Count Support</span>
          <span className="block text-xs text-muted-foreground">If more shops are identified during the recce, add them here.</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-[#bbf0d3] bg-[#e7f9ef] px-3 py-1 text-xs font-medium text-finance">
          <CheckCircle2 className="size-3.5" aria-hidden /> Total expected <strong>{base + saved}</strong> ({base} + {saved})
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-navy transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div id="addl-shops-body" className="border-t border-[#f9c6dd] p-4">
          <div className="grid items-start gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Field label="Additional shops count" htmlFor="addl-count" error={valid ? undefined : "Enter a whole number, 0 or more"}>
                <Input id="addl-count" format="digits" value={count} disabled={!canEdit} onChange={(e) => setCount(e.target.value)} aria-invalid={!valid} />
              </Field>
              <p className="rounded-lg border border-[#bbf0d3] bg-[#e7f9ef] px-3 py-2 text-xs text-finance">
                Total expected shops {valid && n !== saved ? "will be" : "is"} <strong>{base + shown}</strong> ({base} + {shown} additional)
              </p>
            </div>
            <div className="space-y-3">
              <Field label="Remarks" htmlFor="addl-note">
                <Textarea id="addl-note" rows={3} value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Additional shops identified during recce in nearby streets." />
              </Field>
              {canEdit && (
                <div className="flex justify-end">
                  <Button
                    className="bg-navy hover:bg-navy/90"
                    loading={save.isPending}
                    disabled={!valid || (n === saved && note.trim() === (project.additionalShopsNote ?? ""))}
                    onClick={() => save.mutate({ count: n, note: note.trim() || undefined }, { onSuccess: () => { toast(`Total expected shops: ${base + n}`); setOpen(false); }, onError: (e) => toast(errorMessage(e), "error") })}
                  >
                    Save additional shops
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
