"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Handshake,
  Info,
  Paperclip,
  RefreshCw,
  Send,
  Star,
  Store,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
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
  downloadShopTemplate,
  useAddHandoverDocs,
  useAssignClientServicing,
  useClientServicingUsers,
  useHandover,
  useHandoverShops,
  useRemoveHandoverDoc,
  useRemoveShopList,
  useUploadShopList,
  type HandoverState,
  type Order,
  type ShopState,
} from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx,.csv";

/** Company and contact persons, straight from Client Management (nothing to type again). */
function ClientSection({ order }: { order: Order }) {
  const c = order.client;
  const address = [c.address, c.city, c.state].filter(Boolean).join(", ") + (c.pincode ? ` - ${c.pincode}` : "");
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle icon={Building2} title="Client & Contact Persons" description="Auto-filled from Client Management." />
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Company Name">{c.name}</DetailItem>
        <DetailItem label="Client ID">
          <span className="font-mono text-brand">{c.clientNo ?? c.code}</span>
        </DetailItem>
        <DetailItem label="Company Email">{c.email}</DetailItem>
        <DetailItem label="GST Number">{c.gstin}</DetailItem>
        <DetailItem label="Address" className="sm:col-span-2 xl:col-span-4">
          {address}
        </DetailItem>
      </dl>
      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Contact Person</th>
              <th className="px-4 py-2.5">Designation</th>
              <th className="px-4 py-2.5">Mobile</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Primary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {c.contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No contact persons. Add them in Client Management.
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

/** Optional shop list: template, upload (parsed with the project site import rules), summary and the rows. */
function ShopSection({ orderId, data, editable }: { orderId: string; data: HandoverState; editable: boolean }) {
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
      toast(`Shop list uploaded: ${r.shopList?.total ?? 0} shops${r.shopList?.error ? `, ${r.shopList.error} with errors` : ""}.`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const uploader = editable && (
    <div className="space-y-3">
      <FileUploader id="ho-shop-file" files={file} onChange={setFile} accept=".xlsx,.csv" hint="Excel (.xlsx) or CSV. Columns are matched automatically, like the project site import." compact={!!list} />
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" onClick={doUpload} disabled={!file[0]} loading={upload.isPending}>
          <Upload className="size-4" aria-hidden /> {list ? "Replace Shop List" : "Upload Shop List"}
        </Button>
        <Button variant="outline" onClick={() => downloadShopTemplate().catch((e) => toast(errorMessage(e), "error"))}>
          <Download className="size-4" aria-hidden /> Download Template
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={Store}
        title="Shop Details"
        description="Optional. Skip it for ASO orders where the shop count is not known yet."
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
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Total Shops", value: list.total, icon: Store, tone: "bg-brand-soft text-brand" },
              { label: "Valid", value: list.valid, icon: CheckCircle2, tone: "bg-success-soft text-success" },
              { label: "With Warnings", value: list.warning, icon: AlertTriangle, tone: "bg-warning-soft text-warning" },
              { label: "With Errors", value: list.error, icon: XCircle, tone: "bg-danger-soft text-danger" },
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
                      <th className="px-3 py-2.5">Size</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.data?.data.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
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
                        <td className="px-3 py-2.5 tabular-nums">{sizeOf(s)}</td>
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
          <FileUploader id="ho-docs" files={files} onChange={setFiles} accept={DOC_ACCEPT} multiple hint="Up to 10 files at a time: PDF, images, Word, PowerPoint, Excel." compact />
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
function AssignSection({ orderId, data, order }: { orderId: string; data: HandoverState; order: Order }) {
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

  return (
    <Card className="border-brand/30 p-5 sm:p-6">
      <SectionTitle icon={Handshake} title="Assign to Client Servicing" description="After handover, Client Servicing handles this client. It cannot be reassigned." />
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
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" aria-hidden /> Shares the client, {order.client.contacts.length} contact person{order.client.contacts.length === 1 ? "" : "s"}, {data.shopList ? `${data.shopList.total} shops` : "no shop list"} and {docs} document{docs === 1 ? "" : "s"}.
        </p>
        <Button variant="brand" onClick={() => (cs ? setConfirm(true) : setError("Choose the Client Servicing person"))}>
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
          } catch (e) {
            setConfirm(false);
            toast(errorMessage(e), "error");
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          {cs?.label} gets a notification and handles {order.client.name} from here. You keep the rate card and can still add documents, but you cannot change the
          person or the shop list.
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
        <p>
          <b>Not handed over yet.</b> Check the client details, add the shop list and documents if you have them (both optional), then assign the order to Client
          Servicing.
        </p>
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
 */
export function HandoverTab({ order }: { order: Order }) {
  const { can } = useAuth();
  const q = useHandover(order._id);
  const canWrite = can("sales:write");
  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data;
  const open = !data.assignee; // before handover the BD can still change everything

  return (
    <div className="space-y-4">
      <StatusBanner data={data} />
      <ClientSection order={order} />
      <ShopSection orderId={order._id} data={data} editable={canWrite && open} />
      <DocumentsSection orderId={order._id} data={data} canAdd={canWrite} canDelete={canWrite && open} />
      {canWrite && open && <AssignSection orderId={order._id} data={data} order={order} />}
      {!open && canWrite && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" aria-hidden /> The rate card stays with you: keep negotiating and download new PDFs from the Rate Card tab.
        </p>
      )}
    </div>
  );
}
