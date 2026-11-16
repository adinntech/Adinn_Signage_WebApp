"use client";

import { useEffect, useState } from "react";
import { Smartphone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { mpinError } from "@/lib/auth-rules";
import { useCreateVendorLogin, useEnsureVendorLogin, useResetVendorMpin, useVendorLogins, useVendorZohoDetails, type Vendor, type VendorLoginInput } from "@/lib/api/vendors";

const EMPTY: VendorLoginInput = { name: "", phone: "", employeeId: "", email: "", mpin: "" };

/** Create-login dialog for one vendor. Shared by the vendor record and the "give shops to a login" step. */
export function AddVendorLoginModal({ vendor, open, onOpenChange, prefill, onCreated }: {
  vendor: Pick<Vendor, "_id" | "name">; open: boolean; onOpenChange: (open: boolean) => void;
  /** Details already known (from the vendor's email / mobile), so only the MPIN and employee ID are typed. */ prefill?: Partial<VendorLoginInput>;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const create = useCreateVendorLogin(vendor._id);
  const start = { ...EMPTY, ...prefill };
  const [f, setF] = useState(start);
  const [server, setServer] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const set = (k: keyof VendorLoginInput) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  // The vendor's details are read live from Zoho Books when the dialog opens; only fields still empty are filled, so typing is never overwritten.
  const zoho = useVendorZohoDetails(vendor._id, open);
  const z = zoho.data?.vendor;
  useEffect(() => {
    if (!z) return;
    setF((p) => ({
      ...p,
      name: p.name || (z.contactPerson ?? z.name ?? ""),
      phone: p.phone || (z.mobile ?? "").replace(/\D/g, "").slice(-10),
      email: p.email || (z.email ?? ""),
      employeeId: p.employeeId || (zoho.data?.vendorNo ?? ""),
    }));
  }, [z, zoho.data?.vendorNo]);

  const local: Record<string, string | null> = {
    name: f.name.trim().length < 2 ? "Enter the full name" : null,
    phone: /^\d{10}$/.test(f.phone) ? null : "Phone number must be exactly 10 digits",
    employeeId: /^[A-Za-z0-9._-]{2,30}$/.test(f.employeeId) ? null : "Use 2 to 30 letters, numbers, dot, dash or underscore",
    email: /^\S+@\S+\.\S+$/.test(f.email) ? null : "Enter a valid email address",
    mpin: mpinError(f.mpin),
  };
  const err = (k: string) => (tried ? local[k] : null) ?? server[k];
  const valid = Object.values(local).every((v) => !v);

  const submit = () => {
    setTried(true);
    if (!valid) return;
    create.mutate({ ...f, name: f.name.trim(), email: f.email.trim().toLowerCase() }, {
      onSuccess: () => { toast(`Login created for ${f.name.trim()}`); onOpenChange(false); setF(start); setTried(false); setServer({}); onCreated?.(); },
      onError: (e) => { setServer(fieldErrorsOf(e)); toast(errorMessage(e), "error"); },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) { setTried(false); setServer({}); } }}
      title="Add vendor login"
      description={`${vendor.name} · signs in on the mobile app with phone or employee ID and MPIN`}
      className="max-w-md"
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={create.isPending} onClick={submit}>Create login</Button></div>}
    >
      <div className="grid gap-3">
        {zoho.isLoading ? <p className="text-xs text-muted-foreground">Reading the vendor from Zoho Books…</p>
          : z ? <p className="rounded-lg bg-[#eef4ff] px-3 py-2 text-xs text-navy">From Zoho Books{zoho.data?.vendorNo ? ` · Vendor ID ${zoho.data.vendorNo}` : ""}{z.gstin ? ` · GST ${z.gstin}` : ""}{z.district ? ` · ${z.district}` : ""}{z.address ? ` · ${z.address}` : ""}</p>
          : zoho.isError ? <p className="text-xs text-muted-foreground">Zoho Books details could not be read. Type the details below.</p> : null}
        <Field label="Full name" htmlFor="vl-name" required error={err("name")}><Input id="vl-name" maxLength={80} value={f.name} onChange={set("name")} aria-invalid={!!err("name")} /></Field>
        <Field label="Mobile" htmlFor="vl-phone" required error={err("phone")}><Input id="vl-phone" format="phone" value={f.phone} onChange={set("phone")} aria-invalid={!!err("phone")} /></Field>
        <Field label="Employee ID" htmlFor="vl-emp" required error={err("employeeId")}><Input id="vl-emp" maxLength={30} value={f.employeeId} onChange={set("employeeId")} aria-invalid={!!err("employeeId")} /></Field>
        <Field label="Email" htmlFor="vl-email" required error={err("email")}><Input id="vl-email" format="email" value={f.email} onChange={set("email")} aria-invalid={!!err("email")} /></Field>
        <Field label="MPIN" htmlFor="vl-mpin" required error={err("mpin")} hint="4 digits"><Input id="vl-mpin" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" value={f.mpin} onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); set("mpin")(e); }} aria-invalid={!!err("mpin")} /></Field>
      </div>
    </Modal>
  );
}

/** Mobile logins of one vendor. A login created here is linked to this vendor, so the app shows only the shops given to it. */
export function VendorLogins({ vendor, prefill, startOpen }: { vendor: Pick<Vendor, "_id" | "name">; prefill?: Partial<VendorLoginInput>; startOpen?: boolean }) {
  const logins = useVendorLogins(vendor._id);
  const toast = useToast();
  const ensure = useEnsureVendorLogin(vendor._id);
  const reset = useResetVendorMpin(vendor._id);
  const [open, setOpen] = useState(!!startOpen);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const makeDefault = () => ensure.mutate(undefined, {
    onSuccess: (r) => toast(r.skipped ? "This vendor has no vendor ID yet. Enter it first" : r.created ? `Login created: ${r.username} · MPIN is the last 4 digits of the vendor ID` : "This vendor already has a login", r.skipped ? "error" : undefined),
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const doReset = (id: string) => reset.mutate(id, {
    onSuccess: () => { toast("MPIN reset to the last 4 digits of the vendor ID. The vendor must set a new one at next sign-in"); setConfirmId(null); },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <section aria-label="Vendor logins" className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy"><Smartphone className="size-4 text-vendor" aria-hidden /> Mobile logins</h3>
        <div className="ml-auto flex gap-2">
          {!logins.data?.length && <Button size="sm" loading={ensure.isPending} onClick={makeDefault}>Create default login</Button>}
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}><UserPlus className="size-3.5" aria-hidden /> Add login</Button>
        </div>
      </div>
      {logins.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : !logins.data?.length ? (
        <p className="text-xs text-muted-foreground">No login yet. Add one so this vendor can see its shops in the mobile app.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {logins.data.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="font-medium">{l.name}</span>
              <span className="text-xs text-muted-foreground">
                {l.phone ?? "-"} · {l.employeeId ?? "-"}{l.hasEmail ? "" : " · no email"}{l.mustChangeMpin ? " · default MPIN" : ""}{l.isActive ? "" : " · disabled"}
              </span>
              {confirmId === l.id ? (
                <span className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
                  <Button size="sm" loading={reset.isPending} onClick={() => doReset(l.id)}>Yes, reset</Button>
                </span>
              ) : <Button size="sm" variant="outline" onClick={() => setConfirmId(l.id)}>Reset MPIN</Button>}
            </li>
          ))}
        </ul>
      )}
      <AddVendorLoginModal vendor={vendor} open={open} onOpenChange={setOpen} prefill={prefill} />
    </section>
  );
}
