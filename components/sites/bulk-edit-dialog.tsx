"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  SCENARIOS,
  SCENARIO_LABEL,
  UNITS,
  useBulkSites,
  type BulkPatch,
  type Scenario,
  type SiteFilter,
  type Unit,
} from "@/lib/api/sites";

export interface BulkTarget {
  ids?: string[];
  filter?: SiteFilter;
  count: number;
}

export function BulkEditDialog({
  projectId,
  target,
  onClose,
  onDone,
}: {
  projectId: string;
  target: BulkTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const bulk = useBulkSites(projectId);
  const [v, setV] = React.useState({
    district: "",
    location: "",
    boardType: "",
    remarks: "",
    unit: "" as Unit | "",
    scenario: "" as Scenario | "",
    width: "",
    height: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const badNum = (x: string) => x.trim() !== "" && !(Number(x) > 0);
  const patch: BulkPatch = {};
  for (const k of ["district", "location", "boardType", "remarks"] as const) if (v[k].trim()) patch[k] = v[k].trim();
  if (v.unit) patch.unit = v.unit;
  if (v.scenario) patch.scenario = v.scenario;
  if (v.width.trim() && !badNum(v.width)) patch.width = Number(v.width);
  if (v.height.trim() && !badNum(v.height)) patch.height = Number(v.height);
  const filled = Object.keys(patch).length;
  const invalid = badNum(v.width) || badNum(v.height);

  async function apply() {
    setError(null);
    try {
      const r = await bulk.mutateAsync({ action: "update", ids: target.ids, filter: target.ids ? undefined : target.filter, patch });
      toast(`Updated ${formatNumber(r.affected)} sites`);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Bulk edit ${formatNumber(target.count)} sites`}
      description="Only the fields you fill in are changed. Blank fields are left as they are."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} loading={bulk.isPending} disabled={filled === 0 || invalid}>
            Apply to {formatNumber(target.count)} sites
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="District" htmlFor="b-district">
            <Input id="b-district" value={v.district} onChange={set("district")} />
          </Field>
          <Field label="Location" htmlFor="b-location">
            <Input id="b-location" value={v.location} onChange={set("location")} />
          </Field>
          <Field label="Board type" htmlFor="b-board">
            <Input id="b-board" value={v.boardType} onChange={set("boardType")} />
          </Field>
          <Field label="Scenario" htmlFor="b-scenario">
            <Select id="b-scenario" value={v.scenario} onChange={set("scenario")}>
              <option value="">Leave unchanged</option>
              {SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {SCENARIO_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Width" htmlFor="b-width" error={badNum(v.width) ? "Enter a number greater than 0" : undefined}>
            <Input id="b-width" inputMode="decimal" value={v.width} onChange={set("width")} aria-invalid={badNum(v.width)} />
          </Field>
          <Field label="Height" htmlFor="b-height" error={badNum(v.height) ? "Enter a number greater than 0" : undefined}>
            <Input id="b-height" inputMode="decimal" value={v.height} onChange={set("height")} aria-invalid={badNum(v.height)} />
          </Field>
          <Field label="Unit" htmlFor="b-unit">
            <Select id="b-unit" value={v.unit} onChange={set("unit")}>
              <option value="">Leave unchanged</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Remarks" htmlFor="b-remarks" hint="Replaces the existing remarks on every selected site.">
          <Input id="b-remarks" value={v.remarks} onChange={set("remarks")} />
        </Field>
      </div>
    </Modal>
  );
}

export function BulkDeleteDialog({
  projectId,
  target,
  onClose,
  onDone,
}: {
  projectId: string;
  target: BulkTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const bulk = useBulkSites(projectId);
  const [error, setError] = React.useState<string | null>(null);
  async function run() {
    setError(null);
    try {
      const r = await bulk.mutateAsync({ action: "delete", ids: target.ids, filter: target.ids ? undefined : target.filter });
      toast(`Deleted ${formatNumber(r.affected)} sites`);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${formatNumber(target.count)} sites?`}
      description="The sites are removed from the project. This cannot be undone from the app."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={run} loading={bulk.isPending}>
            Delete {formatNumber(target.count)} sites
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="text-sm">
          {target.ids ? "The selected sites" : "Every site matching the current filter"} ({formatNumber(target.count)}) will be deleted.
        </p>
      )}
    </Modal>
  );
}
