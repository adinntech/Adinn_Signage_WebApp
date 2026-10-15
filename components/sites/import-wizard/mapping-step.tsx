"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { ApiError, errorMessage } from "@/lib/api";
import {
  FIELD_LABELS,
  MAPPABLE,
  SCENARIOS,
  SCENARIO_LABEL,
  UNITS,
  previewImport,
  validateMapping,
  type DuplicatePolicy,
  type ImportBatch,
  type MapTarget,
  type Scenario,
  type Unit,
  type UploadResult,
} from "@/lib/api/sites";
import { cn } from "@/lib/utils";

const POLICIES: { value: DuplicatePolicy; label: string; help: string }[] = [
  { value: "skip", label: "Skip duplicates", help: "Rows that match an existing site (same shop, dealer, district) are left out." },
  { value: "import", label: "Import anyway", help: "Duplicates are added as new sites." },
  { value: "update", label: "Update existing sites", help: "Matching sites are updated with the non-blank values from the file. Use this for a revised sheet." },
];

export interface MappingSettings {
  mapping: Record<string, MapTarget>;
  scenario: Scenario;
  unit: Unit;
  policy: DuplicatePolicy;
}

export function MappingStep({
  projectId,
  upload,
  settings,
  onSettings,
  onPreviewed,
}: {
  projectId: string;
  upload: UploadResult;
  settings: MappingSettings;
  onSettings: (s: MappingSettings) => void;
  onPreviewed: (b: ImportBatch) => void;
}) {
  const { mapping, scenario, unit, policy } = settings;
  const [busy, setBusy] = React.useState(false);
  const [serverProblems, setServerProblems] = React.useState<string[]>([]);
  const headers = upload.batch.headers;

  const problems = validateMapping(mapping, scenario);
  const targetCount = new Map<string, number>();
  for (const t of Object.values(mapping)) if (t !== "extra" && t !== "ignore") targetCount.set(t, (targetCount.get(t) ?? 0) + 1);

  const samples = (h: string) =>
    upload.sample
      .map((r) => r.raw[h])
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .slice(0, 3);

  async function validate() {
    setBusy(true);
    setServerProblems([]);
    try {
      onPreviewed(await previewImport(projectId, upload.batch._id, { mapping, scenario, defaultUnit: unit, duplicatePolicy: policy }));
    } catch (e) {
      const details = e instanceof ApiError && Array.isArray(e.details) ? (e.details as { message?: string }[]).map((d) => d.message ?? "") : [];
      setServerProblems(details.filter(Boolean).length ? details.filter(Boolean) : [errorMessage(e)]);
      setBusy(false);
    }
  }

  const set = (p: Partial<MappingSettings>) => onSettings({ ...settings, ...p });
  const shown = [...problems, ...serverProblems.filter((m) => !problems.includes(m))];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{upload.batch.fileName}</span> - {upload.batch.totalRows.toLocaleString("en-IN")} rows
        {upload.batch.sheetName ? `, sheet "${upload.batch.sheetName}"` : ""}. Check how each column maps to a site field. Suggested matches are preselected.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Column in file</th>
              <th className="px-3 py-2 font-medium">Sample values</th>
              <th className="w-72 px-3 py-2 font-medium">Maps to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {headers.map((h, i) => {
              const t = mapping[h] ?? "extra";
              const dupe = t !== "extra" && t !== "ignore" && (targetCount.get(t) ?? 0) > 1;
              const suggested = upload.suggestedMapping[h];
              return (
                <tr key={h + i}>
                  <td className="px-3 py-2 font-medium">{h}</td>
                  <td className="max-w-64 px-3 py-2 text-xs text-muted-foreground">
                    {samples(h).map((v, j) => (
                      <span key={j} className="mr-1 inline-block max-w-40 truncate rounded bg-muted px-1.5 py-0.5 align-middle" title={v}>
                        {v}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={`Map column ${h}`}
                        aria-invalid={dupe}
                        className={cn("h-9", dupe && "border-danger")}
                        value={t}
                        onChange={(e) => set({ mapping: { ...mapping, [h]: e.target.value as MapTarget } })}
                      >
                        <optgroup label="Site fields">
                          {MAPPABLE.map((f) => (
                            <option key={f} value={f}>
                              {FIELD_LABELS[f]}
                            </option>
                          ))}
                        </optgroup>
                        <option value="extra">Keep as extra column</option>
                        <option value="ignore">Ignore</option>
                      </Select>
                      {suggested === t && t !== "extra" && t !== "ignore" && <Badge tone="info">Suggested</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div aria-live="polite">
        {shown.length > 0 ? (
          <ul className="space-y-1 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {shown.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">The mapping looks complete.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data scenario" htmlFor="iw-sc">
          <Select id="iw-sc" value={scenario} onChange={(e) => set({ scenario: e.target.value as Scenario })}>
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {SCENARIO_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default unit" htmlFor="iw-unit" hint="Used when a size has no unit.">
          <Select id="iw-unit" value={unit} onChange={(e) => set({ unit: e.target.value as Unit })}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duplicates" htmlFor="iw-dup" hint={POLICIES.find((p) => p.value === policy)?.help}>
          <Select id="iw-dup" value={policy} onChange={(e) => set({ policy: e.target.value as DuplicatePolicy })}>
            {POLICIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={validate} loading={busy} disabled={problems.length > 0}>
          Validate
        </Button>
      </div>
    </div>
  );
}
