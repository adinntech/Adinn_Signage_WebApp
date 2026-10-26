"use client";

import { useState } from "react";
import { Check, Paperclip, Plus, Receipt, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { FilePreviewDialog } from "@/components/upload/file-preview-dialog";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { EXPENSE_LABEL, useAddExpense, useDeleteExpense, useExpenses, useReviewExpense, type ExpenseCategory, type ExpenseClaim } from "@/lib/api/costing";
import { useProjectFiles, type StoredFile } from "@/lib/api/pipeline";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const LABEL = { PENDING: "Waiting", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * In-house recce expenses: the claims and bills (tickets, stay bills, fuel receipts) the team uploads from the mobile app,
 * shown here as they arrive. Finance / Admin approve a claim only when its proof is attached.
 */
export function ExpenseClaims({ projectId, canAdd, estimateByCategory }: { projectId: string; canAdd: boolean; estimateByCategory?: Partial<Record<ExpenseCategory, number>> }) {
  const toast = useToast();
  const { can } = useAuth();
  const list = useExpenses(projectId);
  const files = useProjectFiles(projectId, "RECCE_EXPENSE");
  const add = useAddExpense(projectId);
  const review = useReviewExpense(projectId);
  const del = useDeleteExpense(projectId);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<StoredFile | null>(null);
  const [rejecting, setRejecting] = useState<ExpenseClaim | null>(null);
  const [why, setWhy] = useState("");
  const canReview = can("finance:manage");
  const byId = new Map((files.data ?? []).map((f) => [f.id, f]));
  const d = list.data;

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const amount = Number(String(fd.get("amount") ?? ""));
    const receipt = fd.get("receipt");
    const e: Record<string, string> = {};
    if (!(amount > 0)) e.amount = "Enter the amount";
    if (!fd.get("date")) e.date = "Pick the date";
    setErrors(e);
    if (Object.keys(e).length) return;
    add.mutate(
      { category: fd.get("category") as ExpenseCategory, amount, date: String(fd.get("date")), note: String(fd.get("note") ?? "").trim() || undefined, receipt: receipt instanceof File && receipt.size > 0 ? receipt : null },
      {
        onSuccess: () => { toast("Expense claim added"); setOpen(false); },
        onError: (err) => { const fe = fieldErrorsOf(err); if (Object.keys(fe).length) setErrors(fe); else toast(errorMessage(err), "error"); },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["Claimed", d?.totals.all, "text-navy"], ["Approved", d?.totals.approved, "text-finance"], ["Waiting", d?.totals.pending, "text-approval"], ["Without bill", d?.totals.withoutProof, d?.totals.withoutProof ? "text-loss" : "text-navy"]] as const).map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-border bg-surface p-3 shadow-soft">
            <p className="text-xs font-medium text-muted-foreground">{l}</p>
            <p className={cn("text-xl font-bold tabular-nums", c)}>{list.isPending ? "–" : l === "Without bill" ? (v ?? 0) : inr(v ?? 0)}</p>
          </div>
        ))}
      </div>

      {d && Object.keys(d.byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(d.byCategory).map(([c, v]) => {
            const est = estimateByCategory?.[c as ExpenseCategory];
            return (
              <span key={c} className={cn("rounded-full px-3 py-1 text-xs font-medium", est !== undefined && v > est ? "bg-[#ffe8e8] text-loss" : "bg-[#eef4ff] text-navy")}>
                {EXPENSE_LABEL[c as ExpenseCategory] ?? c} {inr(v)}{est !== undefined ? ` / est. ${inr(est)}` : ""}
              </span>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy"><Receipt className="size-4 text-recce" aria-hidden /> Claims &amp; bills from the recce team</h3>
          {canAdd && <Button size="sm" className="bg-royal hover:bg-royal/90" onClick={() => { setErrors({}); setOpen(true); }}><Plus className="size-4" aria-hidden /> Add claim</Button>}
        </div>
        {list.isPending ? (
          <RowsSkeleton rows={3} className="p-4" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : d!.items.length === 0 ? (
          <EmptyState title="No claims yet" description="Bills the team uploads from the mobile app will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Bill</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d!.items.map((x) => {
                  const f = x.receiptFileId ? byId.get(x.receiptFileId) : undefined;
                  return (
                    <tr key={x._id}>
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(x.date)}</td>
                      <td className="px-3 py-2">{x.submittedBy?.name ?? "-"}{x.note && <span className="block max-w-56 truncate text-xs text-muted-foreground">{x.note}</span>}</td>
                      <td className="px-3 py-2">{EXPENSE_LABEL[x.category]}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(x.amount)}</td>
                      <td className="px-3 py-2">
                        {x.receiptFileId ? (
                          <Button size="sm" variant="outline" disabled={!f} onClick={() => f && setPreview(f)}><Paperclip className="size-3.5" aria-hidden /> {f ? "View bill" : "Loading…"}</Button>
                        ) : <span className="text-xs font-medium text-loss">No bill</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={TONE[x.status]}>{LABEL[x.status]}</Badge>
                        {x.reviewRemark && <span className="block max-w-44 truncate text-xs text-muted-foreground" title={x.reviewRemark}>{x.reviewRemark}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {canReview && x.status !== "APPROVED" && (
                            <Button size="icon" variant="ghost" className="text-finance" aria-label="Approve claim" disabled={!x.receiptFileId || review.isPending} title={x.receiptFileId ? "Approve" : "Needs a bill first"} onClick={() => review.mutate({ id: x._id, status: "APPROVED" }, { onError: (e) => toast(errorMessage(e), "error") })}><Check className="size-4" aria-hidden /></Button>
                          )}
                          {canReview && x.status !== "REJECTED" && <Button size="icon" variant="ghost" className="text-loss" aria-label="Reject claim" onClick={() => { setWhy(""); setRejecting(x); }}><X className="size-4" aria-hidden /></Button>}
                          {(canReview || (canAdd && x.status === "PENDING")) && (
                            <Button size="icon" variant="ghost" aria-label="Delete claim" onClick={() => del.mutate(x._id, { onSuccess: () => toast("Claim deleted"), onError: (e) => toast(errorMessage(e), "error") })}><Trash2 className="size-4" aria-hidden /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add expense claim"
        description="A claim is approved only with a bill, ticket or receipt."
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-royal hover:bg-royal/90" type="submit" form="claim-form" loading={add.isPending}>Add claim</Button></div>}
      >
        <form id="claim-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="category"><Select id="category" name="category" defaultValue="TRAVEL">{Object.entries(EXPENSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Amount (₹)" htmlFor="amount" required error={errors.amount}><Input id="amount" name="amount" inputMode="decimal" aria-invalid={!!errors.amount} /></Field>
          </div>
          <Field label="Date" htmlFor="date" required error={errors.date}><Input id="date" name="date" type="date" defaultValue={today()} /></Field>
          <Field label="Bill / ticket / receipt" htmlFor="receipt" error={errors.receiptFileId} hint="Photo or PDF"><Input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" /></Field>
          <Field label="Note" htmlFor="note"><Textarea id="note" name="note" rows={2} placeholder="e.g. Bus Madurai → Theni" /></Field>
        </form>
      </Modal>

      <Modal
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject claim"
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRejecting(null)}>Back</Button><Button className="bg-loss hover:bg-loss/90" disabled={why.trim().length < 3} loading={review.isPending} onClick={() => rejecting && review.mutate({ id: rejecting._id, status: "REJECTED", remark: why.trim() }, { onSuccess: () => setRejecting(null), onError: (e) => toast(errorMessage(e), "error") })}>Reject</Button></div>}
      >
        <Field label="Reason" htmlFor="why" required><Textarea id="why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
      </Modal>
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
