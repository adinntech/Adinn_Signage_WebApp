"use client";

import { useEffect, useRef, useState } from "react";
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
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Paperclip,
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
import { FileUploader } from "@/components/ui/file-uploader";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { downloadFile, formData, type FileRef } from "@/lib/api/files";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  HANDOVER_TYPES,
  useAssignClientServicing,
  useClientServicingUsers,
  useHandover,
  useSetHandoverScope,
  useSetHandoverType,
  useAddSoDocuments,
  useRemoveSoDocument,
  useSetOrderContacts,
  useSetSoContacts,
  type HandoverState,
  type HandoverType,
  type Order,
  type OrderContact,
  type PrimaryContact,
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
    <Card id="ho-type" className={cn("p-5 sm:p-6", editable && data.full && !data.type && "border-warning/50")}>
      <SectionTitle icon={Handshake} title="Assign Type" description={editable ? "Choose what you hand over." : "What was handed over."} action={toggle} />
      {!data.full ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden /> Handover details are off: only the client details and contact persons go to Client Servicing.
        </p>
      ) : (
      <div role="radiogroup" aria-label="Assign type" className="grid gap-3 md:grid-cols-3">
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
              onClick={() => !on && set.mutateAsync(k).then(() => toast(`Assign type: ${HANDOVER_TYPES[k].label}`), (e) => toast(errorMessage(e), "error"))}
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
      {data.full && editable && !data.type && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {HANDOVER_TYPE_GAP}.
        </p>
      )}
      {data.full && editable && <p className="mt-3 text-xs text-muted-foreground">Each type keeps its own details: switching shows that type&apos;s shop list (empty the first time) and keeps the others.</p>}
    </Card>
  );
}

/**
 * Company and contact persons, straight from Client Management. Contact persons can be added and edited here (saved on
 * the client). GST certificate and custom fields: New (Client Management) clients only, not Existing (Zoho) ones.
 * Recce route: the contact person is mandatory (Zoho's, or one row for this order when Zoho has none); no Add Contact Person.
 */
function ClientSection({
  order,
  canAddContact,
  aso,
  recce,
  orderContacts,
  manualEditable,
}: {
  order: Order;
  canAddContact: boolean;
  aso: boolean;
  /** Recce route: the contact person is mandatory. */
  recce: boolean;
  /** Contact persons saved for this order only. */
  orderContacts: OrderContact[];
  /** Recce Team > Assign Type & Details: the contact person for this order when the client has none. */
  manualEditable: boolean;
}) {
  const c = order.client;
  // Client without contact persons: this order's own contact persons replace the empty table (decided by the client's
  // contacts only, not by the ones added here).
  const manual = c.contacts.length === 0 && (manualEditable || orderContacts.length > 0);
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
  const description = recce
    ? "Auto-filled from Zoho / Client Management. A contact person with name and mobile number is required."
    : aso
      ? "Auto-filled from Client Management. Contact persons are optional; add the client's POC contacts in the POC section below."
      : "Auto-filled from Client Management. Contact persons are optional.";
  return (
    <Card id="ho-contacts" className="p-5 sm:p-6">
      <SectionTitle
        icon={Building2}
        title="Client & Contact Persons"
        description={description}
        action={
          canAddContact &&
          !manual && (
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
      {manual ? (
        <OrderContactsSection orderId={order._id} saved={orderContacts} editable={manualEditable} prefill={contactPrefillOf(c)} />
      ) : (
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
      )}
    </Card>
  );
}

/**
 * Saves of unsaved contact lists (the client contact person, the POC contacts), registered while there are any; run
 * by the step's forward actions (top Next, Continue, Skip: Rate Card).
 */
const pendingContactSaves = new Map<string, () => Promise<boolean>>();
/**
 * Before leaving Assign Type & Details: saves unsaved contact persons and POC contacts (true when saved or nothing to
 * save; false when a row needs fixing, shown inline).
 */
export const saveOrderContactsBeforeLeaving = async () => {
  for (const run of [...pendingContactSaves.values()]) if (!(await run())) return false;
  return true;
};
/** Any contact list with unsaved changes (the forward action then reads the gaps again after saving). */
export const hasUnsavedContacts = () => pendingContactSaves.size > 0;
/** Registers `submit` as the pending save of `key` while `active` (latest submit through a ref). */
function usePendingSave(key: string, active: boolean, submit: () => Promise<boolean>) {
  const ref = useRef(submit);
  ref.current = submit;
  useEffect(() => {
    if (!active) return;
    const run = () => ref.current();
    pendingContactSaves.set(key, run);
    return () => {
      if (pendingContactSaves.get(key) === run) pendingContactSaves.delete(key);
    };
  }, [key, active]);
}

type ContactRow = { key: string; name: string; designation: string; phone: string; email: string; isPrimary: boolean };
type ContactField = "name" | "designation" | "phone" | "email";
const newKey = () => Math.random().toString(36).slice(2);
const blankContact = (): ContactRow => ({ key: newKey(), name: "", designation: "", phone: "", email: "", isPrimary: false });
const contactRowsOf = (list: OrderContact[]): ContactRow[] =>
  list.map((k, i) => ({ key: k._id ?? String(i), name: k.name, designation: k.designation ?? "", phone: k.phone, email: k.email ?? "", isPrimary: k.isPrimary }));
const isBlankContact = (r: ContactRow) => !r.name.trim() && !r.designation.trim() && !r.phone.trim() && !r.email.trim();
const MOBILE_RE = /^[6-9]\d{9}$/;
/** Last 10 digits of a phone when they make an Indian mobile number, else "". */
const mobileOf = (v?: string | null) => {
  const d = (v ?? "").replace(/\D/g, "").slice(-10);
  return MOBILE_RE.test(d) ? d : "";
};
/**
 * The contact row for a client without contact persons: the Zoho client name (else the company name), the client's
 * phone and email when known; designation blank. The user completes what is missing.
 */
function contactPrefillOf(c: Order["client"]): ContactRow {
  const name = (c.clientName ?? "").trim() || (c.name ?? "").trim();
  return { ...blankContact(), name, phone: mobileOf(c.phone), email: (c.email ?? "").trim(), isPrimary: true };
}
/** Inline checks, same as the server: contact person and 10-digit mobile are required; designation and email optional. */
function contactRowErrors(r: ContactRow) {
  const e: Partial<Record<ContactField, string>> = {};
  if (!r.name.trim()) e.name = "Enter the contact person";
  if (!MOBILE_RE.test(r.phone)) e.phone = "Enter a valid 10-digit mobile number";
  if (r.email.trim() && !EMAIL_RE.test(r.email.trim())) e.email = "Enter a valid email";
  return e;
}
const CONTACT_FIELDS: { f: ContactField; label: string; placeholder: string; max: number }[] = [
  { f: "name", label: "Contact Person", placeholder: "Contact name", max: 120 },
  { f: "designation", label: "Designation", placeholder: "Optional", max: 120 },
  { f: "phone", label: "Mobile", placeholder: "10-digit number", max: 10 },
  { f: "email", label: "Email", placeholder: "Optional", max: 200 },
];
/** Server field paths (`contacts.<i>.<field>`) index the rows that were sent; point them back at the rows on screen. */
function rowErrorsOf(e: unknown, sent: { key: string }[], rows: { key: string }[]) {
  const map: Record<string, string> = {};
  for (const [path, msg] of Object.entries(fieldErrorsOf(e))) {
    const m = /^contacts\.(\d+)\.(\w+)$/.exec(path);
    const row = m ? rows.findIndex((r) => r.key === sent[Number(m[1])]?.key) : -1;
    if (m && row >= 0) map[`${row}.${m[2]}`] = msg;
  }
  return map;
}

/**
 * Client without contact persons (Recce route): the mandatory contact person for this order only. One editable row,
 * prefilled from Zoho (client name, else company name; phone; email); name and mobile required. A complete prefill is
 * saved on its own (no Save / Discard); otherwise the user fills the blanks and saves with "Save Contacts" (the forward
 * actions save it too). Kept on the order only: Zoho and the client record are not changed.
 */
function OrderContactsSection({ orderId, saved, editable, prefill }: { orderId: string; saved: OrderContact[]; editable: boolean; prefill: ContactRow }) {
  const toast = useToast();
  const save = useSetOrderContacts(orderId);
  const savedKey = JSON.stringify(saved);
  // Nothing saved yet: the prefilled row, unsaved (saved by Save Contacts or the forward actions).
  const initial = () => (saved.length ? contactRowsOf(saved) : editable ? [{ ...prefill, key: newKey() }] : []);
  const [rows, setRows] = useState<ContactRow[]>(initial);
  const [base, setBase] = useState(savedKey);
  const [dirty, setDirty] = useState(editable && !saved.length);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // Saved list changed elsewhere (another tab, a reload) while nothing is being edited here: show it.
  if (savedKey !== base && !dirty) {
    setBase(savedKey);
    setRows(initial());
    setDirty(editable && !saved.length);
  }
  // The user changed something here (Save / Discard are then shown).
  const [touched, setTouched] = useState(false);
  // The automatic save of a complete prefill failed: Save / Discard are shown to retry.
  const [autoFailed, setAutoFailed] = useState(false);
  const edit = (next: ContactRow[]) => {
    setRows(next);
    setDirty(true);
    setTouched(true);
    setServerErrors({});
  };
  const setField = (i: number, f: ContactField, v: string) => edit(rows.map((r, j) => (j === i ? { ...r, [f]: f === "phone" ? v.replace(/\D/g, "").slice(0, 10) : v } : r)));
  const makePrimary = (i: number) => edit(rows.map((r, j) => ({ ...r, isPrimary: j === i })));
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    // Removing the primary hands it to the first remaining contact.
    if (rows[i]?.isPrimary && next.length && !next.some((r) => r.isPrimary)) next[0] = { ...next[0]!, isPrimary: true };
    edit(next);
  };
  // Every row is a contact (no blank extras); at least one is required.
  const errors = rows.map(contactRowErrors);
  const invalid = !rows.length || errors.some((e) => Object.keys(e).length);
  const savedValid = saved.some((k) => k.name.trim() && k.phone.trim());
  // Nothing saved yet and Zoho gave both the name and a valid mobile: saved automatically, no Save / Discard.
  const prefillComplete = !saved.length && Object.keys(contactRowErrors(prefill)).length === 0;
  const autoSaving = editable && prefillComplete && !touched && !autoFailed;
  const showActions = editable && dirty && !autoSaving;

  const submit = async (opts: { auto?: boolean } = {}) => {
    if (!opts.auto) setTried(true);
    if (invalid) {
      if (!opts.auto) goToSection("ho-order-contacts");
      return false;
    }
    const primary = Math.max(0, rows.findIndex((r) => r.isPrimary));
    try {
      await save.mutateAsync(rows.map((r, i) => ({ name: r.name.trim(), designation: r.designation.trim() || undefined, phone: r.phone, email: r.email.trim() || undefined, isPrimary: i === primary })));
      setDirty(false);
      setTried(false);
      setTouched(false);
      setBase("");
      if (!opts.auto) toast(`${rows.length} contact person${rows.length === 1 ? "" : "s"} saved for this order`);
      return true;
    } catch (e) {
      setServerErrors(rowErrorsOf(e, rows, rows));
      if (opts.auto) {
        setAutoFailed(true);
        setTried(true);
      } else {
        toast(errorMessage(e), "error");
        goToSection("ho-order-contacts");
      }
      return false;
    }
  };
  // Continue / Next / Skip save the unsaved row first (so the Rate Card gets it).
  usePendingSave("order-contacts", editable && dirty, () => submit());
  // A complete prefill is saved once on its own (the step's gap then clears without Save Contacts).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoSaving || !dirty || autoStarted.current) return;
    autoStarted.current = true;
    void submit({ auto: true });
    // Runs once per mount for the prefilled row; submit reads the current rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaving, dirty]);

  return (
    <div id="ho-order-contacts" className="mt-5 border-t border-border pt-4">
      <div className="mb-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Contact className="size-4" aria-hidden /> Contact Person {editable && <span className="text-danger">*</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {editable ? "This client has no contact persons in Zoho. Enter the contact person for this order (name and mobile required); Zoho and the client record are not changed." : "Contact person entered for this order (the client has none in Zoho)."}
        </p>
      </div>
      {editable && !savedValid && !autoSaving && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {CONTACT_PERSON_GAP}, then Save Contacts.
        </p>
      )}
      {autoSaving && save.isPending && (
        <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving the contact person from Zoho…
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No contact person.</p>
      ) : (
        <div className="max-h-[min(280px,45dvh)] overflow-auto overscroll-contain rounded-lg border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                {CONTACT_FIELDS.map(({ f, label }) => (
                  <th key={f} className="px-3 py-2.5">
                    {label}
                    {editable && (f === "name" || f === "phone") && <span className="text-danger"> *</span>}
                  </th>
                ))}
                <th className="px-3 py-2.5">Primary</th>
                {editable && rows.length > 1 && (
                  <th className="px-3 py-2.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => {
                const err = (f: ContactField) => serverErrors[`${i}.${f}`] ?? (tried ? errors[i]![f] : undefined);
                return editable ? (
                  <tr key={r.key} className="align-top">
                    {CONTACT_FIELDS.map(({ f, label, placeholder, max }) => (
                      <td key={f} className="px-3 py-2">
                        {f === "phone" ? (
                          // Mobile: fixed +91, only the 10 digits are typed and saved.
                          <PhoneInput
                            aria-label={`Contact person ${i + 1} mobile number`}
                            aria-invalid={!!err(f)}
                            aria-required
                            value={r.phone}
                            placeholder={placeholder}
                            onChange={(e) => setField(i, f, e.target.value)}
                          />
                        ) : (
                          <Input
                            aria-label={`Contact person ${i + 1} ${label.toLowerCase()}`}
                            aria-invalid={!!err(f)}
                            aria-required={f === "name"}
                            value={r[f]}
                            inputMode={f === "email" ? "email" : undefined}
                            placeholder={placeholder}
                            maxLength={max}
                            autoComplete="off"
                            onChange={(e) => setField(i, f, e.target.value)}
                          />
                        )}
                        {err(f) && <p className="mt-1 text-xs text-danger">{err(f)}</p>}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <label className="flex h-10 items-center gap-2 text-sm">
                        <input type="radio" name={`order-contact-primary-${orderId}`} checked={r.isPrimary} onChange={() => makePrimary(i)} className="size-4 accent-brand" />
                        Primary
                      </label>
                    </td>
                    {rows.length > 1 && (
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label={`Remove contact person ${r.name || i + 1}`} title="Remove">
                          <Trash2 className="size-4 text-danger" aria-hidden />
                        </Button>
                      </td>
                    )}
                  </tr>
                ) : (
                  <tr key={r.key}>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5">{r.designation || "-"}</td>
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
      {showActions && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <span className="mr-auto text-xs text-warning">Unsaved changes</span>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              setRows(initial());
              setDirty(!saved.length);
              setTouched(false);
              setTried(false);
              setServerErrors({});
            }}
          >
            Discard
          </Button>
          <Button variant="brand" loading={save.isPending} onClick={() => void submit()}>
            <Save className="size-4" aria-hidden /> Save Contacts
          </Button>
        </div>
      )}
    </div>
  );
}

/** Shared with the step footers: the gap message of a missing POC contact (SO), and a jump to the section. */
export const SO_CONTACT_GAP = "Add at least one POC Contact with name and phone number";
/** Recce route: the gap message of the missing client contact person (same wording as the server). */
export const CONTACT_PERSON_GAP = "Add the client contact person with name and mobile number";
/** Same wording as the server's first gap (handoverGaps) when no assign type is chosen. */
const HANDOVER_TYPE_GAP = "Choose the assign type: SO, Only Shop Details or Shop + Measurement";
function goToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.querySelector<HTMLElement>("input, select, button")?.focus({ preventScroll: true });
}
export function goToSoContacts() {
  goToSection("ho-so-contacts");
}
/** Scrolls to the section of a server gap (contact person, assign type, POC contacts, shop list); its inline error is shown there. */
export function goToHandoverGap(gap: string) {
  if (gap === CONTACT_PERSON_GAP) return goToSection(document.getElementById("ho-order-contacts") ? "ho-order-contacts" : "ho-contacts");
  goToSection(gap === SO_CONTACT_GAP ? "ho-so-contacts" : gap.startsWith("Choose the assign type") ? "ho-type" : "ho-shops");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A client contact that can be used as a POC contact; `ref` identifies it (name + mobile). */
type PocChoice = { ref: string; name: string; designation: string; phone: string; email: string; isPrimary: boolean };
/** The order's client contacts (Zoho / Client Management, or this order's own) as POC choices. */
function pocChoicesOf(list: { name: string; designation?: string | null; phone?: string | null; email?: string | null; isPrimary?: boolean | null }[]): PocChoice[] {
  return list
    .filter((k) => k.name?.trim())
    .map((k) => ({
      ref: `${k.name.trim().toLowerCase()}|${(k.phone ?? "").replace(/\D/g, "")}`,
      name: k.name.trim(),
      designation: k.designation ?? "",
      phone: mobileOf(k.phone),
      email: k.email ?? "",
      isPrimary: !!k.isPrimary,
    }))
    .filter((k, i, all) => all.findIndex((x) => x.ref === k.ref) === i);
}
type PocRow = ContactRow & { ref: string };
const pocRowsOf = (list: SoContact[]): PocRow[] =>
  list.map((k, i) => ({ key: k._id ?? String(i), name: k.name, designation: k.designation ?? "", phone: k.phone, email: k.email ?? "", isPrimary: k.isPrimary, ref: k.ref ?? "" }));
/** Inline checks, same as the server: name and 10-digit phone for a contact that is kept; designation and email optional. */
function pocRowErrors(r: PocRow) {
  if (isBlankContact(r)) return {};
  const e: Partial<Record<ContactField, string>> = {};
  if (!r.name.trim()) e.name = "Enter the name";
  if (!MOBILE_RE.test(r.phone)) e.phone = "Enter a valid 10-digit phone number";
  if (r.email.trim() && !EMAIL_RE.test(r.email.trim())) e.email = "Enter a valid email";
  return e;
}
const POC_FIELDS: { f: ContactField; label: string; placeholder: string; max: number }[] = [
  { f: "name", label: "Name", placeholder: "POC name", max: 120 },
  { f: "designation", label: "Designation", placeholder: "Optional", max: 120 },
  { f: "phone", label: "Phone Number", placeholder: "10-digit number", max: 10 },
  { f: "email", label: "Email", placeholder: "Optional", max: 200 },
];
/** Rows as the API takes them (blank rows dropped; exactly one primary). */
const pocPayload = (list: PocRow[]) => {
  const kept = list.filter((r) => !isBlankContact(r));
  const p = Math.max(0, kept.findIndex((r) => r.isPrimary));
  return { kept, body: kept.map((r, i) => ({ name: r.name.trim(), designation: r.designation.trim() || undefined, phone: r.phone, email: r.email.trim() || undefined, isPrimary: i === p, ref: r.ref || undefined })) };
};

/**
 * POC contacts (SO, Only Shop Details, Shop + Measurement; stored as soContacts). Two ways, either one:
 * - "Same as Contact Person": the client's contact person (primary, else the first) becomes a POC contact, saved at once
 *   (no Save / Discard; unticking removes it the same way).
 * - "Add POC Contact": manual Name, Designation, Phone Number, Email and Primary, saved with "Save POC Contacts" (the
 *   forward actions save it too).
 * At least one for SO (Recce route: for every type), otherwise optional. Exactly one primary when there are any: it is the order's point of
 * contact. Kept when the assign type changes.
 */
function PocContactsSection({
  orderId,
  saved,
  editable,
  required,
  clientContacts,
  primary,
}: {
  orderId: string;
  saved: SoContact[];
  editable: boolean;
  /** SO: at least one POC contact. */
  required: boolean;
  clientContacts: PocChoice[];
  /** The order's point of contact as saved (primary POC contact, else the primary client contact). */
  primary: PrimaryContact | null;
}) {
  const toast = useToast();
  const save = useSetSoContacts(orderId);
  const savedKey = JSON.stringify(saved);
  const [rows, setRows] = useState<PocRow[]>(() => pocRowsOf(saved));
  const [base, setBase] = useState(savedKey);
  const [dirty, setDirty] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // Saved list changed elsewhere (another tab, a reload) while nothing is being edited here: show it.
  if (savedKey !== base && !dirty) {
    setBase(savedKey);
    setRows(pocRowsOf(saved));
  }
  const edit = (next: PocRow[]) => {
    setRows(next);
    setDirty(true);
    setServerErrors({});
  };
  // The client's contact person (primary, else the first): what "Same as Contact Person" copies.
  const person = clientContacts.find((k) => k.isPrimary) ?? clientContacts[0] ?? null;
  const personReady = !!person && MOBILE_RE.test(person.phone);
  const sameChecked = !!person && rows.some((r) => r.ref === person.ref);

  /** Saves `next` at once (checkbox, primary, remove): no Save / Discard. False when not saved. */
  const persist = async (next: PocRow[], message: string) => {
    const { kept, body } = pocPayload(next);
    if (kept.some((r) => Object.keys(pocRowErrors(r)).length)) {
      edit(next);
      setTried(true);
      return false;
    }
    setRows(next);
    try {
      await save.mutateAsync(body);
      setDirty(false);
      setTried(false);
      setServerErrors({});
      setBase("");
      toast(message);
      return true;
    } catch (e) {
      setRows(pocRowsOf(saved));
      toast(errorMessage(e), "error");
      return false;
    }
  };
  /** After removing rows: the primary goes to the first remaining contact. */
  const withPrimary = (list: PocRow[]) => (list.length && !list.some((r) => r.isPrimary) ? list.map((r, i) => ({ ...r, isPrimary: i === 0 })) : list);
  // With unsaved manual rows the change joins them (one Save); otherwise it is saved at once.
  const apply = (next: PocRow[], message: string) => (dirty ? edit(next) : void persist(next, message));

  const toggleSame = (on: boolean) => {
    if (!person) return;
    const next = on
      ? [{ key: newKey(), name: person.name, designation: person.designation, phone: person.phone, email: person.email, ref: person.ref, isPrimary: !rows.some((r) => r.isPrimary) }, ...rows]
      : withPrimary(rows.filter((r) => r.ref !== person.ref));
    apply(next, on ? `${person.name} added as POC contact` : "Contact person removed from POC contacts");
  };
  const addManual = () => {
    edit([...rows, { key: newKey(), name: "", designation: "", phone: "", email: "", ref: "", isPrimary: !rows.some((r) => r.isPrimary) }]);
    // Focus the new row's name.
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#ho-so-contacts tbody tr:last-child input`)?.focus());
  };
  const setField = (i: number, f: ContactField, v: string) => edit(rows.map((r, j) => (j === i ? { ...r, [f]: f === "phone" ? v.replace(/\D/g, "").slice(0, 10) : v } : r)));
  const makePrimary = (i: number) => apply(rows.map((r, j) => ({ ...r, isPrimary: j === i })), `${rows[i]?.name || "Contact"} is the primary POC`);
  const remove = (i: number) => apply(withPrimary(rows.filter((_, j) => j !== i)), "POC contact removed");

  const kept = rows.filter((r) => !isBlankContact(r));
  // SO needs one saved POC contact with name and phone (what the server checks; blank rows do not count).
  const savedValid = saved.some((k) => k.name.trim() && k.phone.trim());
  const errors = rows.map(pocRowErrors);
  const invalid = errors.some((e) => Object.keys(e).length) || (required && !kept.length);

  const submit = async () => {
    setTried(true);
    if (invalid) {
      goToSection("ho-so-contacts");
      return false;
    }
    const { body } = pocPayload(rows);
    try {
      await save.mutateAsync(body);
      setDirty(false);
      setTried(false);
      setBase("");
      toast(kept.length ? `${kept.length} POC contact${kept.length === 1 ? "" : "s"} saved` : "POC contacts cleared");
      return true;
    } catch (e) {
      setServerErrors(rowErrorsOf(e, kept, rows));
      toast(errorMessage(e), "error");
      goToSection("ho-so-contacts");
      return false;
    }
  };
  usePendingSave("poc-contacts", editable && dirty, submit);
  // Save / Discard only for manual entries (the checkbox, primary and remove save at once).
  const showActions = editable && dirty && (rows.length > 0 || saved.length > 0);

  return (
    <Card id="ho-so-contacts" className={cn("p-5 sm:p-6", editable && required && !savedValid && "border-warning/50")}>
      <SectionTitle
        icon={Contact}
        title={required ? "POC Contacts" : "POC Contacts (optional)"}
        description={
          editable
            ? `${required ? "Required" : "Optional for this type"}: tick Same as Contact Person, or Add POC Contact (name and phone number required; designation and email optional). The primary POC is the order's point of contact.`
            : "The client's POC contacts for this handover."
        }
      />
      {editable && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <label className={cn("flex min-w-0 items-center gap-2.5 text-sm", personReady ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={sameChecked}
              disabled={!personReady || save.isPending || rows.length >= 50}
              onChange={(e) => toggleSame(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="font-semibold text-foreground">Same as Contact Person</span>
              <span className="block truncate text-xs text-muted-foreground">
                {!person
                  ? "Save the contact person above first."
                  : !personReady
                    ? `${person.name} has no 10-digit mobile number.`
                    : [person.name, person.designation, `+91 ${person.phone}`, person.email].filter(Boolean).join(" · ")}
              </span>
            </span>
            {save.isPending && !dirty && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
          </label>
          <Button variant="brand-outline" onClick={addManual} disabled={rows.length >= 50 || save.isPending}>
            <UserPlus className="size-4" aria-hidden /> Add POC Contact
          </Button>
        </div>
      )}
      {editable && required && !savedValid && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {SO_CONTACT_GAP}
          {kept.length ? ", then Save POC Contacts." : ": tick Same as Contact Person or Add POC Contact."}
        </p>
      )}
      {primary && (
        <p className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="size-3.5 text-brand" aria-hidden /> Point of contact:
          <span className="font-semibold text-foreground">{primary.name}</span>
          {primary.phone && <span className="tabular-nums">+91 {primary.phone}</span>}
          <Badge tone="neutral">{primary.source === "POC" ? "Primary POC" : "Primary client contact"}</Badge>
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          No POC contacts{editable ? (required ? " yet." : " (optional). The primary client contact is used as the point of contact.") : "."}
        </p>
      ) : (
        <div className="max-h-[min(280px,45dvh)] overflow-auto overscroll-contain rounded-lg border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                {POC_FIELDS.map(({ f, label }) => (
                  <th key={f} className="px-3 py-2.5">
                    {label}
                    {editable && (f === "name" || f === "phone") && <span className="text-danger"> *</span>}
                  </th>
                ))}
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
                const err = (f: ContactField) => serverErrors[`${i}.${f}`] ?? (tried ? errors[i]![f] : undefined);
                // The contact person's row shows its details (change them in the contact person, not here).
                const same = !!person && r.ref === person.ref;
                const primaryCell = editable ? (
                  <label className="flex h-10 items-center gap-2 text-sm">
                    <input type="radio" name={`so-primary-${orderId}`} checked={r.isPrimary} disabled={save.isPending} onChange={() => makePrimary(i)} className="size-4 accent-brand" />
                    Primary
                  </label>
                ) : r.isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                    <Star className="size-3" aria-hidden /> Primary
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                );
                return editable && !same ? (
                  <tr key={r.key} className="align-top">
                    {POC_FIELDS.map(({ f, label, placeholder, max }) => (
                      <td key={f} className="px-3 py-2">
                        {f === "phone" ? (
                          // Phone Number: fixed +91, only the 10 digits are typed and saved.
                          <PhoneInput
                            aria-label={`POC contact ${i + 1} phone number`}
                            aria-invalid={!!err(f)}
                            aria-required
                            value={r.phone}
                            placeholder={placeholder}
                            onChange={(e) => setField(i, f, e.target.value)}
                          />
                        ) : (
                          <Input
                            aria-label={`POC contact ${i + 1} ${label.toLowerCase()}`}
                            aria-invalid={!!err(f)}
                            aria-required={f === "name"}
                            value={r[f]}
                            inputMode={f === "email" ? "email" : undefined}
                            placeholder={placeholder}
                            maxLength={max}
                            autoComplete="off"
                            onChange={(e) => setField(i, f, e.target.value)}
                          />
                        )}
                        {err(f) && <p className="mt-1 text-xs text-danger">{err(f)}</p>}
                      </td>
                    ))}
                    <td className="px-3 py-2">{primaryCell}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(i)} disabled={save.isPending} aria-label={`Remove POC contact ${r.name || i + 1}`} title="Remove">
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.key}>
                    <td className="px-3 py-2.5 font-medium">
                      {r.name}
                      {same && editable && <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Same as Contact Person</span>}
                    </td>
                    <td className="px-3 py-2.5">{r.designation || "-"}</td>
                    <td className="px-3 py-2.5 tabular-nums">+91 {r.phone}</td>
                    <td className="px-3 py-2.5">{r.email || "-"}</td>
                    <td className="px-3 py-2.5">{primaryCell}</td>
                    {editable && (
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => remove(i)} disabled={save.isPending} aria-label={`Remove POC contact ${r.name}`} title="Remove">
                          <Trash2 className="size-4 text-danger" aria-hidden />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showActions && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <span className="mr-auto text-xs text-warning">Unsaved changes</span>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              setRows(pocRowsOf(saved));
              setDirty(false);
              setTried(false);
              setServerErrors({});
            }}
          >
            Discard
          </Button>
          <Button variant="brand" loading={save.isPending} onClick={() => void submit()}>
            <Save className="size-4" aria-hidden /> Save POC Contacts
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
            <b>Not handed over yet.</b> Choose the assign type, complete what it needs (a shop list for the shop types; at least one POC contact for SO), add
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

const SO_DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv";
const kb = (n?: number | null) => (n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : "");

/**
 * SO: Additional Documents (optional), right below the POC contacts. Picking or dropping files uploads them at once
 * (images, PDF, Excel, Word, PowerPoint, CSV); each saved file has Preview, Download and Remove. Kept apart from the chat
 * files; they go with the project code request email and to the Recce team. Hidden for the other types (still saved).
 */
function SoDocumentsSection({ orderId, saved, editable }: { orderId: string; saved: (FileRef & { addedAt?: string | null })[]; editable: boolean }) {
  const toast = useToast();
  const add = useAddSoDocuments(orderId);
  const remove = useRemoveSoDocument(orderId);
  const [picked, setPicked] = useState<File[]>([]);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [removing, setRemoving] = useState<FileRef | null>(null);
  const source = { orderId };
  const fail = (e: unknown) => toast(errorMessage(e), "error");

  const upload = async (files: File[]) => {
    // One upload at a time; files picked meanwhile wait on screen and go with the next pick.
    if (!files.length || add.isPending) return setPicked(files);
    setPicked(files);
    try {
      const r = await add.mutateAsync(formData(files));
      const added = files.length - (r.skipped ?? 0);
      toast(`${added} document${added === 1 ? "" : "s"} added${r.skipped ? ` (${r.skipped} already added, skipped)` : ""}`, r.skipped ? "warning" : "success");
      setPicked([]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "DUPLICATE_FILE") {
        setPicked([]);
        return toast(errorMessage(e), "warning");
      }
      fail(e);
    }
  };

  return (
    <Card id="ho-so-documents" className="p-5 sm:p-6">
      <SectionTitle
        icon={Paperclip}
        title="Additional Documents"
        description={editable ? "Optional: images, PDF, Excel, Word or other documents for the SO. They go with the project code request email and to the Recce team." : "Documents shared with the SO handover."}
      />
      {saved.length ? (
        <ul className="mb-3 max-h-[min(260px,40dvh)] divide-y divide-border overflow-auto overscroll-contain rounded-lg border border-border">
          {saved.map((f) => (
            <li key={f.fileId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={f.name ?? undefined}>
                  {f.name ?? "Document"}
                </span>
                <span className="block text-xs text-muted-foreground">{[kb(f.size), f.addedAt ? formatDate(f.addedAt) : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setPreview({ saved: f, source })} aria-label={`Preview ${f.name ?? "document"}`}>
                  <Eye className="size-4" aria-hidden /> Preview
                </Button>
                <Button variant="outline" size="sm" onClick={() => void downloadFile(f.fileId, source, f.name ?? "file").catch(fail)} aria-label={`Download ${f.name ?? "document"}`}>
                  <Download className="size-4" aria-hidden /> Download
                </Button>
                {editable && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(f)} aria-label={`Remove ${f.name ?? "document"}`}>
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !editable && <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No additional documents.</p>
      )}
      {editable && (
        <div className="space-y-2">
          <FileUploader
            id="so-documents"
            files={picked}
            onChange={(f) => void upload(f)}
            accept={SO_DOC_ACCEPT}
            multiple
            compact
            disabled={add.isPending}
            onPreview={(f) => setPreview({ local: f })}
            hint="Optional · images, PDF, Excel, Word, PowerPoint or CSV · up to 10 at a time · uploaded as soon as you pick them"
          />
          {add.isPending && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Uploading {picked.length} document{picked.length === 1 ? "" : "s"}…
            </p>
          )}
        </div>
      )}
      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this document?"
        description={`${removing?.name ?? "The document"} is removed from the SO handover. A copy already sent with a request email stays in the email history.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(removing!.fileId);
            setRemoving(null);
            toast("Document removed");
          } catch (e) {
            fail(e);
          }
        }}
      />
    </Card>
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
  /** Client Servicing workflow, handover sent without details: the assigned person completes type, POC contacts and shops. */
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
  // Handover details (type, POC contacts, shop list, images): the BD before handover, or the assigned Client Servicing
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
      {/* Same client as an earlier order: its saved contacts were copied in; edit, add or remove them here. */}
      {data.contactsFrom && (data.soContacts.length > 0 || (data.orderContacts?.length ?? 0) > 0) && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-muted-foreground">
          <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Contacts loaded from this client&apos;s saved contacts{data.contactsFrom.orderNo ? <> (last updated in <b className="text-foreground">{data.contactsFrom.orderNo}</b>)</> : null}. Added or edited contacts and the primary are kept for this client&apos;s next order; a contact removed here is removed from this order only.
          </span>
        </p>
      )}
      <ClientSection
        order={order}
        // Recce route: no Add Contact Person (the contact person comes from Zoho, or one row for this order).
        canAddContact={!recce && canWrite && open && can("clients:write")}
        aso={data.full && data.type === "ASO"}
        recce={recce}
        orderContacts={data.orderContacts ?? []}
        // Recce Team > Assign Type & Details, client without contact persons: one mandatory contact for this order.
        manualEditable={recce && details}
      />
      <TypeSection orderId={order._id} data={data} editable={details} toggle={toggle} />
      <AnimatePresence initial={false}>
        {data.full && (
          <motion.div key="full" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            {/* POC contacts: every assign type (required for SO only); kept when the type changes. */}
            {data.type && (
              <PocContactsSection
                orderId={order._id}
                saved={data.soContacts}
                editable={details}
                // Recce route: required for every type; the BD / Client Servicing handover: SO only.
                required={recce || data.type === "ASO"}
                clientContacts={pocChoicesOf(order.client.contacts?.length ? order.client.contacts : (data.orderContacts ?? []))}
                primary={data.primaryContact ?? null}
              />
            )}
            {/* SO: optional documents right below the POC contacts (kept, hidden, for the other types). */}
            {data.type === "ASO" && <SoDocumentsSection orderId={order._id} saved={data.soDocuments ?? []} editable={details} />}
            {/* Each shop type has its own list; keyed by type so nothing of the other type's table stays on screen. */}
            {(data.type === "SHOP_DETAILS" || data.type === "SHOP_MEASUREMENT") && (
              <div id="ho-shops" className="space-y-3">
                {/* The client's Excel is taken as it is: only an empty list blocks the step. */}
                {details && !data.shopList?.total && (
                  <p role="alert" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden /> Add the shop list: upload the Excel or add the shops.
                  </p>
                )}
                <ShopTable key={data.type} orderId={order._id} type={data.type} summary={data.shopList} columns={data.columns} editable={details} canAddImages={!readOnly && (canWrite || (csEdit && !locked))} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <HandoverChat orderId={order._id} messages={data.messages} source={{ orderId: order._id }} canPost={!readOnly && (canWrite || csReply || csEdit)} canDelete={(canWrite || csEdit) && open} />
      {!recce && canWrite && open && <AssignSection orderId={order._id} data={data} order={order} onAssigned={onAssigned} />}
      {!open && canWrite && !recce && !readOnly && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" aria-hidden /> Messages, files, voice notes and shop images can still be added; Client Servicing is notified.
        </p>
      )}
    </div>
  );
}
