"use client";

import { useMemo, useState } from "react";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useDeleteQuestion, useReorder, useUpdateQuestion } from "@/lib/api/catalog";
import {
  COMMON_SCOPE, dependentsOf, LIMITS, moveItem, normalizeScope, plural, QUESTION_TYPE_LABEL, questionsOfGroup, scopeTitle, showIfCandidates, showIfDisplay, type ScopeChoice,
} from "@/lib/catalog-rules";
import type { CatalogData, CatalogQuestion } from "@/types/catalog";
import { EntryStatusBadge, ReorderButtons } from "./catalog-parts";
import { QuestionFormDrawer } from "./question-form";
import { ScopeSelect } from "./scope-select";

/** What the question asks for, in a few words: the type, with its unit or its options. */
function answerSummary(q: CatalogQuestion): string {
  if (q.type === "CHOICE") return q.options.join(", ");
  if (q.type === "NUMBER" && q.unit) return `in ${q.unit}`;
  return "";
}

/** Site questions (material requirements per board): choose ONE group first, then add, edit, delete and order the questions of that group. */
export function QuestionsTab({ catalog }: { catalog: CatalogData }) {
  const toast = useToast();
  const update = useUpdateQuestion();
  const del = useDeleteQuestion();
  const reorder = useReorder();
  const [choice, setChoice] = useState<ScopeChoice>(COMMON_SCOPE);
  const [form, setForm] = useState<CatalogQuestion | "new" | null>(null);
  const [deleting, setDeleting] = useState<CatalogQuestion | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // A group that was deleted meanwhile falls back to Common.
  const scope = useMemo(() => normalizeScope(choice, catalog.media, catalog.installations), [choice, catalog.media, catalog.installations]);
  const rows = useMemo(() => questionsOfGroup(catalog.questions, scope), [catalog.questions, scope]);
  const labelOf = useMemo(() => new Map(showIfCandidates(catalog.questions, scope, "").map((c) => [c.key, c.label])), [catalog.questions, scope]);
  const title = scopeTitle(scope, catalog.media, catalog.installations);
  const atLimit = rows.length >= LIMITS.questionsPerGroup;

  async function move(index: number, dir: -1 | 1) {
    const ids = moveItem(rows.map((q) => q.uid), index, dir);
    if (!ids) return;
    try {
      await reorder.mutateAsync({ kind: "questions", ids });
      toast("Order saved");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function toggle(q: CatalogQuestion) {
    setToggling(q.uid);
    try {
      await update.mutateAsync({ uid: q.uid, patch: { active: !q.active } });
      toast(`"${q.label}" is now ${q.active ? "inactive" : "active"}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setToggling(null);
    }
  }

  const dependents = deleting ? dependentsOf(deleting, catalog.questions) : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft" aria-label="Site questions">
      <div className="space-y-3 border-b border-border p-3">
        <div className="max-w-2xl">
          <ScopeSelect idPrefix="qt" value={scope} media={catalog.media} installations={catalog.installations} onChange={setChoice} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-navy">{title}</h2>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {plural(rows.length, "question")} in this group (up to {LIMITS.questionsPerGroup}).
              {scope.scope === "COMMON" ? " Asked for every board." : scope.scope === "MEDIA" ? " Asked for boards of this media type." : " Asked for boards installed this way."}
            </p>
          </div>
          <Button className="ml-auto bg-royal hover:bg-royal/90" onClick={() => setForm("new")} disabled={atLimit} title={atLimit ? `A group can hold ${LIMITS.questionsPerGroup} questions` : undefined}>
            <Plus className="size-4" aria-hidden /> Add question
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title="No questions in this group" description="Add one, or choose another group above." action={<Button className="bg-royal hover:bg-royal/90" onClick={() => setForm("new")}><Plus className="size-4" aria-hidden /> Add question</Button>} />
      ) : (
        <div className="max-h-[56dvh] overflow-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">Order</span></th>
                <th scope="col" className="px-3 py-2">Question</th>
                <th scope="col" className="hidden w-40 px-3 py-2 lg:table-cell">Key</th>
                <th scope="col" className="hidden w-48 px-3 py-2 lg:table-cell">Answer</th>
                <th scope="col" className="hidden w-52 px-3 py-2 xl:table-cell">Shown when</th>
                <th scope="col" className="w-44 px-3 py-2">Status</th>
                <th scope="col" className="w-24 px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((q, index) => {
                const detail = answerSummary(q);
                const rule = q.showIfId ? `${labelOf.get(q.showIfId) ?? q.showIfId} = ${showIfDisplay(q.showIfValue)}` : "";
                return (
                  <tr key={q.uid} className={q.active ? undefined : "bg-muted/40"}>
                    <td className="px-3 py-2">
                      <ReorderButtons index={index} count={rows.length} name={q.label} onMove={(d) => void move(index, d)} disabled={reorder.isPending} />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-navy" title={q.label}>{q.label}</p>
                      {q.hint && <p className="truncate text-xs text-muted-foreground" title={q.hint}>{q.hint}</p>}
                      <p className="text-xs text-muted-foreground lg:hidden">
                        <span className="font-mono">{q.id}</span> · {QUESTION_TYPE_LABEL[q.type]}{detail ? ` (${detail})` : ""} · {q.required ? "Required" : "Optional"}
                        {rule ? ` · Only if ${rule}` : ""}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2 lg:table-cell"><span className="font-mono text-xs text-muted-foreground">{q.id}</span></td>
                    <td className="hidden px-3 py-2 lg:table-cell">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="primary">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                        <span className="text-xs text-muted-foreground">{q.required ? "Required" : "Optional"}</span>
                      </div>
                      {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={detail}>{detail}</p>}
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-muted-foreground xl:table-cell">
                      {rule ? <span title={rule}>Only if <span className="font-medium text-foreground">{rule}</span></span> : "Always"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <Switch checked={q.active} onChange={() => void toggle(q)} label={`Active: ${q.label}`} disabled={toggling === q.uid} title={q.active ? "Active: click to make it inactive" : "Inactive: click to make it active"} />
                        <EntryStatusBadge status={q.active ? "active" : "inactive"} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${q.label}`} title="Edit" onClick={() => setForm(q)}><Pencil className="size-4" aria-hidden /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${q.label}`} title="Delete" onClick={() => setDeleting(q)}><Trash2 className="size-4 text-danger" aria-hidden /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <QuestionFormDrawer
          key={form === "new" ? "new" : form.uid}
          question={form === "new" ? null : form}
          defaultScope={scope}
          catalog={catalog}
          onSaved={(q) => setChoice({ scope: q.scope, scopeCode: q.scopeCode })}
          onClose={() => setForm(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this question?"
        confirmLabel="Delete question"
        destructive
        loading={del.isPending}
        onConfirm={() => {
          if (!deleting) return;
          const q = deleting;
          del.mutate(q.uid, {
            onSuccess: () => {
              toast(`Question "${q.label}" deleted`);
              setDeleting(null);
            },
            onError: (e) => toast(errorMessage(e), "error"),
          });
        }}
      >
        {deleting && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">&ldquo;{deleting.label}&rdquo;</strong> (<span className="font-mono">{deleting.id}</span>) is removed from <strong className="text-foreground">{scopeTitle({ scope: deleting.scope, scopeCode: deleting.scopeCode }, catalog.media, catalog.installations)}</strong>.
            </p>
            {dependents.length > 0 && (
              <p className="font-medium text-warning">
                {plural(dependents.length, "other question")} only show{dependents.length === 1 ? "s" : ""} when it is answered ({dependents.map((d) => d.label).join(", ")}). Edit {dependents.length === 1 ? "it" : "them"} afterwards.
              </p>
            )}
            <p>Answers already given stay on their boards under the key; nothing asks for them any more.</p>
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
