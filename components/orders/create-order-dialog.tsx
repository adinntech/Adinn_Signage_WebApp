"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, CloudDownload, FilePlus2, Info, Repeat, Sparkles } from "lucide-react";
import { AddClientModal } from "@/components/clients/add-client-modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { DetailItem } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { useClient, useClients, type ClientType } from "@/lib/api/clients";
import { newRequestKey, useCreateOrder, useZohoClients, type Order } from "@/lib/api/sales";
import { cn } from "@/lib/utils";

const FLAGS: { value: ClientType; label: string; hint: string; icon: typeof Sparkles }[] = [
  { value: "NEW", label: "New Client", hint: "Pick from Client Management", icon: Sparkles },
  { value: "EXISTING", label: "Existing Client", hint: "Pick from the Zoho customer list", icon: Repeat },
];

/** What the preview card shows, from Client Management or from Zoho. */
interface Preview {
  name: string;
  clientName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  clientNo?: string | null;
}

/**
 * Flag first (New / Existing), then the client (Client Management or Zoho, with "+ Add New Client" for a company that
 * is not registered yet), then Create: the order and its lead (at Project Assign) are created together.
 * Mount it only while it is shown, so each opening starts empty with a fresh request key.
 */
export function OrderClientForm({
  onCancel,
  onCreated,
  withNotes = false,
  submitLabel = "Create Order",
}: {
  onCancel: () => void;
  onCreated: (o: Order) => void;
  /** New Lead: also ask for the first discussion notes. */
  withNotes?: boolean;
  submitLabel?: string;
}) {
  const toast = useToast();
  const [flag, setFlag] = useState<ClientType | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SearchOption | null>(null);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [error, setError] = useState<string>();
  const [requestKey] = useState(newRequestKey);
  const dq = useDebounced(query);
  const crm = useClients({ q: dq, status: "ACTIVE", source: "CRM", limit: 20, sort: "name" }, flag === "NEW");
  const zoho = useZohoClients(dq, flag === "EXISTING");
  const details = useClient(flag === "NEW" ? picked?.value : undefined);
  const create = useCreateOrder();

  const zohoRows = zoho.data?.items ?? [];
  const opts: SearchOption[] =
    flag === "NEW"
      ? (crm.data?.data ?? []).map((c) => ({ value: c._id, label: c.name, sublabel: [c.clientNo, c.clientName, c.phone].filter(Boolean).join(" · ") }))
      : zohoRows.map((z) => ({ value: z.zohoId, label: z.name, sublabel: [z.clientNo ? `In CRM as ${z.clientNo}` : null, z.clientName, z.gstin, z.city].filter(Boolean).join(" · ") }));

  const zohoPick = flag === "EXISTING" ? zohoRows.find((z) => z.zohoId === picked?.value) : undefined;
  const crmPick = flag === "NEW" && details.data?._id === picked?.value ? details.data : undefined;
  const preview: Preview | undefined = zohoPick ?? crmPick;

  const chooseFlag = (f: ClientType) => {
    if (f === flag) return;
    setFlag(f);
    setPicked(null);
    setQuery("");
    setError(undefined);
  };

  const submit = async () => {
    if (!flag) return setError("Choose New Client or Existing Client");
    if (!picked) return setError("Select the client company");
    try {
      const body = flag === "NEW" ? { clientId: picked.value } : { zohoId: picked.value };
      const r = await create.mutateAsync({ ...body, clientType: flag, requestKey, initialNotes: notes.trim() || undefined });
      toast(`Order ${r.order.orderNo} created for ${r.client.name}. The lead is at Project Assign.`);
      onCreated(r.order);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-5">
      <div className="min-h-[340px] space-y-5">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            1. Client Flag <span className="text-danger">*</span>
          </legend>
          <div role="radiogroup" aria-label="Client flag" className="grid gap-3 sm:grid-cols-2">
            {FLAGS.map((f) => {
              const on = flag === f.value;
              return (
                <label
                  key={f.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    on ? (f.value === "NEW" ? "border-warning bg-warning-soft/50" : "border-success bg-success-soft/50") : "border-border hover:bg-muted/60",
                  )}
                >
                  <input type="radio" name="co-flag" className="sr-only" checked={on} onChange={() => chooseFlag(f.value)} />
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", f.value === "NEW" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                    <f.icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {!flag && error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </fieldset>

        <AnimatePresence mode="wait" initial={false}>
          {flag && (
            <motion.div key={flag} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-4">
              <Field label={`2. ${flag === "NEW" ? "Client Company (Client Management)" : "Client Company (Zoho)"}`} htmlFor="co-client" required error={!picked ? error : undefined}>
                <SearchSelect
                  id="co-client"
                  value={picked}
                  options={opts}
                  query={query}
                  onQueryChange={setQuery}
                  onSelect={(o) => {
                    setPicked(o);
                    setQuery("");
                    setError(undefined);
                  }}
                  onClear={() => setPicked(null)}
                  loading={flag === "NEW" ? crm.isFetching : zoho.isFetching}
                  invalid={!picked && !!error}
                  placeholder={flag === "NEW" ? "Search company name or Client ID..." : "Search Zoho customer, contact or GST number..."}
                  emptyText={flag === "NEW" ? "No client in Client Management matches. Use + Add New Client." : zoho.isError ? errorMessage(zoho.error) : "No Zoho customer matches."}
                  action={
                    flag === "NEW"
                      ? {
                          label: "+ Add New Client",
                          onSelect: () => {
                            setAddName(query.trim());
                            setAdding(true);
                          },
                        }
                      : undefined
                  }
                />
              </Field>
              {flag === "EXISTING" && zoho.data?.mode === "sample" && (
                <p className="flex items-start gap-2 rounded-lg bg-warning-soft/60 px-3 py-2 text-xs text-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  Zoho is not connected yet, so this is a sample customer list. The real list appears once the Zoho keys are set on the server.
                </p>
              )}

              {picked && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {flag === "NEW" ? <Building2 className="size-3.5" aria-hidden /> : <CloudDownload className="size-3.5" aria-hidden />}
                    {flag === "NEW" ? "Client details" : zohoPick?.clientId ? `Zoho customer · in CRM as ${zohoPick.clientNo}` : "Zoho customer · added to the CRM with this order"}
                  </p>
                  {preview ? (
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <DetailItem label="Company Name">{preview.name}</DetailItem>
                      <DetailItem label="Client Name">{preview.clientName}</DetailItem>
                      <DetailItem label="Company Email">{preview.email}</DetailItem>
                      <DetailItem label="Phone Number">{preview.phone}</DetailItem>
                      <DetailItem label="GST Number">{preview.gstin}</DetailItem>
                      {flag === "NEW" && <DetailItem label="Client ID">{preview.clientNo}</DetailItem>}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading client details...</p>
                  )}
                </motion.div>
              )}

              {withNotes && (
                <Field label="Initial Notes" htmlFor="co-notes" hint="How the client approached us, first discussion points.">
                  <Textarea id="co-notes" maxLength={4000} className="min-h-20" placeholder="e.g. Met at the dealer meet, wants new shop boards for 50 outlets" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && flag && picked && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">The order opens its lead at Project Assign.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} loading={create.isPending}>
            <FilePlus2 className="size-4" aria-hidden /> {submitLabel}
            {withNotes && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>

      <AddClientModal
        open={adding}
        onOpenChange={setAdding}
        initialName={addName}
        onSaved={(c) => {
          setAdding(false);
          setFlag("NEW");
          setPicked({ value: c._id, label: c.name });
          setError(undefined);
        }}
      />
    </div>
  );
}

/** Order Management: flag the client New / Existing first, then pick it (Client Management or Zoho) to create the order and its lead. */
export function CreateOrderDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (o: Order) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Create Order" description="Choose New or Existing client, then select the company." className="max-w-2xl">
      <OrderClientForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
    </Modal>
  );
}
