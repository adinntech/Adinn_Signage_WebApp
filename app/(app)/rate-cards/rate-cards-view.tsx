"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FilterX, Info, Pencil, Plus, ReceiptIndianRupee, Search, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { RATE_UNITS, useDeleteRateItem, useRateItems, useSaveRateItem, type RateItem, type RateUnit } from "@/lib/api/ratecards";
import { formatCurrency, formatDate } from "@/lib/format";

const UNITS = Object.keys(RATE_UNITS) as [RateUnit, ...RateUnit[]];
const schema = z.object({
  particulars: z.string().trim().min(2, "Enter the signage particulars").max(150),
  specifications: z.string().trim().max(300),
  unit: z.enum(UNITS, { error: "Choose a rate unit" }),
  rate: z.number({ error: "Enter the rate amount" }).positive("Rate amount must be greater than 0").max(100000000, "Rate amount is too large"),
});
type Values = z.infer<typeof schema>;

function RateItemDialog({ item, open, onOpenChange }: { item: RateItem | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const save = useSaveRateItem();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: item ? { particulars: item.particulars, specifications: item.specifications ?? "", unit: item.unit, rate: item.rate } : { particulars: "", specifications: "", unit: "SQFT", rate: Number.NaN },
  });
  const { register, handleSubmit, setError, formState } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: item?._id, body: { ...v, specifications: v.specifications || undefined } });
      toast(item ? "Rate item updated. Saved quotations are not changed." : "Rate item added");
      onOpenChange(false);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      for (const [p, message] of Object.entries(fe)) setError(p as keyof Values, { message });
      if (!Object.keys(fe).length) setError("root", { message: errorMessage(err) });
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit Rate Item" : "Add New Rate Item"}
      description="Master rates are the standard starting point for quotations."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" type="submit" form="rate-item-form" loading={save.isPending}>
            Save Changes
          </Button>
        </>
      }
    >
      <form id="rate-item-form" noValidate onSubmit={onSubmit} className="space-y-4">
        {e.root && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {e.root.message}
          </p>
        )}
        <Field label="Signage Particulars" htmlFor="ri-part" required error={e.particulars?.message}>
          <Input id="ri-part" placeholder="e.g. ACP Facia Signage" aria-invalid={!!e.particulars} {...register("particulars")} />
        </Field>
        <Field label="Specifications" htmlFor="ri-spec" error={e.specifications?.message}>
          <Textarea id="ri-spec" className="min-h-16" placeholder="e.g. 3mm ACP with vinyl, backlit" {...register("specifications")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rate Unit" htmlFor="ri-unit" required error={e.unit?.message}>
            <Select id="ri-unit" {...register("unit")}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {RATE_UNITS[u]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rate Amount (₹)" htmlFor="ri-rate" required error={e.rate?.message}>
            <Input id="ri-rate" type="number" inputMode="decimal" min={0} step="0.01" aria-invalid={!!e.rate} {...register("rate", { valueAsNumber: true })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/** Screen 10: Master Rate Card Management. */
export function RateCardsView() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useRateItems({ q: dq, unit, page, limit: 20 });
  const remove = useDeleteRateItem();
  const [editing, setEditing] = useState<RateItem | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<RateItem | null>(null);
  const rows = list.data?.data ?? [];
  const offset = ((list.data?.meta.page ?? 1) - 1) * (list.data?.meta.limit ?? 20);
  const add = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader
        icon={ReceiptIndianRupee}
        title="Rate Card Management"
        subtitle="Master signage items and standard rates used to build client quotations."
        actions={
          <Button variant="brand" onClick={add}>
            <Plus className="size-4" aria-hidden /> Add New Rate Item
          </Button>
        }
      />
      <p className="flex items-start gap-2 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3 text-sm text-[#1d4ed8]">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        This module stores master rates only. Updating a rate here does not change quotations already saved for clients.
      </p>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search rate items"
              placeholder="Search particulars or specifications"
              className="pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-44">
            <Select
              aria-label="Filter by rate unit"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Rate Units</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {RATE_UNITS[u]}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={!q && !unit}
            onClick={() => {
              setQ("");
              setUnit("");
              setPage(1);
            }}
          >
            <FilterX className="size-4" aria-hidden /> Clear Filters
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Master Rate Table</h2>
          {list.data && <span className="text-xs text-muted-foreground">{list.data.meta.total} items</span>}
        </div>
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptIndianRupee}
            title={dq || unit ? "No rate items match your filters" : "No master rate items"}
            action={
              !dq && !unit ? (
                <Button variant="brand" onClick={add}>
                  <Plus className="size-4" aria-hidden /> Add New Rate Item
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-16 px-4 py-3">S.No.</th>
                  <th className="px-4 py-3">Signage Particulars</th>
                  <th className="px-4 py-3">Specifications</th>
                  <th className="px-4 py-3">Rate Unit</th>
                  <th className="px-4 py-3 text-right">Rate Amount (₹)</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3">Updated Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <motion.tr key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-muted-foreground">{offset + i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{r.particulars}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.specifications || "-"}</td>
                    <td className="px-4 py-3">{RATE_UNITS[r.unit]}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(r.rate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${r.particulars}`}
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Delete ${r.particulars}`} onClick={() => setDeleting(r)}>
                          <Trash2 className="size-4 text-danger" aria-hidden /> Delete
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!list.isError && rows.length > 0 && <Pagination meta={list.data?.meta} onPage={setPage} />}
      </Card>

      <RateItemDialog item={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete rate item?"
        description={`"${deleting?.particulars ?? ""}" will be removed from the master rate card. Quotations that already use it keep their saved copy.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting._id);
            toast("Rate item deleted (archived for history)");
            setDeleting(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </div>
  );
}
