"use client";

import { useState } from "react";
import { CheckCircle2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useSetAdditionalShops } from "@/lib/api/pipeline";
import type { Project } from "@/lib/api/projects";

/** Shops found beyond the client's list. Saving raises the project's total expected shop count. */
export function AdditionalShops({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const toast = useToast();
  const save = useSetAdditionalShops(project._id);
  const base = project.expectedShops ?? 0;
  const saved = project.additionalShops ?? 0;
  const [count, setCount] = useState(String(saved));
  const [note, setNote] = useState(project.additionalShopsNote ?? "");
  const n = Number(count);
  const valid = /^\d+$/.test(count) && n <= 100000;

  return (
    <div className="rounded-xl border border-[#f9c6dd] bg-[#fdf2f8] p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#be185d]">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#ec4899] text-white"><PlusCircle className="size-4" aria-hidden /></span>
        Additional Shop Count Support
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">If more shops are identified during the recce, add them below.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.4fr)]">
        <Field label="Additional shops count" htmlFor="addl-count" error={valid ? undefined : "Enter a whole number, 0 or more"}>
          <Input id="addl-count" inputMode="numeric" value={count} disabled={!canEdit} onChange={(e) => setCount(e.target.value)} aria-invalid={!valid} />
        </Field>
        <div className="flex items-end">
          <p className="flex w-full items-start gap-2 rounded-lg border border-[#bbf0d3] bg-[#e7f9ef] px-3 py-2 text-xs text-finance">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Total expected shops {valid && n !== saved ? "will be updated to" : "is"} <strong>{base + (valid ? n : saved)}</strong> ({base} + {valid ? n : saved} additional)</span>
          </p>
        </div>
        <Field label="Remarks" htmlFor="addl-note">
          <Textarea id="addl-note" rows={2} value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Additional shops identified during recce in nearby streets." />
        </Field>
      </div>
      {canEdit && (
        <div className="mt-3 flex justify-end">
          <Button
            className="bg-[#be185d] hover:bg-[#9d174d]"
            loading={save.isPending}
            disabled={!valid || (n === saved && note.trim() === (project.additionalShopsNote ?? ""))}
            onClick={() => save.mutate({ count: n, note: note.trim() || undefined }, { onSuccess: () => toast(`Total expected shops: ${base + n}`), onError: (e) => toast(errorMessage(e), "error") })}
          >
            Save additional shops
          </Button>
        </div>
      )}
    </div>
  );
}
