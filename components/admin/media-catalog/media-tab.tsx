"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Pencil, Plus, Search, Shapes, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useDeleteMedia, useReorder, useUpdateMedia } from "@/lib/api/catalog";
import { cleanText, filterMedia, LIMITS, mediaDeleteImpact, mediaStatus, moveItem, plural, SIDEDNESS_LABEL, sortMedia, usageOf } from "@/lib/catalog-rules";
import type { CatalogData, CatalogMedia, CatalogUsage } from "@/types/catalog";
import { IconChip } from "./catalog-icons";
import { DeleteEntryDialog, EntryStatusBadge, ReorderButtons } from "./catalog-parts";
import { MediaFormDrawer } from "./media-form";

/** Media types: the cards the field person picks a board from. Order, active switch, edit, delete. */
export function MediaTab({ catalog, usage }: { catalog: CatalogData; usage: CatalogUsage | undefined }) {
  const toast = useToast();
  const update = useUpdateMedia();
  const del = useDeleteMedia();
  const reorder = useReorder();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CatalogMedia | "new" | null>(null);
  const [deleting, setDeleting] = useState<CatalogMedia | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const all = useMemo(() => sortMedia(catalog.media), [catalog.media]);
  const rows = useMemo(() => filterMedia(all, search), [all, search]);
  const installName = useMemo(() => new Map(catalog.installations.map((i) => [i.code, i.name])), [catalog.installations]);
  const searching = search.trim() !== "";
  const atLimit = all.length >= LIMITS.media;
  const boards = (code: string) => (usage ? String(usageOf(usage, "media", code)) : "-");

  async function move(index: number, dir: -1 | 1) {
    const ids = moveItem(all.map((m) => m.code), index, dir);
    if (!ids) return;
    try {
      await reorder.mutateAsync({ kind: "media", ids });
      toast("Order saved");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function toggle(m: CatalogMedia) {
    setToggling(m.code);
    try {
      await update.mutateAsync({ code: m.code, patch: { active: !m.active } });
      toast(`${m.name} is now ${m.active ? "inactive" : "active"}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setToggling(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft" aria-label="Media types">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-52 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" aria-label="Search media types" placeholder="Search code, short name or name" maxLength={100} value={search} onChange={(e) => setSearch(cleanText(e.target.value, 100))} />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">{searching ? `${rows.length} of ${all.length}` : plural(all.length, "media type")}</p>
        <Button className="ml-auto bg-royal hover:bg-royal/90" onClick={() => setForm("new")} disabled={atLimit} title={atLimit ? `The catalog can hold ${LIMITS.media} media types` : undefined}>
          <Plus className="size-4" aria-hidden /> Add media type
        </Button>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={Shapes} title="No media types yet" description="Add the first one, or use Load built-in defaults at the top to bring back the standard list." action={<Button className="bg-royal hover:bg-royal/90" onClick={() => setForm("new")}><Plus className="size-4" aria-hidden /> Add media type</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Search} title="No media type matches your search" description={`Nothing matches "${search.trim()}".`} action={<Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>} />
      ) : (
        <div className="max-h-[62dvh] overflow-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">Order</span></th>
                <th scope="col" className="px-3 py-2">Media type</th>
                <th scope="col" className="hidden px-3 py-2 lg:table-cell">Sides</th>
                <th scope="col" className="hidden w-20 px-3 py-2 lg:table-cell">Lit</th>
                <th scope="col" className="hidden w-24 px-3 py-2 text-right lg:table-cell">Methods</th>
                <th scope="col" className="hidden w-24 px-3 py-2 text-right lg:table-cell">Boards</th>
                <th scope="col" className="w-44 px-3 py-2">Status</th>
                <th scope="col" className="w-24 px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((m) => {
                const index = all.findIndex((x) => x.code === m.code);
                const methods = m.installations.map((c) => installName.get(c) ?? c);
                return (
                  <tr key={m.code} className={m.active || m.legacy ? undefined : "bg-muted/40"}>
                    <td className="px-3 py-2">
                      <ReorderButtons index={index} count={all.length} name={m.name} onMove={(d) => void move(index, d)} disabled={searching || reorder.isPending} disabledReason={searching ? "Clear the search to change the order" : undefined} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <IconChip icon={m.icon} color={m.color} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-navy" title={m.name}>{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground" title={m.description || undefined}>
                            <span className="font-mono">{m.code}</span> · {m.shortName}{m.description ? ` · ${m.description}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground lg:hidden">
                            {SIDEDNESS_LABEL[m.sidedness].split(" (")[0]}{m.illuminated ? " · Lit" : ""} · {plural(m.installations.length, "method")} · {boards(m.code)} boards
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 lg:table-cell"><Badge tone="primary" title={SIDEDNESS_LABEL[m.sidedness]}>{SIDEDNESS_LABEL[m.sidedness].split(" (")[0]}</Badge></td>
                    <td className="hidden px-3 py-2 lg:table-cell">
                      {m.illuminated ? <span className="inline-flex items-center gap-1 text-warning"><Lightbulb className="size-4" aria-hidden /> Yes</span> : <span className="text-muted-foreground">No</span>}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell" title={methods.length ? methods.join(", ") : "No installation method offered"}>{m.installations.length}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell" title="Boards of recorded recces that use it">{boards(m.code)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={m.legacy ? false : m.active}
                          onChange={() => void toggle(m)}
                          label={`Active: ${m.name}`}
                          disabled={m.legacy || toggling === m.code}
                          title={m.legacy ? "Legacy media are never offered for new boards" : m.active ? "Active: click to make it inactive" : "Inactive: click to make it active"}
                        />
                        <EntryStatusBadge status={mediaStatus(m)} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${m.name}`} title="Edit" onClick={() => setForm(m)}><Pencil className="size-4" aria-hidden /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${m.name}`} title="Delete" onClick={() => setDeleting(m)}><Trash2 className="size-4 text-danger" aria-hidden /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && <MediaFormDrawer key={form === "new" ? "new" : form.code} media={form === "new" ? null : form} catalog={catalog} onClose={() => setForm(null)} />}
      {deleting && (
        <DeleteEntryDialog
          key={deleting.code}
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            const r = await del.mutateAsync(deleting.code);
            toast(`${deleting.name} deleted${r.questionsDeleted ? ` together with ${plural(r.questionsDeleted, "site question")}` : ""}`);
          }}
          {...(!deleting.legacy && deleting.active
            ? {
                onMarkInactive: async () => {
                  await update.mutateAsync({ code: deleting.code, patch: { active: false } });
                  toast(`${deleting.name} marked inactive`);
                },
              }
            : {})}
        >
          <p>
            Deleting <strong className="text-foreground">{deleting.name}</strong> removes it from the catalog
            {mediaDeleteImpact(deleting.code, catalog.questions).questions > 0 ? ` and deletes its ${plural(mediaDeleteImpact(deleting.code, catalog.questions).questions, "site question")}` : ""}.
          </p>
          {usage && usageOf(usage, "media", deleting.code) > 0 && (
            <p className="font-medium text-danger">{plural(usageOf(usage, "media", deleting.code), "recorded board")} already use it, so the server will refuse. You can mark it inactive instead.</p>
          )}
          <p>Boards already recorded keep the names and answers they were saved with.</p>
        </DeleteEntryDialog>
      )}
    </section>
  );
}
