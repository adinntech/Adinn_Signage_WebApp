"use client";

import { useRef, useState } from "react";
import { BookUser, Building2, CheckCircle2, Download, FolderInput, Pencil, Plus, Search, Store, Trash2, Upload, UserRound, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SortHeader, nextSort, type SortState } from "@/components/ui/sort-header";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  downloadContactSample, useAddContact, useBulkContacts, useContactGroups, useDeleteContact, useEditContact, useImportContacts, useMailContacts,
  type BulkInput, type ContactSortKey, type ImportResult, type MailContact,
} from "@/lib/api/mailContacts";
import { useMailRouting, type RoutingKey } from "@/lib/api/mailSettings";
import { RoutingCard } from "./mail-settings-page";

type Section = "BOOK" | RoutingKey;
const SECTIONS = [
  { key: "BOOK", label: "Address book", icon: BookUser },
  { key: "PROJECT_CODE", label: "Project code mail", icon: Building2 },
  { key: "CLIENT_CODE", label: "Client code mail", icon: UserRound },
  { key: "VENDOR_REGISTRATION", label: "Vendor registration mail", icon: Store },
];

/** Admin panel: the address book behind the To / Cc / Bcc suggestions, and who each request email goes to (To and Cc kept separately). */
export function MailContactsPage() {
  const { can } = useAuth();
  const canEdit = can("mail:manage");
  const [section, setSection] = useState<Section>("BOOK");
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-navy"><BookUser className="size-5 text-royal" aria-hidden /> Mail contacts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">The address book behind the suggestions, and the To and Cc of the project code, client code and vendor registration emails. Nothing is fixed in the code.</p>
      </header>
      <Tabs label="Mail contacts sections" value={section} onChange={(k) => setSection(k as Section)} tabs={SECTIONS} />
      <TabPanel k={section}>
        {section === "BOOK" ? <AddressBook canEdit={canEdit} /> : <RoutingSection routingKey={section} canEdit={canEdit} />}
      </TabPanel>
    </div>
  );
}

/** The To / Cc / Bcc of one kind of request email; the boxes suggest addresses from the address book. */
function RoutingSection({ routingKey, canEdit }: { routingKey: RoutingKey; canEdit: boolean }) {
  const q = useMailRouting();
  if (q.isPending) return <RowsSkeleton rows={5} className="p-4" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the recipients" />;
  const r = q.data.find((x) => x.key === routingKey);
  if (!r) return null;
  return (
    <div className="max-w-2xl space-y-3">
      <RoutingCard key={`${r.key}-${r.to.join()}-${r.cc.join()}-${r.bcc.join()}-${r.replyTo}-${r.autoConfirm}-${r.isDefault}`} r={r} canEdit={canEdit} />
      {!canEdit && <p className="rounded-lg bg-[#eef4ff] p-3 text-sm text-navy">Only an administrator can change these.</p>}
    </div>
  );
}

function AddressBook({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState<SortState<ContactSortKey>>({ key: "email", dir: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const list = useMailContacts({ q, status, group, page, limit, sort: sort.key, dir: sort.dir });
  const groups = useContactGroups().data ?? [];
  const edit = useEditContact();
  const remove = useDeleteContact();
  const bulk = useBulkContacts();
  const importer = useImportContacts();
  const [form, setForm] = useState<MailContact | "new" | null>(null);
  const [deleting, setDeleting] = useState<MailContact | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** true: the action covers every contact the filter shows, not only the ticked ones. */
  const [allMatching, setAllMatching] = useState(false);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [regroup, setRegroup] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const rows = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  const count = allMatching ? total : picked.size;
  const pageAll = rows.length > 0 && rows.every((c) => picked.has(c.id));
  const filtered = !!(q || status || group);
  const clearPick = () => { setPicked(new Set()); setAllMatching(false); };
  /** A new filter or search starts a new selection. */
  const refine = (fn: () => void) => { fn(); setPage(1); clearPick(); };
  const onSort = (k: ContactSortKey) => { setSort(nextSort(sort, k)); setPage(1); };

  function onFile(f: File | undefined) {
    if (!f) return;
    importer.mutate(f, {
      onSuccess: (r) => { setResult(r); toast(`${r.added} added, ${r.updated} updated`); },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  }
  function runBulk(action: BulkInput["action"], extra: Partial<BulkInput> = {}, done?: string) {
    const target: Partial<BulkInput> = allMatching ? { filter: { q, ...(status ? { status } : {}), ...(group ? { group } : {}) } } : { ids: [...picked] };
    bulk.mutate({ action, ...target, ...extra } as BulkInput, {
      onSuccess: (r) => { toast(`${done ?? "Done"}: ${r.matched} contact${r.matched === 1 ? "" : "s"}`); clearPick(); setBulkDelete(false); setRegroup(false); },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  }
  function toggleRow(id: string) {
    setAllMatching(false);
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function togglePage() {
    setAllMatching(false);
    setPicked((p) => { const n = new Set(p); for (const c of rows) { if (pageAll) n.delete(c.id); else n.add(c.id); } return n; });
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => void downloadContactSample().catch((e) => toast(errorMessage(e), "error"))}><Download className="size-4" aria-hidden /> Sample sheet</Button>
          <input ref={file} type="file" hidden accept=".xlsx,.csv" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="outline" loading={importer.isPending} onClick={() => file.current?.click()}><Upload className="size-4" aria-hidden /> Import Excel / CSV</Button>
          <Button className="bg-royal hover:bg-royal/90" onClick={() => setForm("new")}><Plus className="size-4" aria-hidden /> Add contact</Button>
        </div>
      )}

      {result && (
        <section className="rounded-xl border border-border bg-surface p-4 text-sm shadow-soft" role="status">
          <p className="font-semibold text-navy">Import finished: {result.added} added, {result.updated} updated, {result.skipped.length} skipped.</p>
          {result.skipped.length > 0 && (
            <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted-foreground">
              {result.skipped.map((s) => <li key={`${s.row}-${s.email}`}>Row {s.row}: {s.email || "(empty)"}, {s.reason}</li>)}
            </ul>
          )}
          <button className="mt-2 text-xs font-semibold text-royal hover:underline" onClick={() => setResult(null)}>Dismiss</button>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-52 max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" aria-label="Search contacts" placeholder="Search name, email or group" maxLength={100} value={search} onChange={(e) => refine(() => setSearch(e.target.value))} />
          </div>
          <div className="w-36">
            <Select aria-label="Status" value={status} onChange={(e) => refine(() => setStatus(e.target.value as typeof status))}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div className="w-44">
            <Select aria-label="Group" value={group} onChange={(e) => refine(() => setGroup(e.target.value))}>
              <option value="">All groups</option>
              <option value="none">No group</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </div>
          {filtered && <button className="text-xs font-semibold text-royal hover:underline" onClick={() => refine(() => { setSearch(""); setStatus(""); setGroup(""); })}>Clear filters</button>}
        </div>

        {canEdit && count > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-[#eef4ff] px-4 py-2 text-sm" role="status">
            <span className="font-semibold text-navy">{count} selected</span>
            {!allMatching && pageAll && total > rows.length && (
              <button className="text-xs font-semibold text-royal hover:underline" onClick={() => setAllMatching(true)}>Select all {total} {filtered ? "matching " : ""}contacts</button>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" loading={bulk.isPending && bulk.variables?.action === "activate"} onClick={() => runBulk("activate", {}, "Activated")}><CheckCircle2 className="size-4 text-success" aria-hidden /> Activate</Button>
              <Button size="sm" variant="outline" loading={bulk.isPending && bulk.variables?.action === "deactivate"} onClick={() => runBulk("deactivate", {}, "Deactivated")}><XCircle className="size-4" aria-hidden /> Deactivate</Button>
              <Button size="sm" variant="outline" onClick={() => setRegroup(true)}><FolderInput className="size-4" aria-hidden /> Set group</Button>
              <Button size="sm" variant="outline" className="text-danger" onClick={() => setBulkDelete(true)}><Trash2 className="size-4" aria-hidden /> Delete</Button>
              <button className="text-xs font-semibold text-muted-foreground hover:underline" onClick={clearPick}>Clear</button>
            </span>
          </div>
        )}

        {list.isPending ? (
          <RowsSkeleton rows={6} className="p-4" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} title="Could not load the contacts" />
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{filtered ? "No contact matches your search or filters." : "No contacts yet. Add one, or import an Excel sheet."}</p>
        ) : (
          <div className="max-h-[60dvh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-secondary text-xs tracking-wide text-muted-foreground">
                <tr>
                  {canEdit && (
                    <th scope="col" className="w-10 px-4 py-2">
                      <input type="checkbox" className="size-4 accent-royal" aria-label="Select all contacts on this page" checked={pageAll} onChange={togglePage} />
                    </th>
                  )}
                  <SortHeader col="email" label="Email" sort={sort} onSort={onSort} className="px-4 py-2" />
                  <SortHeader col="name" label="Name" sort={sort} onSort={onSort} className="px-4 py-2" />
                  <SortHeader col="group" label="Group" sort={sort} onSort={onSort} className="px-4 py-2" />
                  <SortHeader col="status" label="Status" sort={sort} onSort={onSort} className="px-4 py-2" />
                  {canEdit && <th className="px-4 py-2 text-right uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className={picked.has(c.id) || allMatching ? "bg-[#f4f8ff]" : undefined}>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <input type="checkbox" className="size-4 accent-royal" aria-label={`Select ${c.email}`} checked={allMatching || picked.has(c.id)} disabled={allMatching} onChange={() => toggleRow(c.id)} />
                      </td>
                    )}
                    <td className="px-4 py-2 font-medium text-navy">{c.email}</td>
                    <td className="px-4 py-2">{c.name ?? "-"}</td>
                    <td className="px-4 py-2">{c.group ?? "-"}</td>
                    <td className="px-4 py-2">
                      {canEdit ? (
                        <button
                          type="button"
                          title={c.active ? "Active: suggested in the To / Cc boxes. Click to make it inactive." : "Inactive: not suggested. Click to make it active."}
                          aria-label={`${c.email} is ${c.active ? "active" : "inactive"}. Click to ${c.active ? "deactivate" : "activate"}`}
                          onClick={() => edit.mutate({ id: c.id, active: !c.active }, { onError: (e) => toast(errorMessage(e), "error") })}
                        >
                          <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge>
                        </button>
                      ) : <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" aria-label={`Edit ${c.email}`} onClick={() => setForm(c)}><Pencil className="size-4" aria-hidden /></Button>
                        <Button variant="ghost" size="sm" aria-label={`Delete ${c.email}`} onClick={() => setDeleting(c)}><Trash2 className="size-4 text-danger" aria-hidden /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination meta={list.data.meta} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />}
      </section>

      {form && <ContactForm key={form === "new" ? "new" : form.id} contact={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {regroup && <GroupDialog count={count} groups={groups} busy={bulk.isPending} onClose={() => setRegroup(false)} onSave={(g) => runBulk("group", { group: g }, "Group updated")} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this contact?"
        description={deleting ? `${deleting.email} will no longer be suggested. Emails already sent are not affected. To keep it but stop suggesting it, make it inactive instead.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast("Contact deleted"); setPicked((p) => { const n = new Set(p); n.delete(deleting.id); return n; }); },
          onError: (e) => toast(errorMessage(e), "error"),
        })}
      />
      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={`Delete ${count} contact${count === 1 ? "" : "s"}?`}
        description={`${allMatching && !filtered ? `This deletes the whole address book (${count} contacts). ` : `The ${count} selected contact${count === 1 ? "" : "s"} will no longer be suggested. `}Emails already sent are not affected. To keep them but stop suggesting them, make them inactive instead.`}
        confirmLabel={`Delete ${count}`}
        destructive
        loading={bulk.isPending}
        onConfirm={() => runBulk("delete", {}, "Deleted")}
      />
    </div>
  );
}

/** Put the selected contacts in one group (empty clears the group). */
function GroupDialog({ count, groups, busy, onClose, onSave }: { count: number; groups: string[]; busy: boolean; onClose: () => void; onSave: (group: string) => void }) {
  const [g, setG] = useState("");
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Set group for ${count} contact${count === 1 ? "" : "s"}`}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(g.trim()); }} className="space-y-4">
        <Field label="Group" htmlFor="bulk-group" hint="Pick one or type a new one. Leave it empty to remove the group.">
          <Input id="bulk-group" list="bulk-groups" maxLength={60} autoFocus value={g} onChange={(e) => setG(e.target.value)} />
          <datalist id="bulk-groups">{groups.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-royal hover:bg-royal/90" loading={busy}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function ContactForm({ contact, onClose }: { contact: MailContact | null; onClose: () => void }) {
  const toast = useToast();
  const add = useAddContact();
  const edit = useEditContact();
  const [v, setV] = useState({ email: contact?.email ?? "", name: contact?.name ?? "", group: contact?.group ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = add.isPending || edit.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) err.email = "Enter a valid email address";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body = { email: v.email, name: v.name.trim(), group: v.group.trim() };
    const opts = {
      onSuccess: () => { toast(contact ? "Contact updated" : "Contact added"); onClose(); },
      onError: (x: unknown) => { const fe = fieldErrorsOf(x); if (Object.keys(fe).length) setErrors(fe); else toast(errorMessage(x), "error"); },
    };
    if (contact) edit.mutate({ id: contact.id, ...body }, opts);
    else add.mutate(body, opts);
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={contact ? "Edit contact" : "Add contact"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="mc-email" required error={errors.email}>
          <Input id="mc-email" format="email" autoFocus value={v.email} onChange={(e) => setV({ ...v, email: e.target.value.toLowerCase() })} aria-invalid={!!errors.email} placeholder="name@adinn.co.in" />
        </Field>
        <Field label="Name" htmlFor="mc-name" error={errors.name}>
          <Input id="mc-name" maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Group" htmlFor="mc-group" hint="For example Accounts or Signage team" error={errors.group}>
          <Input id="mc-group" maxLength={60} value={v.group} onChange={(e) => setV({ ...v, group: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-royal hover:bg-royal/90" loading={busy}>{contact ? "Save" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}
