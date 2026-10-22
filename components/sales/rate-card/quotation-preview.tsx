"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextView } from "@/components/ui/rich-text-editor";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, printFile } from "@/lib/api/files";
import { RATE_UNITS, type QuotationValues, type Revision } from "@/lib/api/ratecards";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 595; // A4 at 72dpi, same proportions as the generated PDF
const H = 842;
const FIRST_PAGE_ROWS = 8;
const OTHER_PAGE_ROWS = 16;

interface PageSpec {
  items: QuotationValues["items"];
  start: number;
  header: boolean;
  closing: boolean;
}

/** Splits the quotation into A4 pages the same way the PDF flows: header + first rows, then continuation pages, then terms. */
function paginate(items: QuotationValues["items"]): PageSpec[] {
  const pages: PageSpec[] = [{ items: items.slice(0, FIRST_PAGE_ROWS), start: 0, header: true, closing: false }];
  for (let i = FIRST_PAGE_ROWS; i < items.length; i += OTHER_PAGE_ROWS) pages.push({ items: items.slice(i, i + OTHER_PAGE_ROWS), start: i, header: false, closing: false });
  const last = pages[pages.length - 1]!;
  const room = last.header ? FIRST_PAGE_ROWS - last.items.length >= 4 : OTHER_PAGE_ROWS - last.items.length >= 8;
  if (room) last.closing = true;
  else pages.push({ items: [], start: items.length, header: false, closing: true });
  return pages;
}

const money = (n?: number) => (n || n === 0 ? `₹ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "-");

function Page({ v, spec, n, total, quotationRef, clientName, revisionLabel }: { v: QuotationValues; spec: PageSpec; n: number; total: number; quotationRef: string; clientName: string; revisionLabel: string }) {
  return (
    <div className="relative flex flex-col bg-white text-[#102449]" style={{ width: W, height: H, padding: 40, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[#e5322d]" />
      {spec.header ? (
        <>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[28px] font-black leading-none tracking-tight text-[#e5322d]">ADINN</p>
              <p className="mt-1 text-[8px] tracking-[0.4em]">SIGNAGE</p>
            </div>
            <div className="text-right text-[9px] leading-relaxed text-[#5b6b86]">
              <p>Quotation Ref: {quotationRef}</p>
              <p>Date: {v.quotationDate ? formatDate(v.quotationDate) : "-"}</p>
              <p>Revision: {revisionLabel}</p>
            </div>
          </div>
          <h2 className="mt-6 text-[20px] font-bold">Signage Rate Card</h2>
          <p className="text-[10px] text-[#5b6b86]">Quotation for Branding Solutions</p>
          <p className="mt-2 text-[10px]">
            <b>Subject:</b> {v.subject || "-"}
          </p>
          <p className="mt-4 text-[11px] font-bold text-[#e5322d]">Client Details</p>
          <dl className="mt-1 grid grid-cols-[100px_1fr] gap-y-0.5 text-[9px]">
            {[
              ["Client Name", clientName],
              ["Address", v.clientAddress || "-"],
              ["Contact Person", [v.contact?.name, v.contact?.designation].filter(Boolean).join(", ") || "-"],
              ["Contact Number", v.contact?.phone || "-"],
              ["Email", v.contact?.email || "-"],
            ].map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-[#5b6b86]">{k}</dt>
                <dd className="break-words">: {val}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="text-[9px] text-[#5b6b86]">
          {quotationRef} · {clientName} (continued)
        </p>
      )}

      {(spec.items.length > 0 || spec.header) && (
        <table className="mt-4 w-full border-collapse text-[9px]">
          <thead>
            <tr className="bg-[#102449] text-left text-white">
              <th className="w-6 px-1.5 py-1.5">#</th>
              <th className="px-1.5 py-1.5">Signage Particulars</th>
              <th className="px-1.5 py-1.5">Specifications</th>
              <th className="px-1.5 py-1.5">Rate Unit</th>
              <th className="px-1.5 py-1.5 text-right">Rate (INR)</th>
            </tr>
          </thead>
          <tbody>
            {spec.items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-[#5b6b86]">
                  No signage items yet
                </td>
              </tr>
            )}
            {spec.items.map((it, i) => (
              <tr key={i} className={cn("border-b border-[#e1e7f0]", (spec.start + i) % 2 === 1 && "bg-[#f6f8fb]")}>
                <td className="px-1.5 py-1.5">{spec.start + i + 1}</td>
                <td className="px-1.5 py-1.5 font-bold">{it.particulars || "-"}</td>
                <td className="px-1.5 py-1.5">{it.specifications || "-"}</td>
                <td className="px-1.5 py-1.5">{RATE_UNITS[it.unit] ?? it.unit}</td>
                <td className="px-1.5 py-1.5 text-right">{money(it.quotedRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {spec.closing && (
        <>
          {v.terms && v.terms.replace(/<[^>]+>/g, "").trim() && (
            <div className="mt-5">
              <p className="text-[11px] font-bold text-[#e5322d]">Terms &amp; Conditions</p>
              <RichTextView html={v.terms} className="mt-1 text-[9px] leading-snug [&_p]:mb-1" />
            </div>
          )}
          <div className="mt-5 text-[9px]">
            <p className="text-[#5b6b86]">Best Regards,</p>
            <p className="text-[11px] font-bold">{v.regards?.name || "-"}</p>
            <p>{v.regards?.designation}</p>
            <p>{[v.regards?.mobile && `+91 ${v.regards.mobile}`, v.regards?.email].filter(Boolean).join("  |  ")}</p>
          </div>
        </>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-[#e1e7f0] pt-1.5 text-[8px]">
        <span className="italic text-[#e5322d]">Partnering for a Brighter Tomorrow</span>
        <span className="text-[#5b6b86]">
          Page {n} of {total}
        </span>
      </div>
    </div>
  );
}

/** Live preview of the quotation from the current editor values, with page thumbnails, zoom and saved-PDF actions. */
export function QuotationPreview({
  values,
  quotationRef,
  clientName,
  latest,
  dirty,
}: {
  values: QuotationValues;
  quotationRef: string;
  clientName: string;
  latest: Revision | null;
  dirty: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const pages = useMemo(() => paginate(values.items ?? []), [values.items]);
  const current = Math.min(page, pages.length - 1);
  const label = dirty || !latest ? `${latest ? latest.label + " + unsaved" : "Draft"}` : latest.label;
  const pdfId = latest?.pdf?.fileId;
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(errorMessage(e), "error"));

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <FileText className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-primary">Rate Card PDF Preview</h2>
            <p className="text-xs text-muted-foreground">Live preview of what will be sent to the client</p>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", dirty || !latest ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {current + 1} / {pages.length}
        </span>
        <Button variant="ghost" size="icon" aria-label="Next page" disabled={current >= pages.length - 1} onClick={() => setPage(current + 1)}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}>
          <Minus className="size-4" aria-hidden />
        </Button>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}>
          <Plus className="size-4" aria-hidden />
        </Button>
        <div className="ml-auto flex gap-1.5">
          <Button variant="outline" size="sm" disabled={!pdfId} title={dirty ? "Downloads the last saved revision" : undefined} onClick={() => pdfId && run(() => downloadFile(pdfId, `${quotationRef}.pdf`))}>
            <Download className="size-4" aria-hidden /> Download
          </Button>
          <Button variant="outline" size="sm" disabled={!pdfId} title={dirty ? "Prints the last saved revision" : undefined} onClick={() => pdfId && run(() => printFile(pdfId))}>
            <Printer className="size-4" aria-hidden /> Print
          </Button>
        </div>
      </div>
      {dirty && latest && <p className="border-b border-border bg-warning-soft px-4 py-1.5 text-xs text-warning">Unsaved changes. Download and Print use saved revision {latest.label}; save to generate a new PDF.</p>}
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-24 shrink-0 space-y-3 overflow-y-auto border-r border-border bg-muted/50 p-2.5 sm:block" aria-label="Page thumbnails">
          {pages.map((p, i) => (
            <button key={i} type="button" onClick={() => setPage(i)} aria-label={`Page ${i + 1}`} aria-current={i === current} className="block w-full text-center">
              <span className={cn("block overflow-hidden rounded border-2 bg-white shadow-soft", i === current ? "border-brand" : "border-transparent")} style={{ height: H * 0.115 }}>
                <span className="pointer-events-none block origin-top-left" style={{ transform: "scale(0.115)", width: W, height: H }}>
                  <Page v={values} spec={p} n={i + 1} total={pages.length} quotationRef={quotationRef} clientName={clientName} revisionLabel={label} />
                </span>
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-auto bg-[#e9edf4] p-4">
          <div className="mx-auto shadow-card" style={{ width: W * zoom, height: H * zoom }}>
            <div className="origin-top-left" style={{ transform: `scale(${zoom})`, width: W, height: H }}>
              <Page v={values} spec={pages[current]!} n={current + 1} total={pages.length} quotationRef={quotationRef} clientName={clientName} revisionLabel={label} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
