"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiError, errorMessage, fieldErrorsOf } from "@/lib/api";
import { SCENARIOS, SCENARIO_LABEL, UNITS } from "@/lib/api/sites";
import { FORMATS, cleanInput, type InputFormat } from "@/lib/input-format";
import { cn } from "@/lib/utils";
import type { CellKind } from "./site-utils";

export interface CellIssue {
  level: "error" | "warning";
  message: string;
}

const inputCls =
  "h-8 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-[invalid=true]:border-danger";

/** Field-level message from a failed save (422 details first, then the generic message). */
function saveError(err: unknown, key: string): string {
  if (err instanceof ApiError && err.status === 422) {
    const f = fieldErrorsOf(err);
    return f[key] ?? Object.values(f)[0] ?? err.message;
  }
  return errorMessage(err);
}

/** Which characters a table cell accepts, by the field it edits. */
const cellFormat = (fieldKey: string, kind: CellKind): InputFormat | undefined =>
  fieldKey === "mobile" ? "phone" : fieldKey === "pincode" ? "pincode" : fieldKey === "gstin" ? "gst" : kind === "number" ? "decimal" : undefined;

/**
 * Click / Enter to edit. Enter saves, Esc cancels, Tab saves and moves on.
 * The edit stays open (with the message shown) when the save fails.
 */
export function EditableCell({
  fieldKey,
  label,
  kind,
  value,
  display,
  editing,
  canEdit,
  issue,
  align,
  onStart,
  onSave,
  onClose,
}: {
  fieldKey: string;
  label: string;
  kind: CellKind;
  value: string;
  display: React.ReactNode;
  editing: boolean;
  canEdit: boolean;
  issue?: CellIssue;
  align?: "right";
  onStart: () => void;
  onSave: (value: string) => Promise<void>;
  onClose: (move?: 1 | -1) => void;
}) {
  if (!editing || !canEdit) {
    return (
      <div className={cn("flex min-w-0 items-center gap-1.5", align === "right" && "justify-end")}>
        {issue && (
          <AlertTriangle
            className={cn("size-3.5 shrink-0", issue.level === "error" ? "text-danger" : "text-warning")}
            aria-label={issue.message}
          />
        )}
        {canEdit ? (
          <button
            type="button"
            onClick={onStart}
            title={issue ? `${issue.message} - click to edit` : `Edit ${label}`}
            aria-label={`Edit ${label}: ${value || "empty"}`}
            className={cn(
              "min-h-6 min-w-0 flex-1 truncate rounded px-1 text-left hover:bg-secondary focus-visible:bg-secondary",
              align === "right" && "text-right",
            )}
          >
            {display || <span className="text-muted-foreground/50">-</span>}
          </button>
        ) : (
          <span className={cn("min-w-0 flex-1 truncate px-1", align === "right" && "text-right")} title={issue?.message}>
            {display || <span className="text-muted-foreground/50">-</span>}
          </span>
        )}
      </div>
    );
  }
  return (
    <Editor
      fieldKey={fieldKey}
      label={label}
      kind={kind}
      initial={value}
      onSave={onSave}
      onClose={onClose}
      align={align}
    />
  );
}

function Editor({
  fieldKey,
  label,
  kind,
  initial,
  align,
  onSave,
  onClose,
}: {
  fieldKey: string;
  label: string;
  kind: CellKind;
  initial: string;
  align?: "right";
  onSave: (value: string) => Promise<void>;
  onClose: (move?: 1 | -1) => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLInputElement & HTMLSelectElement>(null);
  const finished = React.useRef(false);
  const busy = React.useRef(false);
  const errId = React.useId();

  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select?.();
  }, []);

  async function commit(move?: 1 | -1) {
    if (finished.current || busy.current) return;
    if (draft.trim() === initial.trim()) {
      finished.current = true;
      onClose(move);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.trim());
      finished.current = true;
      onClose(move);
    } catch (e) {
      setError(saveError(e, fieldKey));
      busy.current = false;
      setSaving(false);
      ref.current?.focus();
    }
  }

  function cancel() {
    finished.current = true;
    onClose();
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      void commit(e.shiftKey ? -1 : 1);
    }
  };

  const common = {
    "aria-label": label,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errId : undefined,
    onKeyDown,
    onBlur: () => void commit(),
  } as const;

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {kind === "unit" || kind === "scenario" ? (
          <select
            ref={ref}
            {...common}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            className={inputCls}
          >
            {kind === "unit" ? (
              <>
                <option value="">-</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </>
            ) : (
              SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {SCENARIO_LABEL[s]}
                </option>
              ))
            )}
          </select>
        ) : (
          <input
            ref={ref}
            {...common}
            value={draft}
            readOnly={saving}
            inputMode={kind === "number" ? "decimal" : undefined}
            maxLength={cellFormat(fieldKey, kind) ? FORMATS[cellFormat(fieldKey, kind)!].max : undefined}
            onChange={(e) => setDraft(cellFormat(fieldKey, kind) ? cleanInput(cellFormat(fieldKey, kind)!, e.target.value) : e.target.value)}
            className={cn(inputCls, align === "right" && "text-right")}
          />
        )}
        {saving && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Saving" />}
      </div>
      {error && (
        <p id={errId} role="alert" title={error} className="mt-1 whitespace-normal text-xs leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
