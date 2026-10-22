"use client";

import { useState } from "react";
import { FileClock, FileText } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { openFile } from "@/lib/api/files";
import { RATE_UNITS, type Revision, type RevisionChange } from "@/lib/api/ratecards";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE: Record<RevisionChange["changeType"], { tone: Tone; label: string }> = {
  ADDED: { tone: "info", label: "Added" },
  UPDATED: { tone: "success", label: "Updated" },
  REMOVED: { tone: "danger", label: "Removed" },
};
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));
const plain = (html?: string) => (html ?? "").replace(/<li>/gi, "\n• ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

/**
 * Revisions saved before field-level first-save history existed carry one summary row ("Rate Card: Created with N
 * item(s)"). Show their actual saved values instead, built from the revision itself.
 */
function changesOf(r: Revision): RevisionChange[] {
  if (!(r.changes.length === 1 && r.changes[0]!.field === "Rate Card")) return r.changes;
  const add = (field: string, v: unknown): RevisionChange[] => (v === null || v === undefined || v === "" ? [] : [{ field, oldValue: null, newValue: v, changeType: "ADDED" }]);
  return [
    ...add("Subject", r.subject),
    ...add("Quotation Date", r.quotationDate?.slice(0, 10)),
    ...add("Contact Person", r.contact?.name),
    ...add("Client Address", r.clientAddress),
    ...r.items.map((l): RevisionChange => ({
      field: `Item (${l.particulars})`,
      oldValue: null,
      newValue: [l.particulars, l.specifications, RATE_UNITS[l.unit] ?? l.unit, `Rs. ${l.quotedRate}`].filter(Boolean).join(" · ") + (l.overrideReason ? ` (reason: ${l.overrideReason})` : ""),
      changeType: "ADDED",
    })),
    ...add("Terms & Conditions", plain(r.terms)),
    ...add("Regards Name", r.regards?.name),
  ];
}

/** Edit History tab: revisions on the left, field-level changes of the selected revision on the right. */
export function EditHistory({ revisions }: { revisions: Revision[] }) {
  const toast = useToast();
  const [selected, setSelected] = useState<string>("all");
  if (!revisions.length) return <EmptyState icon={FileClock} title="No revisions yet" description="Each Save Changes creates a numbered revision with its own PDF." />;
  const shown = selected === "all" ? revisions : revisions.filter((r) => r._id === selected);
  const view = (r: Revision) => r.pdf?.fileId && openFile(r.pdf.fileId).catch((e) => toast(errorMessage(e), "error"));

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revision History</p>
        {revisions.map((r) => (
          <button
            key={r._id}
            type="button"
            onClick={() => setSelected(r._id)}
            className={cn("flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left", selected === r._id ? "border-brand bg-brand-soft/60" : "border-border hover:bg-muted/60")}
          >
            <FileText className="size-4 text-brand" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-bold">{r.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {formatDateTime(r.createdAt)} · {r.editedBy?.name}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-end">
          <div className="w-44">
            <Select aria-label="Filter revisions" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="all">All Revisions</option>
              {revisions.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Revision</th>
                <th className="px-3 py-2.5">Edited By</th>
                <th className="px-3 py-2.5">Edited Date &amp; Time</th>
                <th className="px-3 py-2.5">Changed Field</th>
                <th className="px-3 py-2.5">Previous Value</th>
                <th className="px-3 py-2.5">Updated Value</th>
                <th className="px-3 py-2.5">Change Type</th>
                <th className="px-3 py-2.5">View PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.flatMap((r) =>
                changesOf(r).map((c, i) => (
                  <tr key={`${r._id}-${i}`} className="align-top">
                    <td className="px-3 py-2.5 font-semibold">{r.label}</td>
                    <td className="px-3 py-2.5">{r.editedBy?.name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2.5 font-medium">{c.field}</td>
                    <td className="max-w-56 whitespace-pre-line px-3 py-2.5 text-muted-foreground">{show(c.oldValue)}</td>
                    <td className="max-w-56 whitespace-pre-line px-3 py-2.5">{show(c.newValue)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={TYPE[c.changeType].tone}>{TYPE[c.changeType].label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {i === 0 && r.pdf?.fileId ? (
                        <Button variant="ghost" size="sm" onClick={() => view(r)} aria-label={`View PDF ${r.label}`}>
                          <FileText className="size-4 text-brand" aria-hidden /> {r.label}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
