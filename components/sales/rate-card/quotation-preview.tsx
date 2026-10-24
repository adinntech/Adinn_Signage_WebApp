"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, printFile } from "@/lib/api/files";
import { rateText, termsList, type CompanyInfo, type QuotationValues, type Revision } from "@/lib/api/ratecards";
import { cn } from "@/lib/utils";

/* Same A4 geometry (points) as the generated PDF (backend ratecards/quotation.pdf.ts). */
const W = 595;
const H = 842;
const M = 34;
const CONTENT_W = 530;
const BOTTOM = 795;
const COL_W = [37, 179, 243, 71];
const FONT = '"DejaVu Sans", Verdana, Geneva, sans-serif';
const DARK = "#1E2235";
const MUTED = "#5B6475";
const LINE = "#E4E7EC";
const RED = "#E3000F";

type Item = QuotationValues["items"][number];
interface PageSpec {
  first: boolean;
  start: number;
  items: Item[];
  terms: { from: number; to: number } | null;
}

/** Line count of `text` wrapped at `cap` characters per line (word wrap estimate for pagination). */
function lines(text: string, cap: number) {
  let n = 1;
  let len = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (len === 0) len = w.length;
    else if (len + 1 + w.length <= cap) len += 1 + w.length;
    else {
      n += 1;
      len = w.length;
    }
  }
  return n;
}
const rowHeight = (it: Item, i: number) =>
  Math.max(30, Math.max(lines(String(i + 1), 5), lines(it.particulars || "-", 34), lines(it.specifications || "-", 48), lines(rateText(it.quotedRate || 0, it.unit), 12)) * 10.8 + 16);
const termHeight = (t: string) => Math.max(18, lines(t, 108) * 10.2 + 8);

/** Splits the rate card into A4 pages the same way the PDF flows: table rows, then the terms card (continued if long). */
function paginate(items: Item[], terms: string[]): PageSpec[] {
  const pages: PageSpec[] = [{ first: true, start: 0, items: [], terms: null }];
  let y = 315; // first-page table body starts below the Bill To / Quote cards and the subject bar
  items.forEach((it, i) => {
    const h = rowHeight(it, i);
    if (y + h > BOTTOM && pages[pages.length - 1]!.items.length) {
      pages.push({ first: false, start: i, items: [], terms: null });
      y = 145;
    }
    pages[pages.length - 1]!.items.push(it);
    y += h;
  });
  y += 19;
  let k = 0;
  while (k < terms.length) {
    if (y + 44 + termHeight(terms[k]!) + 10 > BOTTOM) {
      pages.push({ first: false, start: items.length, items: [], terms: null });
      y = 126;
    }
    let fit = k;
    let h = 44;
    while (fit < terms.length && y + h + termHeight(terms[fit]!) + 10 <= BOTTOM) h += termHeight(terms[fit++]!) + 5;
    if (fit === k) fit = k + 1; // a single very long term still goes somewhere
    pages[pages.length - 1]!.terms = { from: k, to: fit };
    y += h + 15;
    k = fit;
  }
  return pages;
}

const dateText = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const phoneText = (p?: string) => (p && /^\d{10}$/.test(p) ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : (p ?? ""));

function Marker({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-[9px]">
      <span className="h-[15px] w-[4px] rounded-sm" style={{ background: RED }} />
      <span className="text-[9.5px] font-bold">{title}</span>
    </div>
  );
}

function Page({ v, spec, n, total, clientName, company, terms }: { v: QuotationValues; spec: PageSpec; n: number; total: number; clientName: string; company: CompanyInfo; terms: string[] }) {
  const last = n === total;
  return (
    <div className="relative bg-white" style={{ width: W, height: H, fontFamily: FONT, color: DARK }}>
      {/* header card (every page) */}
      <div className="absolute flex items-center overflow-hidden rounded-[10px] border bg-white" style={{ left: M, top: 29, width: CONTENT_W, height: 79, borderColor: LINE }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, scaled inside a scaled A4 page */}
        <img src="/AdinnLogo.svg" alt="ADINN" style={{ width: 120, marginLeft: 20 }} />
        <span className="ml-[17px] self-stretch border-l" style={{ borderColor: LINE, margin: "14px 0 14px 17px" }} />
        <div className="ml-[16px] leading-tight">
          <p className="text-[13.5px] font-bold">{company.name}</p>
          <p className="mt-[3px] text-[8.5px] font-bold">GSTIN: {company.gstin}</p>
          <div className="mt-[4px] text-[8px] leading-[11px]" style={{ color: MUTED }}>
            {company.address.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute" style={{ left: M, top: spec.first ? 118 : 122, width: CONTENT_W }}>
        {spec.first && (
          <>
            <div className="flex gap-[12px]">
              <div className="min-h-[132px] w-[260px] rounded-[10px] border px-[13px] pt-[11px]" style={{ borderColor: LINE }}>
                <Marker title="BILL TO" />
                <div className="mt-[4px] border-b" style={{ borderColor: LINE }} />
                <p className="mt-[9px] break-words text-[10.5px] font-bold">{clientName}</p>
                {v.clientAddress && (
                  <p className="mt-[4px] break-words text-[8.5px]" style={{ color: MUTED }}>
                    {v.clientAddress}
                  </p>
                )}
                {v.contact?.name && (
                  <p className="mt-[4px] text-[8.5px]" style={{ color: MUTED }}>
                    Kind Attn : {v.contact.name}
                  </p>
                )}
              </div>
              <div className="min-h-[132px] flex-1 rounded-[10px] border px-[13px] pt-[11px]" style={{ borderColor: LINE }}>
                <Marker title="QUOTE & CONTACT" />
                <dl className="mt-[9px] grid grid-cols-[77px_9px_1fr] gap-y-[5.5px] pl-[4px] text-[8px]">
                  {[
                    ["DATE", dateText(v.quotationDate)],
                    ["BUSINESS ANALYST", v.regards?.name || "-"],
                    ["EMAIL ID", v.regards?.email || "-"],
                    ["PHONE NUMBER", phoneText(v.regards?.mobile) || "-"],
                    ["WEBSITE", company.website],
                  ].map(([k, val]) => (
                    <div key={k} className="contents">
                      <dt className="text-[7.5px]" style={{ color: MUTED }}>
                        {k}
                      </dt>
                      <span style={{ color: MUTED }}>:</span>
                      <dd className="break-words">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="mt-[8px] flex h-[26px] items-center rounded-[6px] border" style={{ background: "#FDF0F0", borderColor: "#F4CFCF" }}>
              <span className="w-[90px] pl-[22px] text-[9px] font-bold" style={{ color: RED }}>
                SUBJECT
              </span>
              <span className="h-[16px] w-[1.2px]" style={{ background: RED }} />
              <span className="ml-[12px] truncate text-[9.5px] font-bold">{v.subject || "-"}</span>
            </div>
          </>
        )}

        {(spec.items.length > 0 || (spec.first && !v.items?.length)) && (
          <table className="w-full border-collapse text-[8px]" style={{ marginTop: spec.first ? 8 : 0, tableLayout: "fixed" }}>
            <colgroup>
              {COL_W.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr className="h-[23px] text-left text-[7.5px] font-bold" style={{ background: "#EEF0F3" }}>
                {["S.NO", "PARTICULARS", "SPECIFICATION", "RATE / SQFT"].map((h, j) => (
                  <th key={h} className={cn("whitespace-nowrap px-[11px] font-bold", j === 3 && "pr-0")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center" style={{ color: MUTED }}>
                    No signage items yet
                  </td>
                </tr>
              )}
              {spec.items.map((it, i) => {
                const idx = spec.start + i;
                return (
                  <tr key={idx} className="h-[30px] border-b" style={{ borderColor: LINE, background: idx % 2 === 1 ? "#FAFAFB" : undefined }}>
                    {[String(idx + 1), it.particulars || "-", it.specifications || "-", rateText(it.quotedRate || 0, it.unit)].map((c, j) => (
                      <td key={j} className={cn("break-words px-[11px] py-[7px] leading-[10.8px]", j > 0 && "border-l", j === 3 && "pr-[4px]")} style={{ borderColor: LINE }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {spec.terms && (
          <div className="rounded-[10px] border px-[11px] pb-[10px]" style={{ borderColor: LINE, marginTop: spec.items.length || spec.first ? 19 : 4 }}>
            <div className="flex h-[35px] items-center justify-between border-b px-[4px]" style={{ borderColor: LINE }}>
              <span className="text-[11px] font-bold">{spec.terms.from === 0 ? "Terms & Conditions" : "Terms & Conditions (continued)"}</span>
              <span className="rounded-full border px-[9px] py-[3px] text-[7.5px] font-bold" style={{ color: RED, background: "#FDF0F0", borderColor: "#F4CFCF" }}>
                Subject To Availability
              </span>
            </div>
            <ol className="mt-[9px] space-y-[5px]">
              {terms.slice(spec.terms.from, spec.terms.to).map((t, i) => (
                <li key={i} className="flex min-h-[18px] items-center gap-[10px] rounded-[4px] border px-[8px] py-[3px] text-[7.5px]" style={{ background: "#F7F7F8", borderColor: "#ECEDEF" }}>
                  <span className="flex h-[11px] w-[23px] shrink-0 items-center justify-center rounded-[3px] text-[6.5px] font-bold text-white" style={{ background: "#1F2433" }}>
                    {String(spec.terms!.from + i + 1).padStart(2, "0")}
                  </span>
                  <span className="leading-[10px]">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* footer (every page) */}
      <div className="absolute flex items-end justify-between border-t pt-[6px]" style={{ left: M, top: 810, width: CONTENT_W, borderColor: LINE }}>
        {last ? (
          <div className="leading-tight">
            <p className="text-[8px] font-bold">Thank You For Choosing {company.name}.</p>
            <p className="mt-[2px] text-[7px]" style={{ color: MUTED }}>
              This Is A System-Generated Quotation And Does Not Require A Digital Signature.
            </p>
          </div>
        ) : (
          <span className="text-[8px]" style={{ color: MUTED }}>
            {company.website}
          </span>
        )}
        <span className="text-[7.5px] tracking-[1.5px]" style={{ color: MUTED }}>
          PAGE {n} OF {total}
        </span>
      </div>
    </div>
  );
}

/** Live preview of the rate card from the current editor values, with page thumbnails, zoom and saved-PDF actions. */
export function QuotationPreview({
  orderId,
  values,
  quotationRef,
  clientName,
  company,
  latest,
  dirty,
}: {
  orderId: string;
  values: QuotationValues;
  quotationRef: string;
  clientName: string;
  company: CompanyInfo;
  latest: Revision | null;
  dirty: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const terms = useMemo(() => termsList(values.terms), [values.terms]);
  const pages = useMemo(() => paginate(values.items ?? [], terms), [values.items, terms]);
  const current = Math.min(page, pages.length - 1);
  const label = dirty || !latest ? `${latest ? latest.label + " + unsaved" : "Draft"}` : latest.label;
  const pdfId = latest?.pdf?.fileId;
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(errorMessage(e), "error"));
  const pageProps = { v: values, total: pages.length, clientName, company, terms };

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <FileText className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-primary">Rate Card PDF Preview</h2>
            <p className="text-xs text-muted-foreground">Live preview of the ADINN rate card PDF</p>
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
          <Button variant="outline" size="sm" disabled={!pdfId} title={dirty ? "Downloads the last saved revision" : undefined} onClick={() => pdfId && run(() => downloadFile(pdfId, { orderId }, `${quotationRef.replace(/\//g, "-")}_${latest?.label ?? ""}.pdf`))}>
            <Download className="size-4" aria-hidden /> Download
          </Button>
          <Button variant="outline" size="sm" disabled={!pdfId} title={dirty ? "Prints the last saved revision" : undefined} onClick={() => pdfId && run(() => printFile(pdfId, { orderId }))}>
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
                  <Page {...pageProps} spec={p} n={i + 1} />
                </span>
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-auto bg-[#e9edf4] p-4">
          <div className="mx-auto overflow-hidden shadow-card" style={{ width: W * zoom, height: H * zoom }}>
            <div className="origin-top-left" style={{ transform: `scale(${zoom})`, width: W, height: H }}>
              <Page {...pageProps} spec={pages[current]!} n={current + 1} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
