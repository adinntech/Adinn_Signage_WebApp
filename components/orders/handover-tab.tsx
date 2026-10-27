"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ListChecks,
  ListPlus,
  Mic,
  Pencil,
  NotebookPen,
  Save,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  CircleAlert,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Handshake,
  Info,
  Loader2,
  Paperclip,
  PhoneCall,
  RefreshCw,
  Ruler,
  Send,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { ContactDialog } from "@/components/clients/contact-dialog";
import { AttachmentChip } from "@/components/sales/order-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, formData, openFile } from "@/lib/api/files";
import {
  HANDOVER_TYPES,
  downloadShopTemplate,
  useAddHandoverDocs,
  useAssignClientServicing,
  useClientServicingUsers,
  useHandover,
  useHandoverShops,
  useRemoveHandoverDoc,
  useRemoveShopList,
  useSetHandoverNotes,
  useSetHandoverScope,
  useSetHandoverType,
  useSetShopTotal,
  useShopFiles,
  useUploadShopList,
  useVerifyShops,
  type HandoverShop,
  type HandoverState,
  type HandoverType,
  type Order,
  type ShopState,
} from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { useScrollTo } from "@/hooks/use-scroll-to";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VoiceNotes } from "./voice-notes";

const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv";

const TYPE_ICON: Record<HandoverType, typeof Store> = { ASO: PhoneCall, SHOP_DETAILS: FileSpreadsheet, SHOP_MEASUREMENT: Ruler };

/**
 * Assign to Client Servicing toggle. On (default): the full handover. Off: only the client details and contact persons
 * go to Client Servicing (what was entered for the full handover is kept, just not sent or required).
 */
function ScopeSection({ orderId, data, editable }: { orderId: string; data: HandoverState; editable: boolean }) {
  const toast = useToast();
  const set = useSetHandoverScope(orderId);
  const flip = () =>
    set.mutateAsync(!data.full).then(
      (r) => toast(r.full ? "Full handover: type, notes, documents and shop list" : "Client details and contact persons only"),
      (e) => toast(errorMessage(e), "error"),
    );
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors", data.full ? "bg-approval text-white" : "bg-muted text-muted-foreground")}>
        <ListChecks className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p id="ho-scope-label" className="text-sm font-semibold text-primary">
          Send handover details
        </p>
        <p className="text-xs text-muted-foreground">
          {data.full
            ? "On: handover type, notes, voice notes, documents and the shop list go to Client Servicing."
            : "Off: only the client details and contact persons go to Client Servicing."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={data.full}
        aria-labelledby="ho-scope-label"
        disabled={!editable || set.isPending}
        onClick={flip}
        className={cn(
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
          data.full ? "bg-approval" : "bg-slate-300",
        )}
      >
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={cn("flex size-6 items-center justify-center rounded-full bg-white shadow", data.full ? "ml-7" : "ml-1")}>
          {set.isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
        </motion.span>
      </button>
      <span className={cn("w-8 text-sm font-semibold", data.full ? "text-approval" : "text-muted-foreground")}>{data.full ? "On" : "Off"}</span>
    </Card>
  );
}

/** Additional notes and voice notes for Client Servicing. */
function NotesSection({ orderId, data, editable, canAddVoice }: { orderId: string; data: HandoverState; editable: boolean; canAddVoice: boolean }) {
  const toast = useToast();
  const save = useSetHandoverNotes(orderId);
  const [text, setText] = useState(data.notes);
  // Saved text changed on the server (save, reload): start from it again.
  const [seen, setSeen] = useState(data.notes);
  if (seen !== data.notes) {
    setSeen(data.notes);
    setText(data.notes);
  }
  const dirty = text.trim() !== data.notes.trim();
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle icon={NotebookPen} title="Additional Notes & Voice Notes" description={editable ? "Anything Client Servicing should know: in writing, or as a voice note." : "What the BD noted for Client Servicing."} />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-2">
          <Field label="Additional Notes" htmlFor="ho-add-notes">
            {editable ? (
              <Textarea id="ho-add-notes" className="min-h-36" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Client prefers calls after 11 am. Branding refresh for 40 outlets; old boards to be removed." />
            ) : (
              <p className="min-h-16 whitespace-pre-line rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{data.notes || <span className="text-muted-foreground">No notes.</span>}</p>
            )}
          </Field>
          {editable && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{text.length}/4000</span>
              <Button
                variant="brand-outline"
                size="sm"
                disabled={!dirty}
                loading={save.isPending}
                onClick={() => save.mutateAsync(text.trim()).then(() => toast("Notes saved"), (e) => toast(errorMessage(e), "error"))}
              >
                <Save className="size-4" aria-hidden /> Save Notes
              </Button>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Mic className="size-4 text-brand" aria-hidden /> Voice Notes
          </p>
          <VoiceNotes orderId={orderId} notes={data.voiceNotes} canAdd={canAddVoice} canDelete={editable} />
        </div>
      </div>
    </Card>
  );
}

/** ASO / Shop Details Only / Shop + Measurement: decides what the BD shares and what is checked before handover. */
function TypeSection({ orderId, data, editable }: { orderId: string; data: HandoverState; editable: boolean }) {
  const toast = useToast();
  const set = useSetHandoverType(orderId);
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle icon={Handshake} title="Handover Type" description={editable ? "Choose what you hand over to Client Servicing." : "What the BD handed over."} />
      <div role="radiogroup" aria-label="Handover type" className="grid gap-3 md:grid-cols-3">
        {(Object.keys(HANDOVER_TYPES) as HandoverType[]).map((k) => {
          const on = data.type === k;
          const Icon = TYPE_ICON[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!editable || set.isPending}
              onClick={() => !on && set.mutateAsync(k).then(() => toast(`Handover type: ${HANDOVER_TYPES[k].label}`), (e) => toast(errorMessage(e), "error"))}
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default",
                on ? "border-approval bg-[#fff7ed]" : "border-border hover:bg-muted/60",
                !editable && !on && "opacity-50",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", on ? "bg-approval text-white" : "bg-muted text-muted-foreground")}>
                {set.isPending && set.variables === k ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {HANDOVER_TYPES[k].label}
                  {on && <CheckCircle2 className="size-4 text-approval" aria-hidden />}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{HANDOVER_TYPES[k].hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {editable && data.shopList && data.type && <p className="mt-3 text-xs text-muted-foreground">To change the type, remove the uploaded shop list first (it is checked by the type).</p>}
    </Card>
  );
}

/**
 * Company and contact persons, straight from Client Management. Contact persons can be added and edited here (saved on
 * the client). GST certificate and custom fields: New (Client Management) clients only, not Existing (Zoho) ones.
 */
function ClientSection({ order, canAddContact, aso }: { order: Order; canAddContact: boolean; aso: boolean }) {
  const c = order.client;
  // null: closed; -1: add; >= 0: edit that contact.
  const [editing, setEditing] = useState<number | null>(null);
  const crm = order.clientType !== "EXISTING";
  const certificates = crm ? (c.gstCertificates ?? []) : [];
  const custom = crm ? (c.customFields ?? []) : [];
  const address = [c.address, c.city, c.state].filter(Boolean).join(", ") + (c.pincode ? ` - ${c.pincode}` : "");
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={Building2}
        title="Client & Contact Persons"
        description={aso ? "ASO: Client Servicing calls these contacts to collect the shop details. Add anyone they should speak to." : "Auto-filled from Client Management."}
        action={
          canAddContact && (
            <Button variant="brand-outline" size="sm" onClick={() => setEditing(-1)}>
              <UserPlus className="size-4" aria-hidden /> Add Contact Person
            </Button>
          )
        }
      />
      <ContactDialog client={c} index={editing === -1 ? null : editing} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} />
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="Company Name">{c.name}</DetailItem>
        <DetailItem label="Client Name">{c.clientName}</DetailItem>
        <DetailItem label="Client ID">
          <span className="font-mono text-brand">{c.clientNo ?? c.code}</span>
        </DetailItem>
        <DetailItem label="Company Email">{c.email}</DetailItem>
        <DetailItem label="Phone Number">{c.phone}</DetailItem>
        <DetailItem label="GST Number">{c.gstin}</DetailItem>
        {crm && (
          <DetailItem label="GST Certificate" className="sm:col-span-2 xl:col-span-3">
            {certificates.length ? (
              <span className="flex flex-wrap gap-1.5">
                {certificates.map((f) => (
                  // Through the order, so Client Servicing can open it too.
                  <AttachmentChip key={f.fileId} file={f} source={{ orderId: order._id }} />
                ))}
              </span>
            ) : null}
          </DetailItem>
        )}
        {/* Older clients may still carry an address from the previous form. */}
        {address && (
          <DetailItem label="Address" className="sm:col-span-2 xl:col-span-3">
            {address}
          </DetailItem>
        )}
      </dl>
      {custom.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ListPlus className="size-3.5" aria-hidden /> Custom Fields
          </p>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {custom.map((f) => (
              <DetailItem key={f.label} label={f.label}>
                {f.value}
              </DetailItem>
            ))}
          </dl>
        </div>
      )}
      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Contact Person</th>
              <th className="px-4 py-2.5">Designation</th>
              <th className="px-4 py-2.5">Mobile</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Primary</th>
              {canAddContact && (
                <th className="px-4 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {c.contacts.length === 0 && (
              <tr>
                <td colSpan={canAddContact ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">
                  No contact persons yet.
                </td>
              </tr>
            )}
            {c.contacts.map((k, i) => (
              <tr key={`${k.name}-${i}`}>
                <td className="px-4 py-2.5 font-medium">{k.name}</td>
                <td className="px-4 py-2.5">{k.designation ?? "-"}</td>
                <td className="px-4 py-2.5 tabular-nums">{k.phone ? `+91 ${k.phone}` : "-"}</td>
                <td className="px-4 py-2.5">{k.email ?? "-"}</td>
                <td className="px-4 py-2.5">
                  {k.isPrimary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      <Star className="size-3" aria-hidden /> Primary
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                {canAddContact && (
                  <td className="px-4 py-1.5 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(i)} aria-label={`Edit ${k.name}`} title="Edit contact">
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const STATE_FILTERS: { key: ShopState | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "VALID", label: "Valid" },
  { key: "WARNING", label: "Warnings" },
  { key: "ERROR", label: "Errors" },
];
const sizeOf = (s: { width?: number; height?: number; unit?: string; quantity?: number }) =>
  s.width && s.height ? `${s.width} × ${s.height} ${s.unit ?? "ft"}${s.quantity && s.quantity > 1 ? ` × ${s.quantity}` : ""}` : "-";

/** Total Shops (auto-filled with the valid rows of the Excel, the BD may correct it) vs the valid rows; Verify locks in that they match. */
function VerifyPanel({ orderId, data, editable }: { orderId: string; data: HandoverState; editable: boolean }) {
  const toast = useToast();
  const setTotal = useSetShopTotal(orderId);
  const verify = useVerifyShops(orderId);
  const [total, setTotalText] = useState(data.declaredShopTotal ? String(data.declaredShopTotal) : "");
  const excel = data.shopList ? data.shopList.valid : null;
  const declared = data.declaredShopTotal;
  const match = declared !== null && excel !== null && declared === excel;
  const dirty = total !== (declared ? String(declared) : "");

  const save = () => {
    const n = Number(total);
    if (!Number.isInteger(n) || n < 1) return toast("Enter the total number of shops", "error");
    setTotal.mutateAsync(n).then(() => toast("Total Shops saved"), (e) => toast(errorMessage(e), "error"));
  };

  return (
    <div className={cn("rounded-xl border-2 p-4", data.verified ? "border-success/40 bg-success-soft/40" : match ? "border-brand/30 bg-brand-soft/30" : "border-warning/40 bg-warning-soft/40")}>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Total Shops" htmlFor="ho-total" hint="Auto-filled: valid rows" className="w-44">
          <Input
            id="ho-total"
            inputMode="numeric"
            maxLength={6}
            placeholder="e.g. 50"
            disabled={!editable}
            value={total}
            onChange={(e) => setTotalText(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          />
        </Field>
        {editable && dirty && (
          <Button variant="brand-outline" onClick={save} loading={setTotal.isPending}>
            Save Total
          </Button>
        )}
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-lg bg-surface px-3 py-2 shadow-soft">
            Total Shops <b className="tabular-nums">{declared ?? "-"}</b>
          </span>
          <span className={cn("font-bold", match ? "text-success" : "text-warning")}>{match ? "=" : "≠"}</span>
          <span className="rounded-lg bg-surface px-3 py-2 shadow-soft">
            Valid in Excel <b className="tabular-nums">{excel ?? "-"}</b>
          </span>
        </div>
        <div className="ml-auto">
          {data.verified ? (
            <Badge tone="success">
              <ShieldCheck className="size-3.5" aria-hidden /> Verified {formatDate(data.verified.at)}
              {data.verified.by ? ` by ${data.verified.by}` : ""}
            </Badge>
          ) : (
            editable && (
              <Button
                variant="brand"
                disabled={!match || dirty}
                loading={verify.isPending}
                title={!match ? "Total Shops and the valid rows in the Excel must match" : undefined}
                onClick={() => verify.mutateAsync(undefined).then(() => toast("Shop list verified"), (e) => toast(errorMessage(e), "error"))}
              >
                <ShieldCheck className="size-4" aria-hidden /> Verify Shop List
              </Button>
            )
          )}
        </div>
      </div>
      {!match && declared !== null && excel !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <CircleAlert className="size-3.5" aria-hidden /> The Excel has {excel} valid shop{excel === 1 ? "" : "s"} but Total Shops is {declared}. Correct the count or fix the rows and replace the file.
        </p>
      )}
      {excel === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <CircleAlert className="size-3.5" aria-hidden /> No valid rows in the Excel. Fix the rows marked below and upload the file again.
        </p>
      )}
      {data.shopList && data.shopList.total > (excel ?? 0) ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" aria-hidden /> Rows with warnings, errors or duplicates ({data.shopList.total - (excel ?? 0)}) are not counted in Total Shops. They stay in the list (marked below) for Client Servicing.
        </p>
      ) : null}
    </div>
  );
}

/** Shop + Measurement: the client's photos / documents for one shop. */
function RowFiles({ orderId, shop, editable }: { orderId: string; shop: HandoverShop; editable: boolean }) {
  const toast = useToast();
  const { add, remove } = useShopFiles(orderId);
  const busy = add.isPending && add.variables?.row === shop.rowNumber;
  return (
    <div className="flex min-w-48 flex-wrap items-center gap-1.5">
      {(shop.attachments ?? []).map((a) => (
        <AttachmentChip
          key={a.fileId}
          file={a}
          source={{ orderId }}
          onRemove={editable ? () => remove.mutateAsync({ row: shop.rowNumber, fileId: a.fileId }).then(() => toast("File removed"), (e) => toast(errorMessage(e), "error")) : undefined}
        />
      ))}
      {editable && (
        // relative: keeps the visually hidden input inside this label (see FileUploader).
        <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-brand/40 px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Camera className="size-3.5" aria-hidden />} Add
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
            className="sr-only"
            aria-label={`Add photos or documents for row ${shop.rowNumber}`}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length) return;
              add.mutateAsync({ row: shop.rowNumber, body: formData(files) }).then(() => toast(`${files.length} file${files.length === 1 ? "" : "s"} added to row ${shop.rowNumber}`), (err) => toast(errorMessage(err), "error"));
            }}
          />
        </label>
      )}
      {!editable && !(shop.attachments ?? []).length && <span className="text-xs text-muted-foreground">-</span>}
    </div>
  );
}

/** Shop list: template, upload (parsed with the project site import rules), Total Shops verification, summary and the rows. */
function ShopSection({ orderId, data, editable }: { orderId: string; data: HandoverState; editable: boolean }) {
  const measurement = data.type === "SHOP_MEASUREMENT";
  const toast = useToast();
  const [file, setFile] = useState<File[]>([]);
  const [state, setState] = useState<ShopState | "">("");
  const [page, setPage] = useState(1);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const upload = useUploadShopList(orderId);
  const remove = useRemoveShopList(orderId);
  const list = data.shopList;
  const rows = useHandoverShops(orderId, { page, limit: 25, state }, !!list);

  const doUpload = async () => {
    if (!file[0]) return;
    try {
      const r = await upload.mutateAsync(formData(file));
      setFile([]);
      setPage(1);
      setState("");
      toast(`Shop list uploaded: ${r.shopList?.valid ?? 0} valid of ${r.shopList?.total ?? 0} rows. Total Shops is filled in; verify it.`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const uploader = editable && (
    <div className="space-y-3">
      <FileUploader
        id="ho-shop-file"
        files={file}
        onChange={setFile}
        accept=".xlsx,.csv"
        hint={`Excel (.xlsx) or CSV, matched like the project site import.${measurement ? " Size (W x H) is required for every shop." : " No Size needed."}${list && data.shopFiles ? " Replacing removes the shop photos already added." : ""}`}
        compact={!!list}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" onClick={doUpload} disabled={!file[0]} loading={upload.isPending}>
          <Upload className="size-4" aria-hidden /> {list ? "Replace Shop List" : "Upload Shop List"}
        </Button>
        <Button variant="outline" onClick={() => downloadShopTemplate(measurement ? "SHOP_MEASUREMENT" : "SHOP_DETAILS").catch((e) => toast(errorMessage(e), "error"))}>
          <Download className="size-4" aria-hidden /> {measurement ? "Template (with Size)" : "Template (without Size)"}
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={Store}
        title={measurement ? "Shop Details + Measurement" : "Shop Details"}
        description={
          measurement
            ? "Shop list with Size (W x H). Total Shops fills in from the valid rows; verify it, then add the client's photos and documents to each shop."
            : "Shop list without sizes. Total Shops fills in from the valid rows; verify it."
        }
        action={
          list && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadFile(list.fileId, { orderId }, list.fileName).catch((e) => toast(errorMessage(e), "error"))}>
                <FileSpreadsheet className="size-4" aria-hidden /> {list.fileName}
              </Button>
              {editable && (
                <Button variant="outline" size="sm" className="border-danger/30 text-danger hover:bg-danger-soft" onClick={() => setConfirmRemove(true)}>
                  <Trash2 className="size-4" aria-hidden /> Remove
                </Button>
              )}
            </div>
          )
        }
      />
      {!list ? (
        editable ? (
          uploader
        ) : (
          <EmptyState icon={Store} title="No shop list" description="The BD did not share a shop list for this order." />
        )
      ) : (
        <div className="space-y-4">
          <VerifyPanel key={`${list.fileId}-${data.declaredShopTotal}`} orderId={orderId} data={data} editable={editable} />
          <div className={cn("grid gap-3 sm:grid-cols-3", measurement ? "xl:grid-cols-6" : "xl:grid-cols-5")}>
            {[
              { label: "Rows in Excel", value: list.total, icon: Store, tone: "bg-brand-soft text-brand" },
              { label: "Valid", value: list.valid, icon: CheckCircle2, tone: "bg-success-soft text-success" },
              { label: "With Warnings", value: list.warning, icon: AlertTriangle, tone: "bg-warning-soft text-warning" },
              { label: "With Errors", value: list.error, icon: XCircle, tone: "bg-danger-soft text-danger" },
              { label: "Duplicates", value: list.duplicates ?? 0, icon: Copy, tone: "bg-warning-soft text-warning" },
              ...(measurement ? [{ label: "Shops with Photos", value: data.shopsWithFiles, icon: Camera, tone: "bg-[#fff7ed] text-approval" }] : []),
            ].map((k) => (
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
          {list.error > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {list.error} row{list.error === 1 ? " has" : "s have"} errors (for example an invalid mobile number). {editable ? "Fix the file and replace it, or hand over as is." : "Clarify them with the BD."}
            </p>
          )}

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
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  state === f.key ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {rows.isPending ? (
              <RowsSkeleton rows={4} />
            ) : rows.isError ? (
              <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
            ) : (
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Row</th>
                      <th className="px-3 py-2.5">Shop / Dealer</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5">Mobile</th>
                      {measurement && <th className="px-3 py-2.5">Size</th>}
                      <th className="px-3 py-2.5">Status</th>
                      {measurement && <th className="px-3 py-2.5">Photos &amp; Documents</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.data?.data.length === 0 && (
                      <tr>
                        <td colSpan={measurement ? 7 : 5} className="px-3 py-6 text-center text-muted-foreground">
                          No shops in this filter.
                        </td>
                      </tr>
                    )}
                    {rows.data?.data.map((s) => (
                      <tr key={s.rowNumber} className="align-top">
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{s.rowNumber}</td>
                        <td className="px-3 py-2.5">
                          <span className="block font-medium">{s.shopName ?? s.dealerName ?? "-"}</span>
                          {s.shopName && s.dealerName && <span className="block text-xs text-muted-foreground">{s.dealerName}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block">{[s.location, s.district].filter(Boolean).join(", ") || "-"}</span>
                          {(s.address1 || s.address2) && <span className="block text-xs text-muted-foreground">{[s.address1, s.address2].filter(Boolean).join(", ")}</span>}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{s.mobile ?? "-"}</td>
                        {measurement && <td className="px-3 py-2.5 tabular-nums">{sizeOf(s)}</td>}
                        <td className="px-3 py-2.5">
                          <Badge tone={s.state === "VALID" ? "success" : s.state === "WARNING" ? "warning" : "danger"}>{s.state === "VALID" ? "Valid" : s.state === "WARNING" ? "Warning" : "Error"}</Badge>
                          {s.issues.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {s.issues.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        {measurement && (
                          <td className="px-3 py-2.5">
                            <RowFiles orderId={orderId} shop={s} editable={editable} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.data && rows.data.meta.totalPages > 1 && <Pagination meta={rows.data.meta} onPage={setPage} />}
          </div>
          {uploader}
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove the shop list?"
        description="The uploaded file and its shop rows are removed from this order. You can upload a new list later."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(undefined);
            toast("Shop list removed");
            setConfirmRemove(false);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </Card>
  );
}

/** Client documents. BD can add them before and after handover; deleting is possible only before handover. */
function DocumentsSection({ orderId, data, canAdd, canDelete }: { orderId: string; data: HandoverState; canAdd: boolean; canDelete: boolean }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const add = useAddHandoverDocs(orderId);
  const remove = useRemoveHandoverDoc(orderId);
  const docs = data.documents.filter((d) => d.kind === "DOCUMENT");
  const run = (p: Promise<unknown>) => p.catch((e) => toast(errorMessage(e), "error"));

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={Paperclip}
        title="Documents"
        description={data.assignee ? "Shared with Client Servicing. New documents can still be added." : "Optional: PO, briefs, artwork, shop photos, anything Client Servicing needs."}
      />
      {docs.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {docs.map((d) => (
            <li key={d._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <FileText className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.file.name ?? "Document"}</p>
                <p className="text-xs text-muted-foreground">
                  {d.file.size ? `${formatBytes(d.file.size)} · ` : ""}
                  {d.uploadedBy?.name ?? "-"} · {formatDateTime(d.createdAt)}
                  {d.afterHandover && <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">Added after handover</span>}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => run(openFile(d.file.fileId, { orderId }))} aria-label={`View ${d.file.name}`}>
                  <Eye className="size-4" aria-hidden /> View
                </Button>
                <Button variant="ghost" size="sm" onClick={() => run(downloadFile(d.file.fileId, { orderId }, d.file.name))} aria-label={`Download ${d.file.name}`}>
                  <Download className="size-4" aria-hidden />
                </Button>
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoveId(d._id)} aria-label={`Delete ${d.file.name}`}>
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <div className="space-y-3">
          <FileUploader id="ho-docs" files={files} onChange={setFiles} accept={DOC_ACCEPT} multiple hint="Up to 10 files at a time: PDF, images, Word, PowerPoint, Excel (old and new formats)." compact />
          <Button
            variant="brand-outline"
            disabled={!files.length}
            loading={add.isPending}
            onClick={async () => {
              try {
                await add.mutateAsync(formData(files));
                toast(`${files.length} document${files.length === 1 ? "" : "s"} added`);
                setFiles([]);
              } catch (e) {
                toast(errorMessage(e), "error");
              }
            }}
          >
            <Upload className="size-4" aria-hidden /> Upload {files.length > 1 ? `${files.length} Documents` : "Document"}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Delete this document?"
        description="The file is removed from this order and erased from storage."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(removeId!);
            toast("Document deleted");
            setRemoveId(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </Card>
  );
}

/** Pick the Client Servicing person and hand the order over (once; it cannot be reassigned). */
function AssignSection({ orderId, data, order, onAssigned }: { orderId: string; data: HandoverState; order: Order; onAssigned?: () => void }) {
  const toast = useToast();
  const users = useClientServicingUsers();
  const assign = useAssignClientServicing(orderId);
  const [query, setQuery] = useState("");
  const [cs, setCs] = useState<SearchOption | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const q = query.trim().toLowerCase();
  const options: SearchOption[] = (users.data ?? [])
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    .map((u) => ({ value: u._id, label: u.name, sublabel: [u.email, u.phone].filter(Boolean).join(" · ") }));
  const docs = data.documents.filter((d) => d.kind === "DOCUMENT").length;
  const voices = data.voiceNotes.length;
  const contacts = `${order.client.contacts.length} contact person${order.client.contacts.length === 1 ? "" : "s"}`;
  const ready = data.missing.length === 0;

  return (
    <Card className="border-brand/30 p-5 sm:p-6">
      <SectionTitle icon={Handshake} title="Assign to Client Servicing" description="After handover, Client Servicing handles this client. It cannot be reassigned." />
      {!ready && (
        <ul className="mb-4 space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
          {data.missing.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> {m}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Client Servicing Person" htmlFor="ho-cs" required error={error}>
          <SearchSelect
            id="ho-cs"
            value={cs}
            options={options}
            query={query}
            onQueryChange={setQuery}
            onSelect={(o) => {
              setCs(o);
              setQuery("");
              setError(undefined);
            }}
            onClear={() => setCs(null)}
            loading={users.isFetching}
            invalid={!!error}
            placeholder="Search Client Servicing team..."
            emptyText={users.isError ? `Could not load: ${errorMessage(users.error)}` : users.isPending ? "Loading..." : "No active Client Servicing users"}
          />
        </Field>
        <Field label="Note to Client Servicing" htmlFor="ho-note" hint="Optional: anything they should know before contacting the client.">
          <Textarea id="ho-note" className="min-h-11" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {data.full ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden /> {data.type ? HANDOVER_TYPES[data.type].label : "No type chosen"}: the client, {contacts}
            {data.type !== "ASO" && `, ${data.shopList ? `${data.shopList.total} shops` : "no shop list"}`}
            {data.type === "SHOP_MEASUREMENT" && `, ${data.shopFiles} shop photo${data.shopFiles === 1 ? "" : "s"}/document${data.shopFiles === 1 ? "" : "s"}`}, {voices} voice note{voices === 1 ? "" : "s"} and {docs} document{docs === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden /> Client details only: the client and {contacts}.
          </p>
        )}
        <Button variant="brand" disabled={!ready} onClick={() => (cs ? setConfirm(true) : setError("Choose the Client Servicing person"))}>
          <Send className="size-4" aria-hidden /> Assign to Client Servicing
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Hand ${order.orderNo} to ${cs?.label ?? ""}?`}
        confirmLabel="Assign"
        loading={assign.isPending}
        onConfirm={async () => {
          try {
            await assign.mutateAsync({ csUserId: cs!.value, note: note.trim() || undefined });
            toast(`${order.orderNo} handed over to ${cs!.label}. They have been notified.`);
            setConfirm(false);
            onAssigned?.();
          } catch (e) {
            setConfirm(false);
            toast(errorMessage(e), "error");
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          {cs?.label} gets a notification and handles {order.client.name} from here, and the lead is completed. You can still add documents and voice notes, but you
          cannot change the person or the shop list.
        </p>
      </ConfirmDialog>
    </Card>
  );
}

/** Handover status at the top of the tab. */
function StatusBanner({ data }: { data: HandoverState }) {
  if (!data.assignee || !data.handover)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-soft/50 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        {data.full ? (
          <p>
            <b>Not handed over yet.</b> Choose the handover type, complete what it needs (contacts for ASO; a verified shop list for the shop types), add notes,
            voice notes and documents, then assign the order to Client Servicing.
          </p>
        ) : (
          <p>
            <b>Not handed over yet.</b> Only the client details and contact persons go to Client Servicing. Add at least one contact person, then assign.
          </p>
        )}
      </div>
    );
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-success/30 bg-success-soft/60 px-4 py-3 text-sm">
      <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          Handed over to <b>{data.assignee.name}</b> on {formatDate(data.handover.assignedAt)}
          {data.handover.assignedBy?.name ? ` by ${data.handover.assignedBy.name}` : ""}.
        </p>
        {data.handover.note && <p className="mt-1 whitespace-pre-line text-muted-foreground">“{data.handover.note}”</p>}
      </div>
      {data.handover.seenAt ? (
        <Badge tone="success">
          <Users className="size-3.5" aria-hidden /> Opened {formatDate(data.handover.seenAt)}
        </Badge>
      ) : (
        <Badge tone="warning">Not opened yet</Badge>
      )}
    </div>
  );
}

/**
 * BD -> Client Servicing handover for one order. BD: check client & contacts, optional shop list and documents, then
 * assign. Client Servicing: the same details read-only.
 *
 * `mode="recce"` (Assign to Recce Team): the same handover details, always in full (no toggle), without the Client
 * Servicing assignment; `locked` once the Recce team has the project.
 */
export function HandoverTab({
  order,
  onAssigned,
  mode = "cs",
  locked = false,
  focus,
}: {
  order: Order;
  onAssigned?: () => void;
  mode?: "cs" | "recce";
  locked?: boolean;
  /** Section to scroll to (mind map step): "type" or "assign". */
  focus?: string | null;
}) {
  const { can } = useAuth();
  const q = useHandover(order._id);
  const canWrite = can("sales:write");
  // Toggle OFF has no type section (show the toggle); once handed over there is no assign form (show the client).
  const target = !focus ? null : focus === "type" && q.data?.full === false ? "ho-step-scope" : focus === "assign" && q.data?.assignee ? "ho-step-client" : `ho-step-${focus}`;
  useScrollTo(target, !q.isPending);
  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const recce = mode === "recce";
  // The Recce team always gets the full handover; the toggle is a Client Servicing option.
  const data = recce ? { ...q.data, full: true } : q.data;
  const open = !data.assignee && !locked; // before handover the BD can still change everything

  return (
    <div className="space-y-4">
      {!recce && <StatusBanner data={data} />}
      {!recce && canWrite && open && (
        <div id="ho-step-scope" className="scroll-mt-4">
          <ScopeSection orderId={order._id} data={data} editable />
        </div>
      )}
      <div id="ho-step-client" className="scroll-mt-4">
        <ClientSection order={order} canAddContact={canWrite && open && can("clients:write")} aso={data.full && data.type === "ASO"} />
      </div>
      <AnimatePresence initial={false}>
        {data.full && (
          <motion.div key="full" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div id="ho-step-type" className="scroll-mt-4">
              <TypeSection orderId={order._id} data={data} editable={canWrite && open} />
            </div>
            {data.type === "ASO" && data.shopList && open && (
              <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                <AlertTriangle className="size-4" aria-hidden /> A shop list was uploaded earlier. ASO hands over without one: remove it below, or choose a shop type.
              </p>
            )}
            {/* Shop types always show the list; otherwise it is shown only when one exists (older orders, or one to remove for ASO). */}
            {(data.type === "SHOP_DETAILS" || data.type === "SHOP_MEASUREMENT" || data.shopList) && <ShopSection orderId={order._id} data={data} editable={canWrite && open} />}
            <NotesSection orderId={order._id} data={data} editable={canWrite && open} canAddVoice={canWrite} />
            <DocumentsSection orderId={order._id} data={data} canAdd={canWrite} canDelete={canWrite && open} />
          </motion.div>
        )}
      </AnimatePresence>
      {!recce && canWrite && open && (
        <div id="ho-step-assign" className="scroll-mt-4">
          <AssignSection orderId={order._id} data={data} order={order} onAssigned={onAssigned} />
        </div>
      )}
      {!open && canWrite && !recce && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" aria-hidden /> Documents and voice notes can still be added; Client Servicing is notified of each one.
        </p>
      )}
    </div>
  );
}
