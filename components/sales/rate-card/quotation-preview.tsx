"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, printFile, type FileSource } from "@/lib/api/files";
import { rateCardFileName, rateText, termsList, type CompanyInfo, type QuotationValues, type Revision } from "@/lib/api/ratecards";
import { cn } from "@/lib/utils";

/* Same A4 geometry, fonts and colours (points) as the generated PDF (backend ratecards/quotation.pdf.ts). */
const W = 595;
const H = 842;
const M = 34;
const CONTENT_W = 530;
const BOTTOM = 784;
const COL_W = [37, 179, 243, 71];
const FONT = '"Manrope", "DejaVu Sans", Verdana, Geneva, sans-serif';
const INK = "#0F172A";
const SLATE = "#334155";
const LABEL = "#475569";
const MUTED = "#64748B";
const LINE = "#E5E7EB";
const RED = "#C62828";
const ZEBRA = "#FAFAF9";
const CARD_GAP = 13;
const HALF_W = (CONTENT_W - CARD_GAP) / 2;
const QUOTE_ROW = 18.8;
const HEAD_H = 26;
const TERMS_STRIP = 50;
/** Line height of Manrope at `size` with `gap` between lines (as PDFKit lays text out). */
const lh = (size: number, gap: number) => size * 1.366 + gap;
/** Table cells: S.NO, PARTICULARS (bold), SPECIFICATION (slate), RATE, with characters per line for the estimate. */
const CELLS = [
  { size: 8.5, weight: 600, color: INK, cap: 5 },
  { size: 9, weight: 700, color: INK, cap: 35 },
  { size: 8.25, weight: 500, color: SLATE, cap: 57 },
  { size: 8.5, weight: 600, color: INK, cap: 13 },
];

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
const cellTexts = (it: Item, i: number) => [String(i + 1), it.particulars || "-", it.specifications || "-", rateText(it.quotedRate || 0, it.unit)];
// Rows as in the PDF: 11pt padding above and below the tallest cell, at least 32pt.
const rowHeight = (it: Item, i: number) => Math.max(32, Math.max(...cellTexts(it, i).map((c, j) => lines(c, CELLS[j]!.cap) * lh(CELLS[j]!.size, 2))) + 22);
// Terms rows as in the PDF: 9pt above / below the text, 13.9pt lines (8pt text + 3pt gap), at least 32pt.
const termHeight = (t: string) => Math.max(32, lines(t, 116) * lh(8, 3) + 18);
/** Bill To / Quote & Contact card height as the PDF sizes it (a long name or address makes it taller). */
function billCardHeight(clientName: string, address?: string, attn?: string) {
  const textLines = (s: string, cap: number) => s.split(/\n/).reduce((n, l) => n + lines(l, cap), 0);
  const addr = address?.trim();
  const bill = 23.5 + textLines(clientName, 42) * lh(11, 1.5) + (addr ? 3 + textLines(addr, 54) * lh(9, 1.5) : 0) + (attn ? 3 + lh(9, 1.5) : 0) + 12;
  return Math.max(141, bill, 34 + 4 * QUOTE_ROW + 32);
}

/**
 * Splits the rate card into A4 pages the same way the PDF flows: table rows, then the terms card (continued if long).
 * `cardH`: height of the Bill To / Quote & Contact cards on the first page.
 */
function paginate(items: Item[], terms: string[], cardH: number): PageSpec[] {
  const pages: PageSpec[] = [{ first: true, start: 0, items: [], terms: null }];
  let y = 120 + cardH + 12 + HEAD_H; // first-page table body starts below the Bill To / Quote cards (no subject bar)
  items.forEach((it, i) => {
    const h = rowHeight(it, i);
    if (y + h > BOTTOM && pages[pages.length - 1]!.items.length) {
      pages.push({ first: false, start: i, items: [], terms: null });
      y = 122 + HEAD_H;
    }
    pages[pages.length - 1]!.items.push(it);
    y += h;
  });
  y += 14;
  let k = 0;
  while (k < terms.length) {
    if (y + TERMS_STRIP + 14 + termHeight(terms[k]!) + 17 > BOTTOM) {
      pages.push({ first: false, start: items.length, items: [], terms: null });
      y = 126;
    }
    let fit = k;
    let h = TERMS_STRIP + 14;
    while (fit < terms.length && y + h + termHeight(terms[fit]!) + 17 <= BOTTOM) h += termHeight(terms[fit++]!) + 8;
    if (fit === k) h += termHeight(terms[fit++]!) + 8; // a single very long term still goes somewhere
    pages[pages.length - 1]!.terms = { from: k, to: fit };
    y += h + 9 + 14;
    k = fit;
  }
  return pages;
}

const dateText = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const phoneText = (p?: string) => (p && /^\d{10}$/.test(p) ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : (p ?? ""));

/** Small red tracked heading of the Bill To / Quote & Contact cards. */
function Marker({ title }: { title: string }) {
  return (
    <div className="text-[7px] font-bold tracking-[1.3px]" style={{ color: RED, lineHeight: `${lh(7, 0)}px` }}>
      {title}
    </div>
  );
}

function Page({ v, spec, n, total, clientName, company, terms, cardH }: { v: QuotationValues; spec: PageSpec; n: number; total: number; clientName: string; company: CompanyInfo; terms: string[]; cardH: number }) {
  const last = n === total;
  const quoteRows = [
    ["DATE", dateText(v.quotationDate)],
    ["CLIENT SERVICE", v.regards?.name || "-"],
    ["EMAIL ID", v.regards?.email || "-"],
    ["PHONE NUMBER", phoneText(v.regards?.mobile) || "-"],
    ["WEBSITE", company.website],
  ];
  return (
    <div className="relative bg-white" style={{ width: W, height: H, fontFamily: FONT, color: INK }}>
      {/* header card (every page) */}
      <div className="absolute overflow-hidden rounded-[12px] border bg-white" style={{ left: M, top: 29, width: CONTENT_W, height: 79, borderColor: LINE }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, scaled inside a scaled A4 page */}
        <img src="/AdinnLogo.svg" alt="ADINN" className="absolute top-1/2 -translate-y-1/2" style={{ left: 18, width: 107 }} />
        <span className="absolute border-l" style={{ left: 175 - M, top: 13, height: 53, borderColor: LINE }} />
        <div className="absolute whitespace-nowrap" style={{ left: 196 - M, top: 0 }}>
          <p className="absolute text-[13.25px] font-bold" style={{ top: 9, lineHeight: `${lh(13.25, 1.5)}px` }}>
            {company.name}
          </p>
          <p className="absolute text-[9px] font-bold" style={{ top: 27.5, lineHeight: `${lh(9, 1.5)}px` }}>
            GSTIN: {company.gstin}
          </p>
          {company.address.map((l, i) => (
            <p key={l} className="absolute text-[9.25px] font-semibold" style={{ top: 41 + i * 12.5, color: SLATE, lineHeight: `${lh(9.25, 1.5)}px` }}>
              {l}
            </p>
          ))}
        </div>
      </div>

      <div className="absolute" style={{ left: M, top: spec.first ? 120 : 122, width: CONTENT_W }}>
        {spec.first && (
          <div className="flex" style={{ gap: CARD_GAP }}>
            <div className="rounded-[12px] border px-[15px] pt-[10.5px]" style={{ width: HALF_W, height: cardH, borderColor: LINE }}>
              <Marker title="BILL TO" />
              <p className="break-words text-[11px] font-bold" style={{ marginTop: 23.5 - 10.5 - lh(7, 0), lineHeight: `${lh(11, 1.5)}px` }}>
                {clientName}
              </p>
              {v.clientAddress && (
                <p className="mt-[3px] whitespace-pre-line break-words text-[9px] font-medium" style={{ color: SLATE, lineHeight: `${lh(9, 1.5)}px` }}>
                  {v.clientAddress}
                </p>
              )}
              {v.contact?.name && (
                <p className="mt-[3px] text-[9px] font-medium" style={{ color: SLATE, lineHeight: `${lh(9, 1.5)}px` }}>
                  Kind Attn : {v.contact.name}
                </p>
              )}
            </div>
            <div className="relative rounded-[12px] border px-[15px] pt-[10.5px]" style={{ width: HALF_W, height: cardH, borderColor: LINE }}>
              <Marker title="QUOTE & CONTACT" />
              {/* label left, value right, a thin line between rows */}
              {quoteRows.map(([k, val], i) => (
                <div
                  key={k}
                  className={cn("absolute flex items-center", i < quoteRows.length - 1 && "border-b")}
                  style={{ left: 15, right: 15, top: 34 + i * QUOTE_ROW - QUOTE_ROW / 2, height: QUOTE_ROW, borderColor: LINE }}
                >
                  <span className="w-[80px] shrink-0 text-[7px] font-semibold tracking-[1px]" style={{ color: LABEL }}>
                    {k}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right text-[8.75px] font-bold">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(spec.items.length > 0 || (spec.first && !v.items?.length)) && (
          <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: LINE, marginTop: spec.first ? 12 : 0 }}>
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                {COL_W.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-left text-[7px] font-bold tracking-[0.8px]" style={{ height: HEAD_H, background: "#F3F4F6", color: LABEL }}>
                  {["S.NO", "PARTICULARS", "SPECIFICATION", "RATE / SQFT"].map((h, j) => (
                    <th key={h} className={cn("whitespace-nowrap px-[11px] font-bold", j === 3 && "pr-0")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {spec.items.length === 0 && (
                  <tr className="border-t" style={{ borderColor: LINE }}>
                    <td colSpan={4} className="py-4 text-center text-[8px]" style={{ color: MUTED }}>
                      No signage items yet
                    </td>
                  </tr>
                )}
                {spec.items.map((it, i) => {
                  const idx = spec.start + i;
                  return (
                    <tr key={idx} className="border-t" style={{ height: rowHeight(it, idx), borderColor: LINE, background: idx % 2 === 1 ? ZEBRA : undefined }}>
                      {cellTexts(it, idx).map((c, j) => {
                        const cell = CELLS[j]!;
                        return (
                          <td
                            key={j}
                            className={cn("break-words px-[11px] py-[11px] align-top", j === 3 && "pr-[4px]")}
                            style={{ fontSize: cell.size, fontWeight: cell.weight, color: cell.color, lineHeight: `${lh(cell.size, 2)}px` }}
                          >
                            {c}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {spec.terms && (
          <div className="overflow-hidden rounded-[12px] border pb-[17px]" style={{ borderColor: LINE, marginTop: spec.items.length || spec.first ? 14 : 4 }}>
            <div className="flex items-center justify-between border-b px-[18px]" style={{ height: TERMS_STRIP, background: "#F8F9FA", borderColor: LINE }}>
              <span className="text-[11.25px] font-semibold">{spec.terms.from === 0 ? "Terms & Conditions" : "Terms & Conditions (continued)"}</span>
              <span className="flex h-[19px] items-center rounded-full border px-[10px] text-[7.5px] font-semibold" style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C" }}>
                Subject To Availability
              </span>
            </div>
            <ol className="mx-[18px] mt-[14px] space-y-[8px]">
              {terms.slice(spec.terms.from, spec.terms.to).map((t, i) => (
                <li key={i} className="flex items-center gap-[10px] rounded-[6px] border px-[10px] text-[8px]" style={{ height: termHeight(t), background: ZEBRA, borderColor: "#ECECEC" }}>
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-[4px] text-[7px] font-bold text-white" style={{ background: INK }}>
                    {String(spec.terms!.from + i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ lineHeight: `${lh(8, 3)}px` }}>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* footer: thank-you note on the last page, page number centred on every page */}
      {last && (
        <div className="absolute border-t pt-[6px]" style={{ left: M, top: 792, width: CONTENT_W, borderColor: LINE }}>
          <p className="text-[8.25px] font-bold" style={{ lineHeight: `${lh(8.25, 1.2)}px` }}>
            Thank You For Choosing {company.name}.
          </p>
          <p className="text-[7.5px]" style={{ color: MUTED, lineHeight: `${lh(7.5, 0)}px` }}>
            This Is A System-Generated Quotation And Does Not Require A Digital Signature.
          </p>
        </div>
      )}
      <span className="absolute text-center text-[7.5px] font-semibold tracking-[1px]" style={{ left: M, top: 826, width: CONTENT_W, color: "#94A3B8" }}>
        PAGE {n} OF {total}
      </span>
    </div>
  );
}

/**
 * Live preview of the rate card from the current editor values, with page thumbnails, zoom and saved-PDF actions.
 * `fitWidth` (Client Servicing Rate Card step): every page one below the other at the panel's full width, with no
 * thumbnails, page or zoom controls (Download and Print only).
 */
export function QuotationPreview({
  orderId,
  source,
  values,
  clientName,
  company,
  latest,
  dirty,
  fitWidth = false,
}: {
  orderId: string;
  /** Where the saved PDFs are read from (default: the order). */
  source?: FileSource;
  values: QuotationValues;
  /** Kept for callers; the download name is the company and today's date (rateCardFileName). */
  quotationRef?: string;
  clientName: string;
  company: CompanyInfo;
  latest: Revision | null;
  dirty: boolean;
  fitWidth?: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  // Fit width: the page area's inner width / the A4 width, kept current as the panel resizes.
  const [areaW, setAreaW] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = areaRef.current;
    if (!fitWidth || !el) return;
    const ro = new ResizeObserver(([e]) => setAreaW(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitWidth]);
  const scale = fitWidth && areaW ? Math.max(0.3, areaW / W) : zoom;
  const terms = useMemo(() => termsList(values.terms), [values.terms]);
  // Bill To / Quote & Contact card height as in the PDF (taller for a long name or address).
  const cardH = billCardHeight(clientName, values.clientAddress, values.contact?.name ? `Kind Attn : ${values.contact.name}` : undefined);
  const pages = useMemo(() => paginate(values.items ?? [], terms, cardH), [values.items, terms, cardH]);
  const current = Math.min(page, pages.length - 1);
  const label = dirty || !latest ? `${latest ? latest.label + " + unsaved" : "Draft"}` : latest.label;
  const pdfId = latest?.pdf?.fileId;
  const src = source ?? { orderId };
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(errorMessage(e), "error"));
  const pageProps = { v: values, total: pages.length, clientName, company, terms, cardH };

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
        {!fitWidth && (
          <>
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
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" disabled={!pdfId} title={dirty ? "Downloads the last saved revision" : undefined} onClick={() => pdfId && run(() => downloadFile(pdfId, src, rateCardFileName(clientName), rateCardFileName(clientName)))}>
            <Download className="size-4" aria-hidden /> Download
          </Button>
          <Button variant="outline" size="sm" disabled={!pdfId} title={dirty ? "Prints the last saved revision" : undefined} onClick={() => pdfId && run(() => printFile(pdfId, src))}>
            <Printer className="size-4" aria-hidden /> Print
          </Button>
        </div>
      </div>
      {dirty && latest && <p className="border-b border-border bg-warning-soft px-4 py-1.5 text-xs text-warning">Unsaved changes. Download and Print use saved revision {latest.label}; save to generate a new PDF.</p>}
      <div className="flex min-h-0 flex-1">
        <div className={cn("hidden w-24 shrink-0 space-y-3 overflow-y-auto border-r border-border bg-muted/50 p-2.5", !fitWidth && "sm:block")} aria-label="Page thumbnails">
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
        {/* Stable gutter: the scrollbar does not change the fitted width (and so the page height) back and forth. */}
        <div ref={areaRef} className={cn("min-w-0 flex-1 overflow-auto bg-[#e9edf4]", fitWidth ? "p-3 [scrollbar-gutter:stable]" : "p-4")}>
          {(fitWidth ? pages.map((p, i) => ({ p, i })) : [{ p: pages[current]!, i: current }]).map(({ p, i }) => (
            <div key={i} className="mx-auto mb-3 overflow-hidden shadow-card last:mb-0" style={{ width: W * scale, height: H * scale }}>
              <div className="origin-top-left" style={{ transform: `scale(${scale})`, width: W, height: H }}>
                <Page {...pageProps} spec={p} n={i + 1} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
