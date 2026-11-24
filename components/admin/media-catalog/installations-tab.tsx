"use client";

import { useMemo, useState } from "react";
import { Hammer, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useDeleteInstallation, useReorder, useUpdateInstallation } from "@/lib/api/catalog";
import { installationDeleteImpact, LIMITS, moveItem, plural, sortInstallations, usageOf } from "@/lib/catalog-rules";
import type { CatalogData, CatalogInstallation, CatalogUsage } from "@/types/catalog";
import { IconChip } from "./catalog-icons";
import { DeleteEntryDialog, EntryStatusBadge, ReorderButtons } from "./catalog-parts";
import { InstallationFormDialog } from "./installation-form";

/** Installation types: how a board is fixed (shop fascia, wall mount, pole ...). Order, active switch, edit, delete. */
export function InstallationsTab({ catalog, usage }: { catalog: CatalogData; usage: CatalogUsage | undefined }) {
  const toast = useToast();
  const update = useUpdateInstallation();
  const del = useDeleteInstallation();
  const reorder = useReorder();
  const [form, setForm] = useState<CatalogInstallation | "new" | null>(null);
  const [deleting, setDeleting] = useState<CatalogInstallation | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const rows = useMemo(() => sortInstallations(catalog.installations), [catalog.installations]);
  const offeredBy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of catalog.media) for (const c of m.installations) counts.set(c, (counts.get(c) ?? 0) + 1);
    return counts;
  }, [catalog.media]);
  const atLimit = rows.length >= LIMITS.installations;
  const boards = (code: string) => (usage ? String(usageOf(usage, "installations", code)) : "-");

  async function move(index: number, dir: -1 | 1) {
    const ids = moveItem(rows.map((i) => i.code), index, dir);
    if (!ids) return;
    try {
      await reorder.mutateAsync({ kind: "installations", ids });
      toast("Order saved");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function toggle(i: CatalogInstallation) {
    setToggling(i.code);
    try {
      await update.mutateAsync({ code: i.code, patch: { active: !i.active } });
      toast(`${i.name} is now ${i.active ? "inactive" : "active"}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setToggling(null);
    }
  }

  const impact = deleting ? installationDeleteImpact(deleting.code, catalog.media, catalog.questions) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft" aria-label="Installation types">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">{plural(rows.length, "installation type")}. Each media type chooses which of them it offers.</p>
        <Button className="ml-auto bg-royal hover:bg-royal/90" onClick={() => setForm("new")} disabled={atLimit} title={atLimit ? `The catalog can hold ${LIMITS.installations} installation types` : undefined}>
          <Plus className="size-4" aria-hidden /> Add installation type
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Hammer} title="No installation types yet" description="Add the first one, or use Load built-in defaults at the top to bring back the standard list." action={<Button className="bg-royal hover:bg-royal/90" onClick={() => setForm("new")}><Plus className="size-4" aria-hidden /> Add installation type</Button>} />
      ) : (
        <div className="max-h-[62dvh] overflow-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">Order</span></th>
                <th scope="col" className="px-3 py-2">Installation type</th>
                <th scope="col" className="hidden w-28 px-3 py-2 text-right lg:table-cell">Media types</th>
                <th scope="col" className="hidden w-24 px-3 py-2 text-right lg:table-cell">Boards</th>
                <th scope="col" className="w-44 px-3 py-2">Status</th>
                <th scope="col" className="w-24 px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((i, index) => (
                <tr key={i.code} className={i.active ? undefined : "bg-muted/40"}>
                  <td className="px-3 py-2">
                    <ReorderButtons index={index} count={rows.length} name={i.name} onMove={(d) => void move(index, d)} disabled={reorder.isPending} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconChip icon={i.icon} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy" title={i.name}>{i.name}</p>
                        <p className="truncate text-xs text-muted-foreground" title={i.description || undefined}>
                          <span className="font-mono">{i.code}</span>{i.description ? ` · ${i.description}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground lg:hidden">{plural(offeredBy.get(i.code) ?? 0, "media type")} · {boards(i.code)} boards</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell" title="Media types that offer it">{offeredBy.get(i.code) ?? 0}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell" title="Boards of recorded recces that use it">{boards(i.code)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Switch checked={i.active} onChange={() => void toggle(i)} label={`Active: ${i.name}`} disabled={toggling === i.code} title={i.active ? "Active: click to make it inactive" : "Inactive: click to make it active"} />
                      <EntryStatusBadge status={i.active ? "active" : "inactive"} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" aria-label={`Edit ${i.name}`} title="Edit" onClick={() => setForm(i)}><Pencil className="size-4" aria-hidden /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${i.name}`} title="Delete" onClick={() => setDeleting(i)}><Trash2 className="size-4 text-danger" aria-hidden /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <InstallationFormDialog key={form === "new" ? "new" : form.code} installation={form === "new" ? null : form} catalog={catalog} onClose={() => setForm(null)} />}
      {deleting && impact && (
        <DeleteEntryDialog
          key={deleting.code}
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            const r = await del.mutateAsync(deleting.code);
            toast(`${deleting.name} deleted: removed from ${plural(r.removedFromMedia, "media type")}, ${plural(r.questionsDeleted, "site question")} deleted`);
          }}
          {...(deleting.active
            ? {
                onMarkInactive: async () => {
                  await update.mutateAsync({ code: deleting.code, patch: { active: false } });
                  toast(`${deleting.name} marked inactive`);
                },
              }
            : {})}
        >
          <p>
            Deleting <strong className="text-foreground">{deleting.name}</strong> removes it from{" "}
            <strong className="text-foreground">{plural(impact.media, "media type")}</strong> and deletes its{" "}
            <strong className="text-foreground">{plural(impact.questions, "site question")}</strong>.
          </p>
          {usage && usageOf(usage, "installations", deleting.code) > 0 && (
            <p className="font-medium text-danger">{plural(usageOf(usage, "installations", deleting.code), "recorded board")} already use it, so the server will refuse. You can mark it inactive instead.</p>
          )}
          <p>Boards already recorded keep the names and answers they were saved with.</p>
        </DeleteEntryDialog>
      )}
    </section>
  );
}
