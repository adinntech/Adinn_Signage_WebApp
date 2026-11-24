"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DetailItem } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCreateQuestion, useUpdateQuestion } from "@/lib/api/catalog";
import {
  buildQuestionCreate, buildQuestionPatch, cleanQuestionKey, cleanText, emptyQuestionForm, isEmptyPatch, LIMITS, moveItem, questionFormFrom, questionsOfGroup, QUESTION_TYPE_LABEL,
  ruleValueKind, scopeTitle, serverFormErrors, showIfCandidates, validateQuestionForm, withQuestionType, type FormErrors, type QuestionForm, type ScopeChoice,
} from "@/lib/catalog-rules";
import { QUESTION_TYPES, type CatalogData, type CatalogQuestion, type QuestionType } from "@/types/catalog";
import { FormBanner, FormSection, ReorderButtons, SwitchRow } from "./catalog-parts";
import { ScopeSelect } from "./scope-select";

/**
 * Add or edit a site question in a drawer. Group, key and type are chosen when it is made and are read-only afterwards (recorded answers are stored under
 * the key and its type). An edit sends only the fields that changed.
 */
export function QuestionFormDrawer({
  question,
  defaultScope,
  catalog,
  onSaved,
  onClose,
}: {
  question: CatalogQuestion | null;
  defaultScope: ScopeChoice;
  catalog: CatalogData;
  /** After a save: the stored question (a new one may belong to another group than the one on screen). */
  onSaved: (q: CatalogQuestion) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const creating = !question;
  const [v, setV] = useState<QuestionForm>(() => (question ? questionFormFrom(question) : emptyQuestionForm(defaultScope)));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const group: ScopeChoice = useMemo(() => ({ scope: v.scope, scopeCode: v.scopeCode }), [v.scope, v.scopeCode]);
  const selfKey = question?.id ?? v.id;
  const candidates = useMemo(() => showIfCandidates(catalog.questions, group, selfKey), [catalog.questions, group, selfKey]);
  const kind = ruleValueKind(v.showIfId, candidates, question ?? undefined).kind;
  const dirty = creating || !isEmptyPatch(buildQuestionPatch(question, v, kind));

  function set<K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((s) => (s[key] ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)) : s));
  }
  /** A new group: the rule may only wait for a question of that group or a common one, so a rule that no longer fits is cleared. */
  function pickGroup(s: ScopeChoice) {
    setV((cur) => {
      const ok = showIfCandidates(catalog.questions, s, cur.id).some((c) => c.key === cur.showIfId);
      return { ...cur, scope: s.scope, scopeCode: s.scopeCode, ...(cur.showIf && !ok ? { showIfId: "", showIfValue: "" } : {}) };
    });
    setErrors({});
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const err = validateQuestionForm(v, {
      creating,
      candidates,
      siblingKeys: questionsOfGroup(catalog.questions, group).map((q) => q.id),
      ...(question ? { original: question } : {}),
    });
    setErrors(err);
    if (Object.keys(err).length) return;
    const opts = {
      onSuccess: (saved: CatalogQuestion) => {
        toast(creating ? `Question "${saved.label}" added` : `Question "${saved.label}" updated`);
        onSaved(saved);
        onClose();
      },
      onError: (x: unknown) => {
        const fe = serverFormErrors(x, "id");
        if (fe) {
          setErrors(fe);
          setBanner("The server did not accept the form. Check the marked fields.");
        } else {
          setBanner(errorMessage(x));
          toast(errorMessage(x), "error");
        }
      },
    };
    if (question) {
      const patch = buildQuestionPatch(question, v, kind);
      if (isEmptyPatch(patch)) {
        toast("Nothing was changed", "info");
        onClose();
        return;
      }
      update.mutate({ uid: question.uid, patch }, opts);
    } else create.mutate(buildQuestionCreate(v, kind), opts);
  }

  const ruleTarget = candidates.find((c) => c.key === v.showIfId);
  const orphanRule = !!v.showIfId && !ruleTarget;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      variant="drawer"
      persistent
      title={creating ? "Add site question" : "Edit site question"}
      description={creating ? "Asked for every board in the group, at the Install step." : "Only the fields you change are saved."}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="question-form" className="bg-royal hover:bg-royal/90" loading={busy} disabled={!dirty}>{creating ? "Add question" : "Save changes"}</Button>
        </>
      }
    >
      <form id="question-form" onSubmit={submit} noValidate className="space-y-6">
        <FormBanner message={banner} />

        <FormSection title={creating ? "Where and what" : "Fixed after creation"}>
          {creating ? (
            <>
              <ScopeSelect idPrefix="q" required value={group} media={catalog.media} installations={catalog.installations} onChange={pickGroup} />
              {errors.scopeCode && <p role="alert" className="-mt-1 text-xs text-danger">{errors.scopeCode}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Key" htmlFor="q-key" required error={errors.id} hint="The answer is stored under this key. Lowercase letters, digits and _ (2 to 50).">
                  <Input id="q-key" autoFocus autoComplete="off" spellCheck={false} maxLength={LIMITS.questionKey} className="font-mono" value={v.id} onChange={(e) => set("id", cleanQuestionKey(e.target.value))} aria-invalid={!!errors.id} placeholder="led_colour" />
                </Field>
                <Field label="Answer type" htmlFor="q-type" required hint="How the field person answers.">
                  <Select id="q-type" value={v.type} onChange={(e) => setV((s) => withQuestionType(s, e.target.value as QuestionType))}>
                    {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
                  </Select>
                </Field>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <dl className="grid gap-3 sm:grid-cols-3">
                <DetailItem label="Group">{scopeTitle(group, catalog.media, catalog.installations)}</DetailItem>
                <DetailItem label="Key"><span className="font-mono">{question.id}</span></DetailItem>
                <DetailItem label="Answer type"><Badge tone="primary">{QUESTION_TYPE_LABEL[question.type]}</Badge></DetailItem>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">Group, key and type cannot change after the question is made, because recorded answers are stored under the key and its type. To change them, delete the question and add a new one.</p>
            </div>
          )}
        </FormSection>

        <FormSection title="Question">
          <Field label="Question" htmlFor="q-label" required error={errors.label} hint="The text the field person reads.">
            <Input id="q-label" maxLength={LIMITS.label} value={v.label} onChange={(e) => set("label", cleanText(e.target.value, LIMITS.label))} aria-invalid={!!errors.label} placeholder="LED colour" />
          </Field>
          <Field label="Hint" htmlFor="q-hint" error={errors.hint} hint="Optional small text under the question.">
            <Input id="q-hint" maxLength={LIMITS.hint} value={v.hint} onChange={(e) => set("hint", cleanText(e.target.value, LIMITS.hint))} aria-invalid={!!errors.hint} />
          </Field>
          {v.type === "NUMBER" && (
            <Field label="Unit" htmlFor="q-unit" error={errors.unit} hint="Optional, for example ft, mm or kg.">
              <Input id="q-unit" maxLength={LIMITS.unit} className="sm:w-40" value={v.unit} onChange={(e) => set("unit", cleanText(e.target.value, LIMITS.unit))} aria-invalid={!!errors.unit} />
            </Field>
          )}
          {v.type === "CHOICE" && <OptionsEditor value={v.options} onChange={(o) => set("options", o)} error={errors.options} />}
          <SwitchRow title="Required" hint="The field person must answer it before the board is complete.">
            <Switch checked={v.required} onChange={(on) => set("required", on)} label="Required" />
          </SwitchRow>
        </FormSection>

        <FormSection title="Show only when">
          <SwitchRow title="Depends on another answer" hint="Ask it only when another question has a certain answer.">
            <Switch checked={v.showIf} onChange={(on) => set("showIf", on)} label="Depends on another answer" />
          </SwitchRow>
          {v.showIf && (
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
              <Field label="Question" htmlFor="q-if-id" required error={errors.showIfId} hint="From this group, or a common question.">
                <Select id="q-if-id" value={v.showIfId} onChange={(e) => setV((s) => ({ ...s, showIfId: e.target.value, showIfValue: "" }))} aria-invalid={!!errors.showIfId}>
                  <option value="">Choose a question</option>
                  {orphanRule && <option value={v.showIfId}>{v.showIfId} (not in this list)</option>}
                  {candidates.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.key}){c.from === "common" ? " - common" : ""}</option>)}
                </Select>
              </Field>
              <Field label="Has the answer" htmlFor="q-if-value" required error={errors.showIfValue}>
                <RuleValue kind={ruleValueKind(v.showIfId, candidates, question ?? undefined)} value={v.showIfValue} onChange={(t) => set("showIfValue", t)} invalid={!!errors.showIfValue} disabled={!v.showIfId} />
              </Field>
            </div>
          )}
        </FormSection>

        <FormSection title="Status">
          <SwitchRow title="Active" hint="An inactive question is not asked for new boards.">
            <Switch checked={v.active} onChange={(on) => set("active", on)} label="Active" />
          </SwitchRow>
        </FormSection>
      </form>
    </Modal>
  );
}

/** The answer a rule waits for, picked by the type of the question it depends on: Yes / No, one of its options, a number, or a short text. */
function RuleValue({ kind, value, onChange, invalid, disabled }: { kind: ReturnType<typeof ruleValueKind>; value: string; onChange: (text: string) => void; invalid: boolean; disabled: boolean }) {
  if (kind.kind === "yesno") {
    return (
      <Select id="q-if-value" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
        <option value="">Choose Yes or No</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    );
  }
  if (kind.kind === "choice") {
    const known = kind.options.includes(value);
    return (
      <Select id="q-if-value" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
        <option value="">Choose an option</option>
        {value && !known && <option value={value}>{value} (not an option now)</option>}
        {kind.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    );
  }
  if (kind.kind === "number") return <Input id="q-if-value" format="decimal" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />;
  return <Input id="q-if-value" maxLength={LIMITS.showIfText} disabled={disabled} value={value} onChange={(e) => onChange(cleanText(e.target.value, LIMITS.showIfText))} aria-invalid={invalid} />;
}

/** The options of a choice question: add, edit, move, remove (at most 20, each up to 60 characters). Enter adds the next one. */
function OptionsEditor({ value, onChange, error }: { value: string[]; onChange: (o: string[]) => void; error: string | undefined }) {
  /** The box to focus once the new row exists (set when an option is added, used after the next render). */
  const focusAt = useRef<number | null>(null);
  useEffect(() => {
    if (focusAt.current === null) return;
    document.getElementById(`q-opt-${focusAt.current}`)?.focus();
    focusAt.current = null;
  });
  const full = value.length >= LIMITS.options;
  const add = (at = value.length) => {
    if (full) return;
    focusAt.current = at;
    onChange([...value.slice(0, at), "", ...value.slice(at)]);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p id="q-options-label" className="text-sm font-medium text-foreground">Options <span className="text-danger" aria-hidden>*</span></p>
        <p className="text-xs text-muted-foreground">{value.length} of {LIMITS.options}</p>
      </div>
      <ol aria-labelledby="q-options-label" className="space-y-1.5">
        {value.map((o, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <ReorderButtons index={i} count={value.length} name={o.trim() || `option ${i + 1}`} onMove={(d) => { const next = moveItem(value, i, d); if (next) onChange(next); }} />
            <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <Input
              id={`q-opt-${i}`}
              aria-label={`Option ${i + 1}`}
              maxLength={LIMITS.option}
              autoComplete="off"
              value={o}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? cleanText(e.target.value, LIMITS.option) : x)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(i + 1);
                }
              }}
            />
            <button type="button" aria-label={`Remove option ${i + 1}`} title="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-ring">
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={() => add()} disabled={full}>
        <Plus className="size-4" aria-hidden /> Add option
      </Button>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : <p className="text-xs text-muted-foreground">At least two options. Press Enter in a box to add the next one.</p>}
    </div>
  );
}
