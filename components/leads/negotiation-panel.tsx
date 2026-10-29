"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, GitCompareArrows, Minus, Scale } from "lucide-react";
import { RateCardStage } from "@/components/sales/rate-card/rate-card-stage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile } from "@/lib/api/files";
import { rateText, useQuotation, type RateUnit, type Revision } from "@/lib/api/ratecards";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";

type Line = Revision["items"][number];
/** Same item across revisions: master item id, else its name (as the backend's change history matches them). */
const keyOf = (l: Line) => (l.masterItem ? `m:${l.masterItem}` : `p:${l.particulars.trim().toLowerCase().replace(/\s+/g, " ")}`);
const pct = (a: number, b: number) => (a ? ((b - a) / a) * 100 : 0);

interface Row {
  key: string;
  particulars: string;
  from?: Line;
  to?: Line;
}

function compare(from: Revision, to: Revision): Row[] {
  const a = new Map(from.items.map((l) => [keyOf(l), l]));
  const b = new Map(to.items.map((l) => [keyOf(l), l]));
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  return keys.map((k) => ({ key: k, particulars: (b.get(k) ?? a.get(k))!.particulars, from: a.get(k), to: b.get(k) }));
}

function Change({ from, to }: { from: number; to: number }) {
  if (from === to) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3.5" aria-hidden /> No change</span>;
  const down = to < from;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", down ? "text-success" : "text-danger")}>
      {down ? <ArrowDownRight className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
      {down ? "−" : "+"}₹{Math.abs(to - from).toLocaleString("en-IN")} ({Math.abs(pct(from, to)).toFixed(1)}%)
    </span>
  );
}

/** Previous vs latest rate card: item by item, so the BD sees at a glance what was negotiated. */
function CompareCard({ orderId, revisions }: { orderId: string; revisions: Revision[] }) {
  const toast = useToast();
  const ordered = [...revisions].sort((x, y) => x.revision - y.revision);
  const lastPrep = [...ordered].reverse().find((r) => r.phase !== "NEGOTIATION") ?? ordered[0]!;
  const [fromId, setFromId] = useState(lastPrep._id);
  const [toId, setToId] = useState(ordered[ordered.length - 1]!._id);
  const from = ordered.find((r) => r._id === fromId) ?? lastPrep;
  const to = ordered.find((r) => r._id === toId) ?? ordered[ordered.length - 1]!;
  const rows = compare(from, to);
  const changed = rows.filter((r) => !r.from || !r.to || r.from.quotedRate !== r.to.quotedRate || (r.from.specifications ?? "") !== (r.to.specifications ?? "") || r.from.unit !== r.to.unit);
  const rounds = ordered.filter((r) => r.phase === "NEGOTIATION").length;
  const pick = (id: string, set: (v: string) => void, label: string) => (
    <div className="w-40">
      <Select aria-label={label} value={id} onChange={(e) => set(e.target.value)}>
        {ordered.map((r) => (
          <option key={r._id} value={r._id}>
            {r.label}
            {r.phase === "NEGOTIATION" ? " · negotiation" : ""}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <GitCompareArrows className="size-4 text-[#e11d48]" aria-hidden /> Compare Rate Card Versions
          </h3>
          <p className="text-xs text-muted-foreground">
            {rounds} negotiation round{rounds === 1 ? "" : "s"} · {changed.length} item{changed.length === 1 ? "" : "s"} changed between {from.label} and {to.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pick(fromId, setFromId, "Compare from")}
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          {pick(toId, setToId, "Compare to")}
          {to.pdf?.fileId && (
            <Button variant="outline" size="sm" onClick={() => downloadFile(to.pdf!.fileId, { orderId }, to.pdf!.name).catch((e) => toast(errorMessage(e), "error"))}>
              <Download className="size-4" aria-hidden /> {to.label} PDF
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Item</th>
              <th className="px-3 py-2.5">Specification</th>
              <th className="px-3 py-2.5">Previous ({from.label})</th>
              <th className="px-3 py-2.5">Updated ({to.label})</th>
              <th className="px-3 py-2.5">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const specChanged = !!r.from && !!r.to && (r.from.specifications ?? "") !== (r.to.specifications ?? "");
              return (
                <motion.tr
                  key={r.key}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className={cn("align-top", !r.from && "bg-[#eff6ff]", !r.to && "bg-danger-soft/60")}
                >
                  <td className="px-3 py-2.5 font-medium">
                    {r.particulars}
                    {!r.from && <Badge tone="info" className="ml-2">Added</Badge>}
                    {!r.to && <Badge tone="danger" className="ml-2">Removed</Badge>}
                  </td>
                  <td className="max-w-64 px-3 py-2.5 text-xs">
                    {specChanged ? (
                      <>
                        <span className="block text-muted-foreground line-through">{r.from!.specifications || "-"}</span>
                        <span className="block font-medium text-foreground">{r.to!.specifications || "-"}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{(r.to ?? r.from)!.specifications || "-"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.from ? `₹${rateText(r.from.quotedRate, r.from.unit as RateUnit)}` : "-"}</td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums">{r.to ? `₹${rateText(r.to.quotedRate, r.to.unit as RateUnit)}` : "-"}</td>
                  <td className="px-3 py-2.5">{r.from && r.to ? <Change from={r.from.quotedRate} to={r.to.quotedRate} /> : <span className="text-xs text-muted-foreground">-</span>}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {from.label} saved {formatDateTimeIST(from.createdAt)} by {from.editedBy?.name ?? "-"} · {to.label} saved {formatDateTimeIST(to.createdAt)} by {to.editedBy?.name ?? "-"}
      </p>
    </Card>
  );
}

/** Negotiation in Progress: what changed so far, then the same rate card editor (each save is a negotiation round). */
export function NegotiationPanel({ orderId }: { orderId: string }) {
  const q = useQuotation(orderId);
  const revisions = q.data?.revisions ?? [];
  return (
    <div className="space-y-5">
      {q.data &&
        (revisions.length >= 1 ? (
          <CompareCard key={revisions[0]!._id} orderId={orderId} revisions={revisions} />
        ) : (
          <EmptyState icon={Scale} title="No rate card saved yet" description="Save the rate card first; every change after that is a negotiation round." />
        ))}
      <RateCardStage orderId={orderId} />
    </div>
  );
}
