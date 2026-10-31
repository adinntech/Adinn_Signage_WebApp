"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, Columns3, Download, FileSpreadsheet, FileText, History, ImagePlus, Loader2, Pencil, Plus, RotateCcw, Ruler, Store, Trash2, Upload, X, XCircle } from "lucide-react";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api";
import { fileUrl, formData, type FileRef, type FileSource } from "@/lib/api/files";
import { downloadProjectShopExcel, downloadProjectShopPdf, useProjectHandoverShops } from "@/lib/api/recce";
import {
  downloadShopExcel,
  downloadShopPdf,
  downloadShopTemplate,
  MAX_ROW_IMAGES,
  useAddShopImages,
  useAddShopRow,
  useDeleteShopRow,
  useHandoverShops,
  useRemoveShopImage,
  useRemoveShopList,
  useShopHistory,
  useUpdateShopRow,
  useUploadShopList,
  type HandoverShop,
  type HandoverType,
  type ShopImportPreview,
  type ShopColumn,
  type ShopImportResult,
  type ShopListSummary,
  type ShopLog,
  type ShopRowInput,
  type ShopState,
} from "@/lib/api/sales";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";

type Field = Exclude<keyof ShopRowInput, "extra" | "cells">;
const LABELS: Record<Field, string> = {
  shopName: "Shop Name",
  dealerName: "Dealer / Customer Name",
  location: "Location / Area",
  district: "District",
  address1: "Address Line 1",
  address2: "Address Line 2",
  address3: "Address Line 3",
  pincode: "Pincode",
  mobile: "Mobile",
  mobileAlt: "Alternate Mobile",
  gstin: "GST No",
  contactPerson: "Contact Person",
  width: "Width",
  height: "Height",
  unit: "Unit",
  boardType: "Board Type",
  quantity: "Qty",
  remarks: "Remarks",
  clientSiteCode: "Client Site Code",
};
const BASE_FIELDS: Field[] = ["shopName", "dealerName", "location", "district", "address1", "address2", "address3", "pincode", "mobile", "mobileAlt", "gstin", "contactPerson", "boardType", "quantity", "clientSiteCode", "remarks"];
const SIZE_FIELDS: Field[] = ["width", "height", "unit"];
const STATE_FILTERS: { key: ShopState | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "ERROR", label: "With errors" },
  { key: "WARNING", label: "To check" },
  { key: "VALID", label: "Valid" },
];
const ACTION_LABEL: Record<ShopLog["action"], string> = { ADD: "Added", EDIT: "Edited", DELETE: "Deleted", IMPORT: "Excel uploaded", CLEAR: "Table cleared", IMAGE_ADD: "Images added", IMAGE_REMOVE: "Image removed" };

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const sizeOf = (r: Pick<HandoverShop, "width" | "height" | "unit">) => (r.width && r.height ? `${r.width} × ${r.height} ${r.unit ?? "ft"}` : null);
type FormValues = Partial<Record<Field, string>>;
const toForm = (r?: HandoverShop): FormValues => Object.fromEntries([...BASE_FIELDS, ...SIZE_FIELDS].map((f) => [f, text(r?.[f])])) as FormValues;
/** Mapping step targets: the shop fields, a combined Size column, or keep as an extra column / skip. */
const TARGET_LABELS: Record<string, string> = { ...LABELS, size: "Size (W × H)", extra: "—" };

/** Add / edit one shop row. The server checks it with the site import rules and returns its state and issues. */
function RowDialog({ orderId, measurement, row, open, onClose }: { orderId: string; measurement: boolean; row: HandoverShop | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const add = useAddShopRow(orderId);
  const update = useUpdateShopRow(orderId);
  const [values, setValues] = useState<FormValues>(() => toForm(row ?? undefined));
  // Extra (unmapped Excel) columns of the row, editable as name + value pairs.
  const [extra, setExtra] = useState<{ key: string; value: string }[]>(() => Object.entries(row?.extra ?? {}).map(([key, value]) => ({ key, value })));
  const fields = measurement ? [...BASE_FIELDS.slice(0, 12), ...SIZE_FIELDS, ...BASE_FIELDS.slice(12)] : BASE_FIELDS;
  const busy = add.isPending || update.isPending;

  const save = async () => {
    if (!values.shopName?.trim() && !values.dealerName?.trim()) return toast("Enter the shop name or the dealer name", "error");
    const keys = extra.map((x) => x.key.trim()).filter(Boolean);
    if (new Set(keys.map((k) => k.toLowerCase())).size !== keys.length) return toast("Two extra columns have the same name", "error");
    const body: ShopRowInput = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, (v ?? "").trim()]));
    if (!measurement) for (const f of SIZE_FIELDS) delete body[f];
    body.extra = Object.fromEntries(extra.filter((x) => x.key.trim() && x.value.trim()).map((x) => [x.key.trim(), x.value.trim()]));
    try {
      const r = row ? await update.mutateAsync({ rowId: row.rowId, body }) : await add.mutateAsync(body);
      toast(r.state === "ERROR" ? `Saved with errors: ${r.issues.join("; ")}` : row ? "Shop updated" : "Shop added", r.state === "ERROR" ? "warning" : "success");
      onClose();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} variant="drawer" className="max-w-2xl" title={row ? `Edit Shop · Row ${row.rowNumber}` : "Add Shop"} description="Checked with the same rules as the Excel upload. Every change is kept in the row history.">
      <form
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        {row && row.issues.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-xs text-warning">
            {row.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f} label={LABELS[f]} htmlFor={`shop-${f}`} className={f === "remarks" || f === "address1" ? "sm:col-span-2" : undefined}>
              <Input
                id={`shop-${f}`}
                value={values[f] ?? ""}
                onChange={(e) => setValues({ ...values, [f]: e.target.value })}
                inputMode={["pincode", "mobile", "mobileAlt", "quantity", "width", "height"].includes(f) ? "decimal" : undefined}
                placeholder={f === "unit" ? "ft, in, m, cm or mm" : f === "shopName" ? "Shop or dealer name is required" : undefined}
              />
            </Field>
          ))}
        </div>
        <fieldset className="space-y-2 rounded-lg border border-border p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Columns3 className="size-3.5" aria-hidden /> Extra columns
          </legend>
          {extra.length === 0 && <p className="text-xs text-muted-foreground">Other columns from the client&apos;s Excel appear here. Add one if needed.</p>}
          {extra.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
              <Input aria-label={`Extra column ${i + 1} name`} placeholder="Column name" value={x.key} maxLength={120} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, key: e.target.value } : y)))} />
              <Input aria-label={`${x.key || `Extra column ${i + 1}`} value`} placeholder="Value" value={x.value} maxLength={500} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${x.key || "extra column"}`} onClick={() => setExtra(extra.filter((_, j) => j !== i))}>
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setExtra([...extra, { key: "", value: "" }])} disabled={extra.length >= 40}>
            <Plus className="size-4" aria-hidden /> Add Column
          </Button>
        </fieldset>
        <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={busy}>
            {row ? "Update Shop" : "Add Shop"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Header of an imported column as shown: the original text, or its position when the sheet left it blank. */
const columnTitle = (c: ShopColumn, i: number) => c.header.trim() || `(no header) column ${i + 1}`;
const SIZE_TARGETS = ["width", "height", "size", "unit"];

/**
 * Add / edit one row of an imported-columns table: one field per sheet column, with its original header, in sheet
 * order. Shop + Measurement without a size column in the sheet adds the app's own measurement fields, kept apart.
 */
function ColumnRowDialog({ orderId, columns, measurement, row, onClose }: { orderId: string; columns: ShopColumn[]; measurement: boolean; row: HandoverShop | null; onClose: () => void }) {
  const toast = useToast();
  const add = useAddShopRow(orderId);
  const update = useUpdateShopRow(orderId);
  const [cells, setCells] = useState<Record<string, string>>(() => ({ ...(row?.cells ?? {}) }));
  const appSize = measurement && !columns.some((c) => c.field && SIZE_TARGETS.includes(c.field));
  const [size, setSize] = useState({ width: text(row?.width), height: text(row?.height), unit: text(row?.unit) });
  const busy = add.isPending || update.isPending;

  const save = async () => {
    const filled = Object.fromEntries(columns.map((c) => [c.id, cells[c.id] ?? ""]).filter(([, v]) => v.trim() !== ""));
    if (!Object.keys(filled).length && !(appSize && (size.width || size.height))) return toast("Fill at least one cell", "error");
    const body: ShopRowInput = { cells: filled, ...(appSize ? { width: size.width.trim(), height: size.height.trim(), unit: size.unit.trim() } : {}) };
    try {
      const r = row ? await update.mutateAsync({ rowId: row.rowId, body }) : await add.mutateAsync(body);
      toast(r.state === "ERROR" ? `Saved with errors: ${r.issues.join("; ")}` : row ? "Row updated" : "Row added", r.state === "ERROR" ? "warning" : "success");
      onClose();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} variant="drawer" className="max-w-3xl" title={row ? `Edit Row ${row.rowNumber}` : "Add Row"} description="The columns of the uploaded Excel. Every saved change is kept in the row history.">
      <form
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        {row && row.issues.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-xs text-warning">
            {row.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {columns.map((c, i) => {
            const v = cells[c.id] ?? "";
            const long = v.length > 60;
            return (
              <Field key={c.id} label={columnTitle(c, i)} htmlFor={`cell-${c.id}`} className={long ? "sm:col-span-2" : undefined}>
                {long ? (
                  <Textarea id={`cell-${c.id}`} value={v} maxLength={2000} rows={3} onChange={(e) => setCells({ ...cells, [c.id]: e.target.value })} />
                ) : (
                  <Input id={`cell-${c.id}`} value={v} maxLength={2000} onChange={(e) => setCells({ ...cells, [c.id]: e.target.value })} />
                )}
              </Field>
            );
          })}
        </div>
        {appSize && (
          <fieldset className="grid gap-3 rounded-lg border border-brand/30 bg-brand-soft/30 p-3 sm:grid-cols-3">
            <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-brand">
              <Ruler className="size-3.5" aria-hidden /> Measurement (app)
            </legend>
            {(["width", "height", "unit"] as const).map((f) => (
              <Field key={f} label={LABELS[f]} htmlFor={`m-${f}`}>
                <Input id={`m-${f}`} value={size[f]} inputMode={f === "unit" ? undefined : "decimal"} placeholder={f === "unit" ? "ft, in, m, cm or mm" : undefined} onChange={(e) => setSize({ ...size, [f]: e.target.value })} />
              </Field>
            ))}
          </fieldset>
        )}
        <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={busy}>
            {row ? "Update Row" : "Add Row"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** One image of a shop: thumbnail from its private link, opens in the preview window. */
function Thumb({ source, file, onOpen, onRemove }: { source: FileSource; file: FileRef; onOpen: () => void; onRemove?: () => void }) {
  const url = useQuery({ queryKey: ["file-url", file.fileId], queryFn: () => fileUrl(file.fileId, source), staleTime: 4 * 60_000 });
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      <button type="button" onClick={onOpen} className="block size-full" aria-label={`View ${file.name ?? "image"}`}>
        {url.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url.data.url} alt={file.name ?? "Shop image"} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </span>
        )}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name ?? "image"}`} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Shop + Measurement: up to 10 images per shop (add / preview / remove). */
function ImagesDialog({ orderId, source, row, editable, canAdd, onClose }: { orderId: string; source: FileSource; row: HandoverShop; editable: boolean; canAdd: boolean; onClose: () => void }) {
  const toast = useToast();
  const add = useAddShopImages(orderId);
  const remove = useRemoveShopImage(orderId);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [current, setCurrent] = useState(row.attachments ?? []);
  const room = MAX_ROW_IMAGES - current.length;

  const upload = async () => {
    try {
      const r = await add.mutateAsync({ rowId: row.rowId, body: formData(files) });
      setCurrent(r.attachments ?? []);
      setFiles([]);
      toast(`${files.length} image${files.length === 1 ? "" : "s"} added`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };
  const drop = async (f: FileRef) => {
    try {
      const r = await remove.mutateAsync({ rowId: row.rowId, fileId: f.fileId });
      setCurrent(r.attachments ?? []);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Shop Images · ${row.shopName ?? row.dealerName ?? `Row ${row.rowNumber}`}`} description={`${current.length} of ${MAX_ROW_IMAGES} images`} className="max-w-3xl">
      <div className="space-y-4">
        {current.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {current.map((f) => (
              <Thumb key={f.fileId} source={source} file={f} onOpen={() => setPreview({ saved: f, source })} onRemove={editable ? () => void drop(f) : undefined} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No images yet.</p>
        )}
        {canAdd && room > 0 && (
          <div className="space-y-2">
            <FileUploader id={`img-${row.rowId}`} files={files} onChange={(f) => setFiles(f.slice(0, room))} accept=".jpg,.jpeg,.png,.webp" multiple hint={`JPG, PNG or WEBP · up to ${room} more`} compact onPreview={(f) => setPreview({ local: f })} />
            <div className="flex justify-end">
              <Button variant="brand" onClick={upload} disabled={!files.length} loading={add.isPending}>
                <Upload className="size-4" aria-hidden /> Add {files.length || ""} Image{files.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </div>
      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
    </Modal>
  );
}

/** Row (or table) history: who changed what, with the old and new values. */
function HistoryDialog({ orderId, row, onClose }: { orderId: string; row: HandoverShop | null; onClose: () => void }) {
  const q = useShopHistory(orderId, row?.rowId);
  const fieldName = (k: string) => (k.startsWith("extra:") ? `${k.slice(6)} (extra)` : (LABELS[k as Field] ?? k));
  // Extra columns are stored nested ({ extra: { Beat: "North" } }); shown as their own lines.
  const flat = (v?: Record<string, unknown>) => {
    const { extra, ...rest } = v ?? {};
    return { ...rest, ...Object.fromEntries(Object.entries((extra as Record<string, unknown>) ?? {}).map(([k, x]) => [`extra:${k}`, x])) } as Record<string, unknown>;
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={row ? `Row History · ${row.shopName ?? row.dealerName ?? `Row ${row.rowNumber}`}` : "Shop List History"} description="Newest first" className="max-w-3xl" titleClassName="text-lg">
      {q.isPending ? (
        <RowsSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3.5">
          {q.data.map((l) => {
            const before = flat(l.before);
            const after = flat(l.after);
            // Imported-column cells (by header) first, then app fields (measurement, or older rows' fields).
            const entries = [
              ...(l.cells ?? []).map((c) => ({ name: c.column || "(no header)", before: c.before, after: c.after })),
              ...[...new Set([...Object.keys(before), ...Object.keys(after)])].map((k) => ({ name: fieldName(k), before: l.before ? text(before[k]) : undefined, after: l.after ? text(after[k]) : undefined })),
            ];
            return (
              <li key={l._id} className="rounded-lg border border-border px-4 py-3 text-sm leading-relaxed">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold text-foreground">
                    {ACTION_LABEL[l.action]}
                    {!row && l.label && <span className="ml-1.5 font-normal text-muted-foreground">· {l.label}</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {l.by?.name ?? "-"} · {formatDateTimeIST(l.at)}
                  </span>
                </p>
                {l.note && <p className="mt-0.5 break-words text-sm text-muted-foreground">{l.note}</p>}
                {entries.length > 0 && (
                  <dl className="mt-2 grid gap-1.5 text-sm">
                    {entries.map((e, i) => (
                      <div key={`${e.name}-${i}`} className="grid grid-cols-[minmax(110px,180px)_1fr] gap-3">
                        <dt className="break-words font-medium text-muted-foreground">{e.name}</dt>
                        <dd className="break-words">
                          {l.action === "EDIT" ? (
                            <>
                              <span className="text-danger line-through">{e.before || "—"}</span> → <span className="font-medium text-success">{e.after || "—"}</span>
                            </>
                          ) : (
                            (e.after ?? e.before) || "—"
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}

/**
 * Shown when the server could not read the workbook without guessing (several sheets, no recognisable header, no shop
 * or dealer column): pick the sheet and header row, match each column to a shop field (or keep / skip it), then import.
 * Changing the sheet or header row asks the server for a fresh preview; nothing is imported until "Import".
 */
function MappingDialog({
  file,
  initial,
  measurement,
  onPreview,
  onImport,
  importing,
  onClose,
}: {
  file: File;
  initial: ShopImportPreview;
  measurement: boolean;
  onPreview: (o: { sheet: string; headerRow?: number }) => Promise<ShopImportPreview | null>;
  onImport: (o: { sheet: string; headerRow: number; mapping: Record<string, string> }) => void;
  importing: boolean;
  onClose: () => void;
}) {
  const [p, setP] = useState(initial);
  const [mapping, setMapping] = useState(initial.mapping);
  const [loading, setLoading] = useState(false);
  const reload = async (o: { sheet: string; headerRow?: number }) => {
    setLoading(true);
    const next = await onPreview(o).finally(() => setLoading(false));
    if (next) {
      setP(next);
      setMapping(next.mapping);
    }
  };
  const used = Object.values(mapping).filter((t) => t !== "extra" && t !== "ignore");
  const dup = used.find((t, i) => used.indexOf(t) !== i);
  const headerIdx = p.rows.findIndex((r) => r.rowNumber === p.headerRow);
  const sample = p.rows.slice(headerIdx + 1, headerIdx + 4);
  const targets = ["extra", ...p.fields];

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} variant="drawer" className="max-w-3xl" title="Choose the sheet" description={`${file.name} · every column is imported as it is; nothing is imported until you confirm.`}>
      <div className="space-y-4">
        {p.problems.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm text-warning">
            {p.problems.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sheet" htmlFor="map-sheet">
            <Select id="map-sheet" value={p.sheet} disabled={loading || p.sheets.length < 2} onChange={(e) => void reload({ sheet: e.target.value })}>
              {p.sheets.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.rows} rows)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Header row" htmlFor="map-header" hint="The row with the column names.">
            <Select id="map-header" value={p.headerRow ?? ""} disabled={loading} onChange={(e) => void reload({ sheet: p.sheet, headerRow: Number(e.target.value) })}>
              {p.rows.map((r) => (
                <option key={r.rowNumber} value={r.rowNumber}>
                  Row {r.rowNumber}: {r.cells.filter(Boolean).slice(0, 4).join(" | ").slice(0, 60) || "(blank)"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className={cn("max-h-[50dvh] overflow-auto rounded-lg border border-border", loading && "opacity-60")}>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Excel column</th>
                <th className="px-3 py-2">Sample values</th>
                <th className="w-56 px-3 py-2">Also used as (optional)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.headers.map((h, i) => (
                <tr key={h}>
                  <td className="px-3 py-2 font-medium">{p.rows[headerIdx]?.cells[i] || <span className="italic text-muted-foreground">(no header) column {i + 1}</span>}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted-foreground">{sample.map((r) => r.cells[i]).filter(Boolean).join(" · ") || "-"}</td>
                  <td className="px-3 py-1.5">
                    <Select aria-label={`Also use ${h} as`} className="h-9" value={mapping[h] ?? "extra"} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}>
                      {targets.map((t) => (
                        <option key={t} value={t}>
                          {TARGET_LABELS[t] ?? t}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          All columns are kept with their own headers. &ldquo;Also used as&rdquo; only tells the app which column holds the shop name, mobile, GST{measurement ? ", size" : ""} and so on for its checks.
        </p>
        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
          <span className="text-xs text-danger" role="status">
            {dup ? `"${TARGET_LABELS[dup] ?? dup}" is chosen twice.` : ""}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={importing}>
              Cancel
            </Button>
            <Button type="button" variant="brand" loading={importing} disabled={loading || !!dup || !p.headerRow} onClick={() => onImport({ sheet: p.sheet, headerRow: p.headerRow!, mapping })}>
              <Upload className="size-4" aria-hidden /> Import Rows
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Rows of the last upload that came in with problems (kept in the table, flagged), by Excel row. */
function FlaggedRows({ result, onClose }: { result: ShopImportResult; onClose: () => void }) {
  if (!result.flaggedCount) return null;
  return (
    <div className="rounded-lg border border-warning/30 bg-warning-soft/50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-warning">
          {result.flaggedCount} imported row{result.flaggedCount === 1 ? "" : "s"} need a look. They are in the table: edit or delete them.
        </p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Dismiss upload issues">
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-xs text-muted-foreground">
        {(result.flagged ?? []).map((f) => (
          <li key={`${f.line}-${f.row}`}>
            <span className={cn("font-semibold", f.state === "ERROR" ? "text-danger" : "text-warning")}>
              Excel row {f.line} → table row {f.row}:
            </span>{" "}
            {f.issues.join("; ")}
          </li>
        ))}
        {(result.flaggedCount ?? 0) > (result.flagged?.length ?? 0) && <li>…and {(result.flaggedCount ?? 0) - (result.flagged?.length ?? 0)} more (filter by status below).</li>}
      </ul>
    </div>
  );
}

/**
 * Editable shop table of a handover (Only Shop Details / Shop + Measurement). Excel uploads ADD rows (a "Row ID"
 * from the downloaded Excel updates that row instead); rows can be added, edited and deleted; Total Shops is the row
 * count. Shop + Measurement adds Size and up to 10 images per shop. Every change is logged per row.
 * `projectId`: the read-only view of an operations project (Recce / Operations), read through the project's routes.
 */
export function ShopTable({
  orderId,
  type,
  summary,
  editable,
  canAddImages,
  projectId,
  columns: columnsProp,
}: {
  orderId: string;
  type: HandoverType;
  summary: ShopListSummary | null;
  /** Before handover: add / edit / delete / upload / clear. */
  editable: boolean;
  /** Images can still be added after handover. */
  canAddImages: boolean;
  projectId?: string;
  /** Imported columns from the handover (the rows' list carries them too; used while the table has no rows). */
  columns?: ShopColumn[] | null;
}) {
  const toast = useToast();
  const measurement = type === "SHOP_MEASUREMENT";
  const [state, setState] = useState<ShopState | "">("");
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File[]>([]);
  const [editing, setEditing] = useState<HandoverShop | null | "new">(null);
  const [images, setImages] = useState<HandoverShop | null>(null);
  const [history, setHistory] = useState<HandoverShop | null | "all">(null);
  const [deleting, setDeleting] = useState<HandoverShop | null>(null);
  const [clearing, setClearing] = useState(false);
  const upload = useUploadShopList(orderId);
  const del = useDeleteShopRow(orderId);
  const clear = useRemoveShopList(orderId);
  const orderRows = useHandoverShops(orderId, { page, limit: 25, state }, !projectId && !!summary?.total, type);
  const projectRows = useProjectHandoverShops(projectId ?? "", { page, limit: 25, state }, !!projectId && !!summary?.total);
  const rows = projectId ? projectRows : orderRows;
  const source: FileSource = projectId ? { projectId } : { orderId };
  const total = summary?.total ?? 0;
  const hasExtra = !!rows.data?.data.some((r) => Object.keys(r.extra ?? {}).length);
  // The table as uploaded: its own columns (null for tables from before imported columns).
  const listed = (rows.data?.meta as { columns?: ShopColumn[] | null } | undefined)?.columns;
  const cols = (listed !== undefined ? listed : columnsProp) ?? null;
  // Shop + Measurement: the app's Size column, unless the sheet has its own size column.
  const showSize = measurement && !(cols ?? []).some((c) => c.field && SIZE_TARGETS.includes(c.field));

  const [mappingStep, setMappingStep] = useState<ShopImportPreview | null>(null);
  const [lastImport, setLastImport] = useState<ShopImportResult | null>(null);
  /** The import that failed (kept on screen with Retry); cleared on success or a new pick. */
  const [failed, setFailed] = useState(false);
  /** The file being imported: a repeated change / drop event for it (or a double drop) does not import it twice. */
  const busy = useRef<string | null>(null);
  const previewOf = (e: unknown) => (e instanceof ApiError && e.code === "SHOP_MAPPING_REQUIRED" ? ((e.details as { preview?: ShopImportPreview } | undefined)?.preview ?? null) : null);
  const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

  /**
   * Upload (optionally with the mapping step's choices); an ambiguous workbook opens
   * the mapping step instead. Runs as soon as an Excel file is picked or dropped.
   */
  const doUpload = async (opts: { sheet?: string; headerRow?: number; mapping?: Record<string, string> } = {}, picked: File[] = file) => {
    const f = picked[0];
    if (!f) return;
    const key = keyOf(f);
    if (busy.current === key) return;
    busy.current = key;
    setFailed(false);
    try {
      const r = await upload.mutateAsync(formData([f], { sheet: opts.sheet, headerRow: opts.headerRow ? String(opts.headerRow) : undefined, mapping: opts.mapping ? JSON.stringify(opts.mapping) : undefined }));
      setFile([]);
      setMappingStep(null);
      setPage(1);
      setState("");
      setLastImport(r.imported ?? null);
      const flagged = r.imported?.flaggedCount ?? 0;
      toast(`Shop list uploaded: ${r.imported?.added ?? 0} added, ${r.imported?.updated ?? 0} updated${flagged ? `, ${flagged} to check` : ""}. Total Shops: ${r.shopList?.total ?? 0}.`, flagged ? "warning" : "success");
    } catch (e) {
      const preview = previewOf(e);
      if (preview) setMappingStep(preview);
      else if (e instanceof ApiError && e.code === "SHOP_LIST_ALREADY_IMPORTED") {
        // A retry of a file that did go in: nothing new, nothing failed.
        setFile([]);
        toast(errorMessage(e), "warning");
      } else {
        setFailed(true);
        toast(errorMessage(e), "error");
      }
    } finally {
      busy.current = null;
    }
  };
  /** A pick or drop replaces the waiting file and imports it straight away (no extra click). */
  const pick = (f: File[]) => {
    const one = f.slice(-1);
    setFile(one);
    setMappingStep(null);
    if (one[0]) void doUpload({}, one);
    else setFailed(false);
  };
  /** Mapping step: a fresh preview for another sheet / header row (imports nothing). */
  const previewFor = async (o: { sheet: string; headerRow?: number }) => {
    try {
      await upload.mutateAsync(formData(file, { sheet: o.sheet, headerRow: o.headerRow ? String(o.headerRow) : undefined, preview: "1" }));
      return null;
    } catch (e) {
      const preview = previewOf(e);
      if (!preview) toast(errorMessage(e), "error");
      return preview;
    }
  };
  const fail = (e: unknown) => toast(errorMessage(e), "error");
  const kpis = [
    { label: "Total Shops", value: total, icon: Store, tone: "bg-brand-soft text-brand" },
    { label: "Valid", value: summary?.valid ?? 0, icon: CheckCircle2, tone: "bg-success-soft text-success" },
    { label: "To Check", value: summary?.warning ?? 0, icon: AlertTriangle, tone: "bg-warning-soft text-warning" },
    { label: "With Errors", value: summary?.error ?? 0, icon: XCircle, tone: "bg-danger-soft text-danger" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 p-5 sm:p-6">
        <SectionTitle
          icon={Store}
          title={measurement ? "Shop + Measurement" : "Only Shop Details"}
          description={
            !editable
              ? `Shop list from the BD${measurement ? " with sizes and up to 10 images per shop" : ""}. Download Excel gives the current list.`
              : measurement
                ? "Pick the Excel (it is imported at once) or add shops one by one. Size (W × H) is optional; add up to 10 images per shop."
                : "Pick the Excel (no sizes; it is imported at once) or add shops one by one."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadShopTemplate(measurement ? "SHOP_MEASUREMENT" : "SHOP_DETAILS").catch(fail)}>
                <Download className="size-4" aria-hidden /> Template
              </Button>
              {total > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => (projectId ? downloadProjectShopExcel(projectId) : downloadShopExcel(orderId)).catch(fail)}>
                    <FileSpreadsheet className="size-4" aria-hidden /> Download Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => (projectId ? downloadProjectShopPdf(projectId) : downloadShopPdf(orderId)).catch(fail)}>
                    <FileText className="size-4" aria-hidden /> Download PDF
                  </Button>
                </>
              )}
              {!projectId && (
                <Button variant="outline" size="sm" onClick={() => setHistory("all")}>
                  <History className="size-4" aria-hidden /> History
                </Button>
              )}
            </div>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <span className={cn("flex size-9 items-center justify-center rounded-lg", k.tone)}>
                <k.icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-primary tabular-nums">{k.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
              </div>
            </div>
          ))}
        </div>
        {editable && (
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <FileUploader
                id="ho-shop-file"
                files={file}
                onChange={pick}
                accept=".xlsx,.xls"
                typeError="Upload an Excel file (.xlsx or .xls)"
                compact
                disabled={upload.isPending}
                hint="Excel (.xlsx / .xls) in any column order; the template is optional. Rows are added as soon as you pick the file; rows with a Row ID (from Download Excel) are updated."
              />
              {upload.isPending && !mappingStep && (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Importing {file[0]?.name ?? "the file"}…
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {failed && file[0] && !upload.isPending && (
                <Button variant="brand" onClick={() => void doUpload()}>
                  <RotateCcw className="size-4" aria-hidden /> Retry Import
                </Button>
              )}
              <Button variant="brand-outline" onClick={() => setEditing("new")}>
                <Plus className="size-4" aria-hidden /> Add Shop
              </Button>
              {total > 0 && (
                <Button variant="outline" className="border-danger/30 text-danger hover:bg-danger-soft" onClick={() => setClearing(true)}>
                  <Trash2 className="size-4" aria-hidden /> Clear All
                </Button>
              )}
            </div>
          </div>
        )}
        {editable && lastImport && <FlaggedRows result={lastImport} onClose={() => setLastImport(null)} />}
        {total > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter shops">
            {STATE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={state === f.key}
                onClick={() => {
                  setState(f.key);
                  setPage(1);
                }}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", state === f.key ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted-foreground hover:bg-muted")}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!total ? (
        <div className="px-5 pb-6 sm:px-6">
          <EmptyState icon={Store} title="No shops yet" description={editable ? "Upload the client's Excel or add the shops one by one." : "The BD did not add a shop list."} />
        </div>
      ) : rows.isPending ? (
        <div className="px-5 pb-6 sm:px-6">
          <RowsSkeleton rows={5} />
        </div>
      ) : rows.isError ? (
        <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
      ) : (
        <>
          <div className="max-h-[min(420px,60dvh)] overflow-auto overscroll-contain border-t border-border">
            <table className="w-max min-w-full text-left text-sm" style={cols ? undefined : { minWidth: 1100 }}>
              <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold text-muted-foreground">
                {cols && (
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide">
                    <th className="px-3 py-1.5" />
                    <th colSpan={cols.length} className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5" aria-hidden /> Uploaded Excel columns ({cols.length})
                      </span>
                    </th>
                    <th colSpan={(showSize ? 1 : 0) + (measurement ? 1 : 0) + 3} className="border-l-2 border-brand/30 bg-brand-soft/60 px-3 py-1.5 text-brand">
                      App
                    </th>
                  </tr>
                )}
                <tr className={cols ? undefined : "uppercase tracking-wide"}>
                  <th className="px-3 py-2.5">#</th>
                  {cols ? (
                    cols.map((c, i) => (
                      <th key={c.id} scope="col" className="min-w-[140px] max-w-[280px] whitespace-pre-wrap break-words px-3 py-2.5 text-foreground" title={c.header || undefined}>
                        {c.header.trim() ? c.header : <span className="font-normal italic text-muted-foreground">{columnTitle(c, i)}</span>}
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="px-3 py-2.5">Shop / Dealer</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5">Address</th>
                      <th className="px-3 py-2.5">Mobile / GST</th>
                    </>
                  )}
                  {showSize && <th className={cn("px-3 py-2.5", cols && "border-l-2 border-brand/30 bg-brand-soft/40")}>Size</th>}
                  {!cols && hasExtra && <th className="px-3 py-2.5">Other Columns</th>}
                  {measurement && <th className={cn("px-3 py-2.5", cols && !showSize && "border-l-2 border-brand/30", cols && "bg-brand-soft/40")}>Images</th>}
                  <th className={cn("px-3 py-2.5", cols && !showSize && !measurement && "border-l-2 border-brand/30", cols && "bg-brand-soft/40")}>Status</th>
                  <th className={cn("px-3 py-2.5", cols && "bg-brand-soft/40")}>Modified</th>
                  <th className={cn("px-3 py-2.5 text-right", cols && "bg-brand-soft/40")}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.data.data.map((r) => (
                  <tr key={r.rowId} className={cn("align-top hover:bg-muted/40", r.state === "ERROR" && "bg-danger-soft/30")}>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                    {cols ? (
                      cols.map((c) => (
                        <td key={c.id} className="min-w-[140px] max-w-[280px] whitespace-pre-wrap break-words px-3 py-2.5">
                          {r.cells?.[c.id] ?? ""}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{r.shopName ?? r.dealerName ?? "-"}</p>
                          {r.shopName && r.dealerName && <p className="text-xs text-muted-foreground">{r.dealerName}</p>}
                          {r.contactPerson && <p className="text-xs text-muted-foreground">Contact: {r.contactPerson}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          {[r.location, r.district].filter(Boolean).join(", ") || "-"}
                          {r.pincode && <p className="text-xs text-muted-foreground">{r.pincode}</p>}
                        </td>
                        <td className="max-w-[240px] px-3 py-2.5 text-xs">{[r.address1, r.address2, r.address3].filter(Boolean).join(", ") || "-"}</td>
                        <td className="px-3 py-2.5 text-xs tabular-nums">
                          {r.mobile ?? "-"}
                          {r.gstin && <p className="text-muted-foreground">{r.gstin}</p>}
                        </td>
                      </>
                    )}
                    {showSize && <td className={cn("whitespace-nowrap px-3 py-2.5 tabular-nums", cols && "border-l-2 border-brand/30")}>{sizeOf(r) ?? <span className="text-muted-foreground">-</span>}</td>}
                    {!cols && hasExtra && (
                      <td className="max-w-[220px] px-3 py-2.5 text-xs">
                        {Object.entries(r.extra ?? {}).map(([k, v]) => (
                          <p key={k} className="truncate" title={`${k}: ${v}`}>
                            <span className="text-muted-foreground">{k}:</span> {v}
                          </p>
                        ))}
                        {!Object.keys(r.extra ?? {}).length && <span className="text-muted-foreground">-</span>}
                      </td>
                    )}
                    {measurement && (
                      <td className={cn("px-3 py-2.5", cols && !showSize && "border-l-2 border-brand/30")}>
                        <Button variant="outline" size="sm" onClick={() => setImages(r)} aria-label={`Images of row ${r.rowNumber}`}>
                          {(r.attachments?.length ?? 0) > 0 ? <Camera className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} {r.attachments?.length ?? 0}/{MAX_ROW_IMAGES}
                        </Button>
                      </td>
                    )}
                    <td className={cn("px-3 py-2.5", cols && !showSize && !measurement && "border-l-2 border-brand/30")}>
                      <Badge tone={r.state === "VALID" ? "success" : r.state === "WARNING" ? "warning" : "danger"}>{r.state === "VALID" ? "Valid" : r.state === "WARNING" ? "Check" : "Error"}</Badge>
                      {r.issues.length > 0 && <p className="mt-1 w-[200px] text-xs text-muted-foreground">{r.issues.join("; ")}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {r.updatedAt ? formatDateTimeIST(r.updatedAt) : "-"}
                      {r.updatedByName && <p>{r.updatedByName}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {editable && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label={`Edit row ${r.rowNumber}`} title="Edit">
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        )}
                        {!projectId && (
                          <Button variant="ghost" size="sm" onClick={() => setHistory(r)} aria-label={`History of row ${r.rowNumber}`} title="History">
                            <History className="size-4" aria-hidden />
                          </Button>
                        )}
                        {editable && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label={`Delete row ${r.rowNumber}`} title="Delete">
                            <Trash2 className="size-4 text-danger" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={rows.data.meta} onPage={setPage} />
        </>
      )}

      {mappingStep && file[0] && (
        <MappingDialog
          file={file[0]}
          initial={mappingStep}
          measurement={measurement}
          onPreview={previewFor}
          onImport={(o) => void doUpload(o)}
          importing={upload.isPending}
          onClose={() => {
            setMappingStep(null);
            setFile([]);
          }}
        />
      )}
      {editing &&
        (cols ? (
          <ColumnRowDialog key={editing === "new" ? "new" : editing.rowId} orderId={orderId} columns={cols} measurement={measurement} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
        ) : (
          <RowDialog key={editing === "new" ? "new" : editing.rowId} orderId={orderId} measurement={measurement} row={editing === "new" ? null : editing} open onClose={() => setEditing(null)} />
        ))}
      {images && <ImagesDialog orderId={orderId} source={source} row={images} editable={editable} canAdd={canAddImages} onClose={() => setImages(null)} />}
      {history && <HistoryDialog orderId={orderId} row={history === "all" ? null : history} onClose={() => setHistory(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this shop?"
        description={`${deleting?.shopName ?? deleting?.dealerName ?? "This row"} is removed from the shop list${deleting?.attachments?.length ? ` with its ${deleting.attachments.length} image(s)` : ""}. Its values stay in the history.`}
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(deleting!.rowId);
            setDeleting(null);
            toast("Shop deleted");
          } catch (e) {
            fail(e);
          }
        }}
      />
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear the whole shop list?"
        description={`All ${total} shops${measurement ? " and their images" : ""} are removed. The history keeps a record of it.`}
        confirmLabel="Clear All"
        destructive
        loading={clear.isPending}
        onConfirm={async () => {
          try {
            await clear.mutateAsync(undefined);
            setClearing(false);
            toast("Shop list cleared");
          } catch (e) {
            fail(e);
          }
        }}
      />
    </Card>
  );
}
