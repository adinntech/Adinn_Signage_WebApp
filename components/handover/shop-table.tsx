"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, Download, FileSpreadsheet, History, ImagePlus, Loader2, Pencil, Plus, Store, Trash2, Upload, X, XCircle } from "lucide-react";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SectionTitle } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { fileUrl, formData, type FileRef, type FileSource } from "@/lib/api/files";
import { downloadProjectShopExcel, useProjectHandoverShops } from "@/lib/api/recce";
import {
  downloadShopExcel,
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
  type ShopListSummary,
  type ShopLog,
  type ShopRowInput,
  type ShopState,
} from "@/lib/api/sales";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";

type Field = keyof ShopRowInput;
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
const toForm = (r?: HandoverShop): ShopRowInput => Object.fromEntries([...BASE_FIELDS, ...SIZE_FIELDS].map((f) => [f, text(r?.[f])])) as ShopRowInput;

/** Add / edit one shop row. The server checks it with the site import rules and returns its state and issues. */
function RowDialog({ orderId, measurement, row, open, onClose }: { orderId: string; measurement: boolean; row: HandoverShop | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const add = useAddShopRow(orderId);
  const update = useUpdateShopRow(orderId);
  const [values, setValues] = useState<ShopRowInput>(() => toForm(row ?? undefined));
  const fields = measurement ? [...BASE_FIELDS.slice(0, 12), ...SIZE_FIELDS, ...BASE_FIELDS.slice(12)] : BASE_FIELDS;
  const busy = add.isPending || update.isPending;

  const save = async () => {
    if (!values.shopName?.trim() && !values.dealerName?.trim()) return toast("Enter the shop name or the dealer name", "error");
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, (v ?? "").trim()])) as ShopRowInput;
    if (!measurement) for (const f of SIZE_FIELDS) delete body[f];
    try {
      const r = row ? await update.mutateAsync({ rowId: row.rowId, body }) : await add.mutateAsync(body);
      toast(r.state === "ERROR" ? `Saved with errors: ${r.issues.join("; ")}` : row ? "Shop updated" : "Shop added", r.state === "ERROR" ? "error" : "success");
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
  const fieldName = (k: string) => LABELS[k as Field] ?? k;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={row ? `Row History · ${row.shopName ?? row.dealerName ?? `Row ${row.rowNumber}`}` : "Shop List History"} description="Newest first" className="max-w-2xl">
      {q.isPending ? (
        <RowsSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {q.data.map((l) => {
            const keys = [...new Set([...Object.keys(l.before ?? {}), ...Object.keys(l.after ?? {})])];
            return (
              <li key={l._id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{ACTION_LABEL[l.action]}</span>
                  <span className="text-xs text-muted-foreground">
                    {l.by?.name ?? "-"} · {formatDateTimeIST(l.at)}
                  </span>
                </p>
                {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                {keys.length > 0 && (
                  <dl className="mt-1.5 grid gap-1 text-xs">
                    {keys.map((k) => (
                      <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                        <dt className="text-muted-foreground">{fieldName(k)}</dt>
                        <dd>
                          {l.action === "EDIT" ? (
                            <>
                              <span className="text-danger line-through">{text(l.before?.[k]) || "—"}</span> → <span className="font-medium text-success">{text(l.after?.[k]) || "—"}</span>
                            </>
                          ) : (
                            text((l.after ?? l.before)?.[k])
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
 * Editable shop table of a handover (Shop Details Only / Shop + Measurement). Excel / CSV uploads ADD rows (a "Row ID"
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
}: {
  orderId: string;
  type: HandoverType;
  summary: ShopListSummary | null;
  /** Before handover: add / edit / delete / upload / clear. */
  editable: boolean;
  /** Images can still be added after handover. */
  canAddImages: boolean;
  projectId?: string;
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
  const orderRows = useHandoverShops(orderId, { page, limit: 25, state }, !projectId && !!summary?.total);
  const projectRows = useProjectHandoverShops(projectId ?? "", { page, limit: 25, state }, !!projectId && !!summary?.total);
  const rows = projectId ? projectRows : orderRows;
  const source: FileSource = projectId ? { projectId } : { orderId };
  const total = summary?.total ?? 0;

  const doUpload = async () => {
    if (!file[0]) return;
    try {
      const r = await upload.mutateAsync(formData(file));
      setFile([]);
      setPage(1);
      setState("");
      toast(`Shop list uploaded: ${r.imported?.added ?? 0} added, ${r.imported?.updated ?? 0} updated. Total Shops: ${r.shopList?.total ?? 0}.`);
    } catch (e) {
      toast(errorMessage(e), "error");
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
          title={measurement ? "Shop Details + Measurement" : "Shop Details"}
          description={
            !editable
              ? `Shop list from the BD${measurement ? " with sizes and up to 10 images per shop" : ""}. Download Excel gives the current list.`
              : measurement
                ? "Upload the Excel or add shops one by one. Size (W × H) is optional; add up to 10 images per shop."
                : "Upload the Excel (no sizes) or add shops one by one."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadShopTemplate(measurement ? "SHOP_MEASUREMENT" : "SHOP_DETAILS").catch(fail)}>
                <Download className="size-4" aria-hidden /> Template
              </Button>
              {total > 0 && (
                <Button variant="outline" size="sm" onClick={() => (projectId ? downloadProjectShopExcel(projectId) : downloadShopExcel(orderId)).catch(fail)}>
                  <FileSpreadsheet className="size-4" aria-hidden /> Download Excel
                </Button>
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
            <FileUploader id="ho-shop-file" files={file} onChange={setFile} accept=".xlsx,.csv" compact hint="Excel (.xlsx) or CSV. Rows are added to the table; rows with a Row ID (from Download Excel) are updated." />
            <div className="flex flex-wrap gap-2">
              <Button variant="brand" onClick={doUpload} disabled={!file[0]} loading={upload.isPending}>
                <Upload className="size-4" aria-hidden /> Upload & Add Rows
              </Button>
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
          <div className="max-h-[560px] overflow-auto border-t border-border">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Shop / Dealer</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Address</th>
                  <th className="px-3 py-2.5">Mobile / GST</th>
                  {measurement && <th className="px-3 py-2.5">Size</th>}
                  {measurement && <th className="px-3 py-2.5">Images</th>}
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Modified</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.data.data.map((r) => (
                  <tr key={r.rowId} className={cn("align-top hover:bg-muted/40", r.state === "ERROR" && "bg-danger-soft/30")}>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.rowNumber}</td>
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
                    {measurement && <td className="px-3 py-2.5 tabular-nums">{sizeOf(r) ?? <span className="text-muted-foreground">-</span>}</td>}
                    {measurement && (
                      <td className="px-3 py-2.5">
                        <Button variant="outline" size="sm" onClick={() => setImages(r)} aria-label={`Images of row ${r.rowNumber}`}>
                          {(r.attachments?.length ?? 0) > 0 ? <Camera className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} {r.attachments?.length ?? 0}/{MAX_ROW_IMAGES}
                        </Button>
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <Badge tone={r.state === "VALID" ? "success" : r.state === "WARNING" ? "warning" : "danger"}>{r.state === "VALID" ? "Valid" : r.state === "WARNING" ? "Check" : "Error"}</Badge>
                      {r.issues.length > 0 && <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">{r.issues.join("; ")}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
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

      {editing && <RowDialog key={editing === "new" ? "new" : editing.rowId} orderId={orderId} measurement={measurement} row={editing === "new" ? null : editing} open onClose={() => setEditing(null)} />}
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
