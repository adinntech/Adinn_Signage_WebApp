"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ListPlus,
  Pencil,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  Contact,
  FileSpreadsheet,
  Handshake,
  Info,
  Loader2,
  PhoneCall,
  RefreshCw,
  Ruler,
  Save,
  Send,
  Star,
  Store,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { ContactDialog } from "@/components/clients/contact-dialog";
import { AttachmentChip } from "@/components/sales/order-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  HANDOVER_TYPES,
  useAssignClientServicing,
  useClientServicingUsers,
  useHandover,
  useSetHandoverScope,
  useSetHandoverType,
  useSetSoContacts,
  type HandoverState,
  type HandoverType,
  type Order,
  type SoContact,
} from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clientIdOf } from "@/lib/api/clients";
import { HandoverChat } from "@/components/handover/handover-chat";
import { ShopTable } from "@/components/handover/shop-table";

const TYPE_ICON: Record<HandoverType, typeof Store> = { ASO: PhoneCall, SHOP_DETAILS: FileSpreadsheet, SHOP_MEASUREMENT: Ruler };

/**
 * "Send handover details" toggle, on the right of the Handover Type header (Client Servicing route only). Off (default
 * for new orders): only the client details and contact persons go to Client Servicing. On: the full handover. What was
 * entered for the full handover is kept when it is switched off, just not sent or required.
 */
function ScopeToggle({ orderId, data, editable }: { orderId: string; data: HandoverState; editable: boolean }) {
  const toast = useToast();
  const set = useSetHandoverScope(orderId);
  const flip = () =>
    set.mutateAsync(!data.full).then(
      (r) => toast(r.full ? "Full handover: type, shop list, communication and documents" : "Client details and contact persons only"),
      (e) => toast(errorMessage(e), "error"),
    );
  return (
    <span className="flex items-center gap-2.5">
      <span id="ho-scope-label" className="text-right text-xs font-semibold text-primary sm:text-sm">
        Send handover details
      </span>
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
      <span className={cn("w-7 text-sm font-semibold", data.full ? "text-approval" : "text-muted-foreground")}>{data.full ? "On" : "Off"}</span>
    </span>
  );
}

/** ASO / Shop Details Only / Shop + Measurement: decides what the BD shares and what is checked before handover. */
function TypeSection({ orderId, data, editable, toggle }: { orderId: string; data: HandoverState; editable: boolean; toggle?: React.ReactNode }) {
  const toast = useToast();
  const set = useSetHandoverType(orderId);
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle icon={Handshake} title="Handover Type" description={editable ? "Choose what you hand over." : "What the BD handed over."} action={toggle} />
      {!data.full ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden /> Handover details are off: only the client details and contact persons go to Client Servicing.
        </p>
      ) : (
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
      )}
      {data.full && editable && <p className="mt-3 text-xs text-muted-foreground">Each type keeps its own details: switching shows that type&apos;s shop list (empty the first time) and keeps the others.</p>}
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
  // Each open gets a fresh form (no values, errors or index left from the previous add / edit).
  const [session, setSession] = useState(0);
  const openContact = (i: number) => {
    setSession((s) => s + 1);
    setEditing(i);
  };
  const crm = order.clientType !== "EXISTING";
  const certificates = crm ? (c.gstCertificates ?? []) : [];
  const custom = crm ? (c.customFields ?? []) : [];
  const address = [c.address, c.city, c.state].filter(Boolean).join(", ") + (c.pincode ? ` - ${c.pincode}` : "");
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={Building2}
        title="Client & Contact Persons"
        description={aso ? "Auto-filled from Client Management. Contact persons are optional; add the client's SO contacts in the ASO section below." : "Auto-filled from Client Management. Contact persons are optional."}
        action={
          canAddContact && (
            <Button variant="brand-outline" size="sm" onClick={() => openContact(-1)}>
              <UserPlus className="size-4" aria-hidden /> Add Contact Person
            </Button>
          )
        }
      />
      <ContactDialog key={session} client={c} index={editing === -1 ? null : editing} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} />
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="Company Name">{c.name}</DetailItem>
        <DetailItem label="Client Name">{c.clientName}</DetailItem>
        <DetailItem label="Client ID">
          <span className="font-mono text-brand">{clientIdOf(c, order.clientType)}</span>
        </DetailItem>
        {/* New client: the confirmed Zoho client ID next to the temporary CRM one. */}
        {order.clientType !== "EXISTING" && c.zohoCustomerNo && (
          <DetailItem label="Client Code (Zoho)">
            <span className="font-mono">{c.zohoCustomerNo}</span>
          </DetailItem>
        )}
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
      <div className="mt-5 max-h-[min(280px,45dvh)] overflow-auto overscroll-contain rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    <Button variant="ghost" size="icon" onClick={() => openContact(i)} aria-label={`Edit ${k.name}`} title="Edit contact">
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

/** Shared with the step footers: the gap message of a missing SO contact, and a jump to the section. */
export const SO_CONTACT_GAP = "Add at least one SO Contact with name and phone number";
export function goToSoContacts() {
  const el = document.getElementById("ho-so-contacts");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
}

type SoRow = { key: string; name: string; phone: string; email: string; isPrimary: boolean };
const blankSo = (): SoRow => ({ key: Math.random().toString(36).slice(2), name: "", phone: "", email: "", isPrimary: false });
const soRowsOf = (list: SoContact[]): SoRow[] => list.map((k, i) => ({ key: k._id ?? String(i), name: k.name, phone: k.phone, email: k.email ?? "", isPrimary: k.isPrimary }));
const isBlankSo = (r: SoRow) => !r.name.trim() && !r.phone.trim() && !r.email.trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Inline checks, same as the server: name and 10-digit mobile for a contact that is kept; email optional. */
function soRowErrors(r: SoRow) {
  if (isBlankSo(r)) return {};
  const e: Partial<Record<"name" | "phone" | "email", string>> = {};
  if (!r.name.trim()) e.name = "Enter the name";
  if (!/^[6-9]\d{9}$/.test(r.phone)) e.phone = "10-digit mobile number";
  if (r.email.trim() && !EMAIL_RE.test(r.email.trim())) e.email = "Enter a valid email";
  return e;
}

/**
 * ASO: the client's SO contacts (name, mobile, optional email), kept apart from the client's contact persons. Any
 * number of contacts, none required; one is primary when there are any. Saved as one list with "Save SO Contacts";
 * unsaved edits stay on screen (they are not overwritten by other handover saves).
 */
function SoContactsSection({ orderId, saved, editable }: { orderId: string; saved: SoContact[]; editable: boolean }) {
  const toast = useToast();
  const save = useSetSoContacts(orderId);
  const savedKey = JSON.stringify(saved);
  const [rows, setRows] = useState<SoRow[]>(() => soRowsOf(saved));
  const [base, setBase] = useState(savedKey);
  const [dirty, setDirty] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // Saved list changed elsewhere (another tab, a reload) while nothing is being edited here: show it.
  if (savedKey !== base && !dirty) {
    setBase(savedKey);
    setRows(soRowsOf(saved));
  }
  const edit = (next: SoRow[]) => {
    setRows(next);
    setDirty(true);
    setServerErrors({});
  };
  const setField = (i: number, f: "name" | "phone" | "email", v: string) => edit(rows.map((r, j) => (j === i ? { ...r, [f]: f === "phone" ? v.replace(/\D/g, "").slice(0, 10) : v } : r)));
  const makePrimary = (i: number) => edit(rows.map((r, j) => ({ ...r, isPrimary: j === i })));
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    // Deleting the primary hands it to the first remaining contact.
    if (rows[i]?.isPrimary && next.length && !next.some((r) => r.isPrimary)) next[0] = { ...next[0]!, isPrimary: true };
    edit(next);
  };
  const kept = rows.filter((r) => !isBlankSo(r));
  // ASO needs one saved SO contact with name and phone (what the server checks; blank rows do not count).
  const savedValid = saved.some((k) => k.name.trim() && k.phone.trim());
  const errors = rows.map(soRowErrors);
  const invalid = errors.some((e) => Object.keys(e).length);

  const submit = async () => {
    setTried(true);
    if (invalid) return;
    const primary = Math.max(0, kept.findIndex((r) => r.isPrimary));
    try {
      await save.mutateAsync(kept.map((r, i) => ({ name: r.name.trim(), phone: r.phone, email: r.email.trim() || undefined, isPrimary: i === primary })));
      setDirty(false);
      setTried(false);
      setBase("");
      toast(kept.length ? `${kept.length} SO contact${kept.length === 1 ? "" : "s"} saved` : "SO contacts cleared");
    } catch (e) {
      // Server paths index the kept (non-blank) rows; point them back at the rows on screen.
      const map: Record<string, string> = {};
      for (const [path, msg] of Object.entries(fieldErrorsOf(e))) {
        const m = /^contacts\.(\d+)\.(\w+)$/.exec(path);
        const row = m ? rows.indexOf(kept[Number(m[1])]!) : -1;
        if (m && row >= 0) map[`${row}.${m[2]}`] = msg;
      }
      setServerErrors(map);
      toast(errorMessage(e), "error");
    }
  };

  return (
    <Card id="ho-so-contacts" className={cn("p-5 sm:p-6", editable && !savedValid && "border-warning/50")}>
      <SectionTitle
        icon={Contact}
        title="SO Contacts"
        description={editable ? "Required for ASO: at least one SO contact with name and mobile number; email optional. Add more if needed." : "The client's SO contacts for this ASO handover."}
        action={
          editable && (
            <Button variant="brand-outline" size="sm" onClick={() => edit([...rows, { ...blankSo(), isPrimary: !rows.some((r) => r.isPrimary) }])} disabled={rows.length >= 50}>
              <UserPlus className="size-4" aria-hidden /> Add SO Contact
            </Button>
          )
        }
      />
      {editable && !savedValid && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {SO_CONTACT_GAP}{rows.some((r) => !isBlankSo(r)) ? ", then Save SO Contacts." : "."}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No SO contacts{editable ? " yet. Add at least one with name and phone number." : "."}</p>
      ) : (
        <div className="max-h-[min(280px,45dvh)] overflow-auto overscroll-contain rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Phone Number</th>
                <th className="px-3 py-2.5">Email (optional)</th>
                <th className="px-3 py-2.5">Primary</th>
                {editable && (
                  <th className="px-3 py-2.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => {
                const err = (f: "name" | "phone" | "email") => serverErrors[`${i}.${f}`] ?? (tried ? errors[i]![f] : undefined);
                return editable ? (
                  <tr key={r.key} className="align-top">
                    {(["name", "phone", "email"] as const).map((f) => (
                      <td key={f} className="px-3 py-2">
                        <Input
                          aria-label={`SO contact ${i + 1} ${f === "phone" ? "phone number" : f}`}
                          aria-invalid={!!err(f)}
                          value={r[f]}
                          inputMode={f === "phone" ? "numeric" : f === "email" ? "email" : undefined}
                          placeholder={f === "phone" ? "10-digit mobile" : f === "email" ? "name@company.com" : "Contact name"}
                          maxLength={f === "name" ? 120 : f === "email" ? 200 : 10}
                          autoComplete="off"
                          onChange={(e) => setField(i, f, e.target.value)}
                        />
                        {err(f) && <p className="mt-1 text-xs text-danger">{err(f)}</p>}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <label className="flex h-10 items-center gap-2 text-sm">
                        <input type="radio" name={`so-primary-${orderId}`} checked={r.isPrimary} onChange={() => makePrimary(i)} className="size-4 accent-brand" />
                        Primary
                      </label>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label={`Remove SO contact ${r.name || i + 1}`} title="Remove">
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.key}>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5 tabular-nums">+91 {r.phone}</td>
                    <td className="px-3 py-2.5">{r.email || "-"}</td>
                    <td className="px-3 py-2.5">
                      {r.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                          <Star className="size-3" aria-hidden /> Primary
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editable && dirty && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <span className="mr-auto text-xs text-warning">Unsaved changes</span>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              setRows(soRowsOf(saved));
              setDirty(false);
              setTried(false);
              setServerErrors({});
            }}
          >
            Discard
          </Button>
          <Button variant="brand" loading={save.isPending} onClick={() => void submit()}>
            <Save className="size-4" aria-hidden /> Save SO Contacts
          </Button>
        </div>
      )}
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
  const messages = data.messages.length;
  const contacts = `${order.client.contacts.length} contact person${order.client.contacts.length === 1 ? "" : "s"}`;
  const ready = data.missing.length === 0;

  return (
    <Card className="border-brand/30 p-5 sm:p-6">
      <SectionTitle icon={Handshake} title="Assign Client Servicing Person" description="Completing the handover assigns this person and completes the lead. It cannot be reassigned." />
      {!ready && (
        <ul className="mb-4 space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
          {data.missing.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden />
              {m === SO_CONTACT_GAP ? (
                <button type="button" onClick={goToSoContacts} className="font-medium underline underline-offset-2 hover:text-primary">
                  {m}
                </button>
              ) : (
                m
              )}
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
            {data.type === "SHOP_MEASUREMENT" && `, ${data.shopFiles} shop image${data.shopFiles === 1 ? "" : "s"}`} and {messages} message{messages === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden /> Client details only: the client and {contacts}.
          </p>
        )}
        <Button variant="brand" disabled={!ready} onClick={() => (cs ? setConfirm(true) : setError("Choose the Client Servicing person"))}>
          <Send className="size-4" aria-hidden /> Save &amp; Complete Handover
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
            <b>Not handed over yet.</b> Choose the handover type, complete what it needs (a shop list for the shop types; at least one SO contact for ASO), add
            messages and documents, then assign the order to Client Servicing.
          </p>
        ) : (
          <p>
            <b>Not handed over yet.</b> Only the client details and contact persons (optional) go to Client Servicing. Choose the person and assign.
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
 * Handover Type & Details for one order, shared by Order Management, the Client Servicing route and the Recce route.
 * Order: 1. Client & Contact Persons, 2. Handover Type (with the "Send handover details" toggle), 3. Shop list (shop
 * types), 4. Communication & attachments, 5. Assign Client Servicing Person + Save & Complete Handover (completes the
 * lead). Client Servicing sees the same details read-only.
 *
 * `mode="recce"` (Recce route): the same details, always in full (no toggle), without the Client Servicing assignment;
 * `locked` once the Recce team has the project.
 */
export function HandoverTab({
  order,
  onAssigned,
  mode = "cs",
  locked = false,
  csEdit = false,
  readOnly = false,
}: {
  order: Order;
  onAssigned?: () => void;
  mode?: "cs" | "recce";
  locked?: boolean;
  /** Client Servicing workflow, handover sent without details: the assigned person completes type, SO contacts and shops. */
  csEdit?: boolean;
  /** Lead Management > Full Details: everything shown, nothing editable (no posting either). */
  readOnly?: boolean;
}) {
  const { can, user } = useAuth();
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
  const recce = mode === "recce";
  // The Recce team always gets the full handover; the toggle is a Client Servicing option.
  const data = recce ? { ...q.data, full: true } : q.data;
  const open = !data.assignee && !locked && !readOnly; // before handover the BD can still change everything
  // Handover details (type, SO contacts, shop list, images): the BD before handover, or the assigned Client Servicing
  // person completing them (server-checked). Chat, contacts and delete permissions are not affected.
  const details = (canWrite && open) || (csEdit && !locked && !readOnly);
  // The Client Servicing person the order is handed to can reply in the handover chat (read-only otherwise).
  const csReply = user?.role === "CLIENT_SERVICING" && !!data.assignee && data.assignee._id === user.id;

  const toggle = recce ? undefined : canWrite && open ? (
    <ScopeToggle orderId={order._id} data={data} editable />
  ) : (
    <Badge tone={data.full ? "info" : "neutral"}>{data.full ? "Handover details sent" : "Client details only"}</Badge>
  );

  return (
    <div className="space-y-4">
      {!recce && <StatusBanner data={data} />}
      <ClientSection order={order} canAddContact={canWrite && open && can("clients:write")} aso={data.full && data.type === "ASO"} />
      <TypeSection orderId={order._id} data={data} editable={details} toggle={toggle} />
      <AnimatePresence initial={false}>
        {data.full && (
          <motion.div key="full" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            {/* SO contacts stay on the order for other types too (hidden, not deleted). */}
            {data.type === "ASO" && <SoContactsSection orderId={order._id} saved={data.soContacts} editable={details} />}
            {/* Each shop type has its own list; keyed by type so nothing of the other type's table stays on screen. */}
            {(data.type === "SHOP_DETAILS" || data.type === "SHOP_MEASUREMENT") && (
              <ShopTable key={data.type} orderId={order._id} type={data.type} summary={data.shopList} columns={data.columns} editable={details} canAddImages={!readOnly && (canWrite || (csEdit && !locked))} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <HandoverChat orderId={order._id} messages={data.messages} source={{ orderId: order._id }} canPost={!readOnly && (canWrite || csReply)} canDelete={canWrite && open} />
      {!recce && canWrite && open && <AssignSection orderId={order._id} data={data} order={order} onAssigned={onAssigned} />}
      {!open && canWrite && !recce && !readOnly && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" aria-hidden /> Messages, files, voice notes and shop images can still be added; Client Servicing is notified.
        </p>
      )}
    </div>
  );
}
