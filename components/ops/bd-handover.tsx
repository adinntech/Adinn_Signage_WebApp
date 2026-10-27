"use client";

import { useState } from "react";
import { Building2, ClipboardList, Download, FileSpreadsheet, Hash, Mic, NotebookPen, Paperclip, Star } from "lucide-react";
import { VoiceNoteList } from "@/components/orders/voice-notes";
import { AttachmentChip } from "@/components/sales/order-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile } from "@/lib/api/files";
import { useProjectHandoverShops, type ProjectHandover } from "@/lib/api/recce";
import { HANDOVER_TYPES } from "@/lib/api/sales";
import { formatDate } from "@/lib/format";

const STATE_TONE = { VALID: "success", WARNING: "warning", ERROR: "danger" } as const;
const size = (s: { width?: number; height?: number; unit?: string }) => (s.width && s.height ? `${s.width} × ${s.height} ${s.unit ?? ""}`.trim() : "-");

function ShopRows({ projectId, total, sized }: { projectId: string; total: number; sized: boolean }) {
  const [page, setPage] = useState(1);
  const q = useProjectHandoverShops(projectId, { page, limit: 25 });
  if (q.isPending) return <RowsSkeleton rows={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Row</th>
              <th className="px-3 py-2.5">Shop</th>
              <th className="px-3 py-2.5">Location</th>
              <th className="px-3 py-2.5">Mobile</th>
              {sized && <th className="px-3 py-2.5">Size</th>}
              <th className="px-3 py-2.5">Check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.data.data.map((s) => (
              <tr key={s.rowNumber} className="align-top">
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{s.rowNumber}</td>
                <td className="px-3 py-2.5 font-medium">
                  {s.shopName ?? "-"}
                  {s.attachments?.length ? <span className="block text-xs font-normal text-muted-foreground">{s.attachments.length} photo / document{s.attachments.length === 1 ? "" : "s"}</span> : null}
                </td>
                <td className="px-3 py-2.5">{[s.location, s.district].filter(Boolean).join(", ") || "-"}</td>
                <td className="px-3 py-2.5 tabular-nums">{s.mobile ?? "-"}</td>
                {sized && <td className="px-3 py-2.5">{size(s)}</td>}
                <td className="px-3 py-2.5">
                  <Badge tone={STATE_TONE[s.state]}>{s.state === "VALID" ? "Valid" : s.state === "WARNING" ? "Check" : "Error"}</Badge>
                  {s.issues.length > 0 && <span className="mt-1 block text-xs text-muted-foreground">{s.issues.join("; ")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 25 && (
        <div className="border-t border-border px-3 py-2">
          <Pagination meta={q.data.meta} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

/** Operations project > BD Handover: what the BD handed over in Lead Management (read-only). */
export function BdHandover({ projectId, h }: { projectId: string; h: ProjectHandover }) {
  const toast = useToast();
  const source = { projectId };
  const docs = h.documents.filter((d) => d.kind === "DOCUMENT");
  const c = h.client;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle icon={Hash} title="Codes & Assignment" description={`From BD order ${h.orderNo}`} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Project Code">
            <span className="font-mono text-base">{h.projectCode}</span>
          </DetailItem>
          <DetailItem label="Estimation Code">
            <span className="font-mono text-base">{h.estimationCode}</span>
          </DetailItem>
          <DetailItem label="Assigned">{h.assignedAt ? `${formatDate(h.assignedAt)}${h.assignedBy ? ` by ${h.assignedBy}` : ""}` : null}</DetailItem>
          <DetailItem label="Handover Type">{h.type ? HANDOVER_TYPES[h.type].label : null}</DetailItem>
          {h.note && (
            <DetailItem label="Note from BD" className="sm:col-span-2 lg:col-span-4">
              <span className="whitespace-pre-line">{h.note}</span>
            </DetailItem>
          )}
        </dl>
      </Card>

      {c && (
        <Card className="p-5">
          <SectionTitle icon={Building2} title="Client & Contact Persons" />
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Company Name">{c.name}</DetailItem>
            <DetailItem label="Client Name">{c.clientName}</DetailItem>
            <DetailItem label="Client ID">{c.clientNo}</DetailItem>
            <DetailItem label="Company Email">{c.email}</DetailItem>
            <DetailItem label="Phone Number">{c.phone}</DetailItem>
            <DetailItem label="GST Number">{c.gstin}</DetailItem>
            {!!c.gstCertificates?.length && (
              <DetailItem label="GST Certificate" className="sm:col-span-2 lg:col-span-3">
                <span className="flex flex-wrap gap-1.5">
                  {c.gstCertificates.map((f) => (
                    <AttachmentChip key={f.fileId} file={f} source={source} />
                  ))}
                </span>
              </DetailItem>
            )}
            {(c.customFields ?? []).map((f) => (
              <DetailItem key={f.label} label={f.label}>
                {f.value}
              </DetailItem>
            ))}
          </dl>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {c.contacts.map((k, i) => (
              <li key={`${k.name}-${i}`} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  {k.name}
                  {k.isPrimary && <Star className="size-3.5 fill-current text-brand" aria-label="Primary" />}
                  {k.designation && <span className="font-normal text-muted-foreground">· {k.designation}</span>}
                </p>
                <p className="text-muted-foreground">{[k.phone ? `+91 ${k.phone}` : null, k.email].filter(Boolean).join(" · ") || "-"}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={NotebookPen} title="Additional Notes" />
          <p className="whitespace-pre-line rounded-lg bg-muted/40 px-3 py-2 text-sm">{h.notes || <span className="text-muted-foreground">No notes.</span>}</p>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={Mic} title="Voice Notes" />
          <VoiceNoteList notes={h.voiceNotes} source={source} />
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle icon={Paperclip} title="Documents" />
        {docs.length ? (
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <AttachmentChip key={d._id} file={d.file} source={source} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No documents.</p>
        )}
      </Card>

      {h.shopList && (
        <Card className="p-5">
          <SectionTitle
            icon={FileSpreadsheet}
            title="Shop List from BD"
            description={`${h.declaredShopTotal ?? h.shopList.valid} shops (valid) · ${h.shopList.total} rows · ${h.shopList.warning} to check · ${h.shopList.error} with errors${h.type === "SHOP_MEASUREMENT" ? ` · ${h.shopFiles} shop photos / documents` : ""}`}
            action={
              <Button variant="outline" size="sm" onClick={() => downloadFile(h.shopList!.fileId, source, h.shopList!.fileName).catch((e) => toast(errorMessage(e), "error"))}>
                <Download className="size-4" aria-hidden /> Excel
              </Button>
            }
          />
          <ShopRows projectId={projectId} total={h.shopList.total} sized={h.type === "SHOP_MEASUREMENT"} />
        </Card>
      )}
      {!h.shopList && h.type === "ASO" && <EmptyState icon={ClipboardList} title="ASO handover" description="No shop list: the shops are collected from the client contacts during the survey." />}
    </div>
  );
}
