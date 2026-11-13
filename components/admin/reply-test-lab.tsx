"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FlaskConical, Play, ShieldCheck, XCircle } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAnalyzeReply, useLabCases, useLabRules, useRunReplySuite, type LabAnalysis, type LabCase, type LabGroup, type LabInput, type LabRow, type LabStatus, type LabWorkflow } from "@/lib/api/replyLab";

const WORKFLOWS: { key: LabWorkflow; label: string }[] = [
  { key: "VENDOR_ID", label: "Vendor registration ID" },
  { key: "RATE_APPROVAL", label: "Vendor rate approval" },
  { key: "PROJECT_CODE", label: "Project code creation" },
];
const STATUSES: LabStatus[] = ["EXTRACTED", "APPROVED", "REJECTED", "PENDING", "REVIEW_REQUIRED", "INVALID", "CANCELLED", "NOT_FOUND", "UNMATCHED", "DUPLICATE"];
const TONE: Record<LabStatus, Tone> = { EXTRACTED: "success", APPROVED: "success", REJECTED: "danger", PENDING: "warning", REVIEW_REQUIRED: "warning", INVALID: "danger", CANCELLED: "danger", NOT_FOUND: "neutral", UNMATCHED: "neutral", DUPLICATE: "neutral" };
const EXAMPLE: Record<LabWorkflow, string> = { VENDOR_ID: "Vendor ID - AB12345", RATE_APPROVAL: "Okay, proceed with ₹18,500", PROJECT_CODE: "Project code: est - 457435" };
const GROUPS: { key: LabGroup | "ALL"; label: string }[] = [{ key: "ALL", label: "All cases" }, { key: "VENDOR_ID", label: "Vendor ID" }, { key: "RATE_APPROVAL", label: "Rate approval" }, { key: "PROJECT_CODE", label: "Project code" }, { key: "CROSS", label: "Cross-workflow and security" }];
const list = (s: string) => s.split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);
const StatusBadge = ({ s }: { s: LabStatus }) => <Badge tone={TONE[s] ?? "neutral"}>{s.replace(/_/g, " ")}</Badge>;

const csv = (rows: LabRow[]) => {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ⏎ ")}"`;
  const head = ["Test ID", "Workflow", "Raw email reply", "Expected value", "Expected status", "Actual value", "Actual status", "Pass / Fail", "Failure reason"];
  return [head, ...rows.map((r) => [r.id, r.workflow, r.rawReply, r.expectedValue ?? "", r.expectedStatus, r.actualValue ?? "", r.actualStatus, r.pass ? "PASS" : "FAIL", r.failureReason])].map((l) => l.map(q).join(",")).join("\r\n");
};
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Admin > Email Reply Test Lab: paste a reply, see what the CRM would read from it; run the whole stored suite. Nothing here saves to a vendor, project or request. */
export function ReplyTestLab() {
  const toast = useToast();
  const rules = useLabRules();
  const cases = useLabCases();
  const analyze = useAnalyzeReply();
  const suite = useRunReplySuite();
  const [workflow, setWorkflow] = useState<LabWorkflow>("VENDOR_ID");
  const [subject, setSubject] = useState("");
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState("");
  const [recipients, setRecipients] = useState("");
  const [state, setState] = useState<"" | "PENDING" | "APPROVED" | "NOT_APPROVED">("");
  const [amount, setAmount] = useState("");
  const [existing, setExisting] = useState("");
  const [expStatus, setExpStatus] = useState("");
  const [expValue, setExpValue] = useState("");
  const [out, setOut] = useState<LabAnalysis | null>(null);
  const [group, setGroup] = useState<LabGroup | "ALL">("ALL");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const withContext = !!(requestId.trim() || recipients.trim() || existing.trim() || amount.trim() || state);
  function run() {
    const payload: LabInput = {
      workflow, subject, body,
      ...(sender.trim() ? { sender: sender.trim() } : {}),
      ...(withContext ? { request: { ...(requestId.trim() ? { requestId: requestId.trim() } : {}), recipients: list(recipients), ...(state ? { state } : {}), ...(amount.trim() && Number(amount) > 0 ? { requestedAmount: Number(amount) } : {}), existingValues: list(existing), processedMessageIds: [] } } : {}),
      ...(expStatus ? { expectStatus: expStatus } : {}),
      ...(expStatus || expValue.trim() ? { expectValue: expValue.trim() || null } : {}),
    };
    analyze.mutate(payload, { onSuccess: setOut, onError: (e) => toast(errorMessage(e), "error") });
  }
  function load(c: LabCase | LabRow) {
    if ("input" in c) {
      const r = c.input.request;
      setWorkflow(c.workflow); setSubject(c.input.subject ?? ""); setBody(c.input.body ?? ""); setSender(c.input.sender ?? "");
      setRequestId(r?.requestId ?? ""); setRecipients((r?.recipients ?? []).join(", ")); setState((r?.state as typeof state) ?? ""); setAmount(r?.requestedAmount ? String(r.requestedAmount) : ""); setExisting((r?.existingValues ?? []).join(", "));
      setExpStatus(c.expectStatus); setExpValue(c.expectValue ?? "");
    } else {
      const full = cases.data?.find((x) => x.id === c.id);
      if (full) return load(full);
      setWorkflow(c.workflow); setBody(c.rawReply); setExpStatus(c.expectedStatus); setExpValue(c.expectedValue ?? "");
    }
    setOut(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function runSuite() {
    suite.mutate(group === "ALL" ? {} : { group }, { onError: (e) => toast(errorMessage(e), "error") });
  }
  const rows = useMemo(() => (suite.data?.rows ?? []).filter((r) => !onlyFailed || !r.pass), [suite.data, onlyFailed]);
  const res = out?.result;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-navy"><FlaskConical className="size-5 text-royal" aria-hidden /> Email reply test lab</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-success" aria-hidden /> Test only: nothing here reads the mailbox, sends a mail or changes a vendor, project or request.</p>
        {rules.data && <p className="mt-1 text-xs text-muted-foreground" data-testid="lab-rules">Rules in force: vendor ID {rules.data.vendorMinDigits}+ digits in a row · project code {rules.data.projectMinDigits}+ digits in a row, or EST-{rules.data.estDigits} digits{rules.data.extraProjectPatterns.length ? ` · ${rules.data.extraProjectPatterns.length} extra pattern(s)` : ""}</p>}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-soft" aria-label="Test one reply">
          <h2 className="text-sm font-semibold text-navy">Test one reply</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Workflow" htmlFor="lab-workflow">
              <Select id="lab-workflow" value={workflow} onChange={(e) => { setWorkflow(e.target.value as LabWorkflow); setOut(null); }}>
                {WORKFLOWS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
              </Select>
            </Field>
            <Field label="Sender" htmlFor="lab-sender"><Input id="lab-sender" value={sender} maxLength={200} onChange={(e) => setSender(e.target.value)} placeholder="accounts@adinn.co.in" /></Field>
          </div>
          <Field label="Subject" htmlFor="lab-subject"><Input id="lab-subject" value={subject} maxLength={500} onChange={(e) => setSubject(e.target.value)} placeholder="Re: Vendor Registration Request - Adn-Signage-VenReg-13112601" /></Field>
          <Field label="Email reply (sample)" htmlFor="lab-body" hint="Paste the whole reply, with quoted history and signature if you want to see them removed.">
            <Textarea id="lab-body" className="min-h-40 font-mono text-xs" value={body} maxLength={50000} onChange={(e) => setBody(e.target.value)} placeholder={EXAMPLE[workflow]} />
          </Field>
          <details className="rounded-lg border border-border p-3" open={withContext}>
            <summary className="cursor-pointer text-sm font-medium text-navy">Original request (optional): checks the request ID, sender and state</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Request reference" htmlFor="lab-req"><Input id="lab-req" value={requestId} maxLength={60} onChange={(e) => setRequestId(e.target.value)} placeholder="Adn-Signage-VenReg-13112601" /></Field>
              <Field label="Request sent to" htmlFor="lab-rcpt" hint="Comma separated"><Input id="lab-rcpt" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="accounts@adinn.co.in" /></Field>
              {workflow === "RATE_APPROVAL" && (
                <>
                  <Field label="Request state" htmlFor="lab-state"><Select id="lab-state" value={state} onChange={(e) => setState(e.target.value as typeof state)}><option value="">Not given</option><option value="PENDING">Waiting for approval</option><option value="APPROVED">Already approved</option><option value="NOT_APPROVED">Already not approved</option></Select></Field>
                  <Field label="Requested amount (₹)" htmlFor="lab-amt"><Input id="lab-amt" inputMode="decimal" value={amount} maxLength={12} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="18500" /></Field>
                </>
              )}
              {workflow !== "RATE_APPROVAL" && <Field label="Already used values" htmlFor="lab-exist" hint="Comma separated: a duplicate goes to review"><Input id="lab-exist" value={existing} onChange={(e) => setExisting(e.target.value)} placeholder="78954" /></Field>}
            </div>
          </details>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Expected status" htmlFor="lab-exp-status"><Select id="lab-exp-status" value={expStatus} onChange={(e) => setExpStatus(e.target.value)}><option value="">No expectation</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</Select></Field>
            <Field label="Expected value" htmlFor="lab-exp-val"><Input id="lab-exp-val" value={expValue} maxLength={60} onChange={(e) => setExpValue(e.target.value)} placeholder="12345 (empty = nothing saved)" /></Field>
          </div>
          <Button onClick={run} disabled={analyze.isPending} data-testid="lab-run"><Play className="size-4" aria-hidden /> {analyze.isPending ? "Running..." : "Run test"}</Button>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-soft" aria-label="Result" aria-live="polite" data-testid="lab-result">
          <h2 className="text-sm font-semibold text-navy">Result</h2>
          {!res && <p className="py-10 text-center text-sm text-muted-foreground">Run a test to see what would be read from the reply.</p>}
          {res && out && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge s={res.status} />
                {out.pass !== null && (out.pass ? <Badge tone="success" data-testid="lab-pass"><CheckCircle2 className="mr-1 inline size-3.5" aria-hidden />PASS</Badge> : <Badge tone="danger" data-testid="lab-fail"><XCircle className="mr-1 inline size-3.5" aria-hidden />FAIL</Badge>)}
                <span className="text-xs text-muted-foreground">Confidence {Math.round(res.confidence * 100)}%</span>
              </div>
              {out.pass === false && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{out.failureReason}</p>}
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Extracted result</dt><dd className="font-mono font-semibold text-navy" data-testid="lab-value">{res.value ?? "nothing saved"}</dd>
                <dt className="text-muted-foreground">Raw candidate</dt><dd className="font-mono" data-testid="lab-raw">{res.raw ?? "-"}</dd>
                <dt className="text-muted-foreground">Normalized</dt><dd className="font-mono" data-testid="lab-normalized">{res.normalized ?? "-"}</dd>
                <dt className="text-muted-foreground">Why</dt><dd data-testid="lab-reason">{res.reason}</dd>
                {res.candidates.length > 0 && (<><dt className="text-muted-foreground">Candidates</dt><dd className="font-mono">{res.candidates.join(", ")}</dd></>)}
                {res.amounts.length > 0 && (<><dt className="text-muted-foreground">Amounts read</dt><dd className="font-mono">{res.amounts.join(", ")}</dd></>)}
                {res.flags.length > 0 && (<><dt className="text-muted-foreground">Flags</dt><dd className="flex flex-wrap gap-1">{res.flags.map((f) => <Badge key={f} tone="warning">{f}</Badge>)}</dd></>)}
              </dl>
              <div className="rounded-lg border border-border p-3 text-sm" data-testid="lab-match">
                <p className="mb-1 font-semibold text-navy">Matching request</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li>Request IDs in the mail: {res.match.requestIdsFound.length ? res.match.requestIdsFound.join(", ") : "none"}</li>
                  <li>Request matched: {res.match.requestMatched === null ? "not checked" : res.match.requestMatched ? "yes" : "NO"}</li>
                  <li>Sender allowed: {res.match.senderAuthorized === null ? "not checked" : res.match.senderAuthorized ? "yes" : "NO"}</li>
                  <li>Request state: {res.match.state ?? "not given"}</li>
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Raw reply</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs" data-testid="lab-raw-text">{body || "(empty)"}</pre></div>
                <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Cleaned (only the new reply is read)</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs" data-testid="lab-clean-text">{res.cleanedText || "(empty)"}</pre></div>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-soft" aria-label="Batch tests">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48"><Field label="Batch" htmlFor="lab-group"><Select id="lab-group" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>{GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}{cases.data ? ` (${g.key === "ALL" ? cases.data.length : cases.data.filter((c) => c.group === g.key).length})` : ""}</option>)}</Select></Field></div>
          <Button onClick={runSuite} disabled={suite.isPending} data-testid="lab-run-all"><Play className="size-4" aria-hidden /> {suite.isPending ? "Running..." : "Run batch"}</Button>
          {suite.data && <Button variant="outline" onClick={() => download(`reply-test-report-${new Date().toISOString().slice(0, 10)}.csv`, csv(suite.data!.rows))} data-testid="lab-export"><Download className="size-4" aria-hidden /> Export report (CSV)</Button>}
          {suite.data && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Failed only</label>}
        </div>
        {cases.isError && <ErrorState error={cases.error} title="Could not load the test cases" />}
        {suite.isError && <ErrorState error={suite.error} title="The batch could not run" />}
        {suite.data && (
          <>
            <p className="text-sm" data-testid="lab-summary"><span className="font-semibold text-navy">{suite.data.total}</span> run · <span className="font-semibold text-success">{suite.data.passed} passed</span> · <span className={suite.data.failed ? "font-semibold text-danger" : "text-muted-foreground"}>{suite.data.failed} failed</span></p>
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[56rem] text-left text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground"><tr>{["Test", "Workflow", "Raw reply", "Expected", "Actual", "Result", ""].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`border-t border-border align-top ${r.pass ? "" : "bg-danger-soft/40"}`} data-testid={`lab-row-${r.id}`}>
                      <td className="px-2 py-1.5 font-mono font-semibold text-navy">{r.id}<span className="block max-w-48 truncate font-sans font-normal text-muted-foreground" title={r.title}>{r.title}</span></td>
                      <td className="px-2 py-1.5">{r.workflow.replace(/_/g, " ")}</td>
                      <td className="px-2 py-1.5"><button type="button" className="max-w-56 truncate text-left font-mono hover:underline" title="Show the whole reply" onClick={() => setOpen(open === r.id ? null : r.id)}>{r.rawReply.replace(/\s+/g, " ").slice(0, 60) || "(empty)"}</button>{open === r.id && <pre className="mt-1 max-w-xs whitespace-pre-wrap rounded bg-muted p-1.5">{r.rawReply}</pre>}</td>
                      <td className="px-2 py-1.5"><StatusBadge s={r.expectedStatus} /><span className="mt-0.5 block font-mono">{r.expectedValue ?? "-"}</span></td>
                      <td className="px-2 py-1.5"><StatusBadge s={r.actualStatus} /><span className="mt-0.5 block font-mono">{r.actualValue ?? "-"}</span></td>
                      <td className="px-2 py-1.5">{r.pass ? <Badge tone="success">PASS</Badge> : <><Badge tone="danger">FAIL</Badge><span className="mt-0.5 block max-w-64 text-danger">{r.failureReason}</span></>}</td>
                      <td className="px-2 py-1.5"><Button size="sm" variant="outline" onClick={() => load(r)}>Open</Button></td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No rows to show.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!suite.data && !suite.isPending && <p className="py-6 text-center text-sm text-muted-foreground">Run the batch to see every stored case with expected and actual results.</p>}
      </section>
    </div>
  );
}
