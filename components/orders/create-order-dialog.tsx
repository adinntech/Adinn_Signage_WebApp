"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, ArrowRight, FilePlus2, Info, Repeat, Sparkles } from "lucide-react";
import { AddClientModal } from "@/components/clients/add-client-modal";
import { ClientEditDrawer, CrmClientCard, ZohoClientCard } from "@/components/clients/client-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { ApiError, errorMessage } from "@/lib/api";
import { useClient, useClients, type ClientType } from "@/lib/api/clients";
import { newRequestKey, useCreateOrder, useZohoClient, useZohoClients, type Order } from "@/lib/api/sales";
import { cn } from "@/lib/utils";

const FLAGS: { value: ClientType; label: string; hint: string; icon: typeof Sparkles }[] = [
  { value: "NEW", label: "New Client", hint: "Pick from Client Management", icon: Sparkles },
  { value: "EXISTING", label: "Existing Client", hint: "Pick from the Zoho customer list", icon: Repeat },
];

/**
 * Flag first (New / Existing), then the client (Client Management or Zoho, with "+ Add New Client" for a company that
 * is not registered yet), then Create: the order and its lead (at Project Assign) are created together.
 * Mount it only while it is shown, so each opening starts empty with a fresh request key.
 * With `fixedFlag` (Create Project, where the flag was chosen on the mind map) the flag cards are hidden.
 * A New Client whose GSTIN belongs to a Zoho customer is sent to Existing Client with that customer picked
 * (`onFlagChange` when the flag is fixed by the parent, which remounts this form with `initialPick`).
 */
export function OrderClientForm({
  onCancel,
  onCreated,
  withNotes = false,
  submitLabel = "Create Order",
  fixedFlag,
  onChangeFlag,
  onFlagChange,
  initialPick,
  onSubmitClient,
  footNote = "The order opens its lead at Project Assign.",
}: {
  onCancel: () => void;
  onCreated: (o: Order) => void;
  /** Create Project: also ask for the first discussion notes. */
  withNotes?: boolean;
  submitLabel?: string;
  fixedFlag?: ClientType;
  /** Back to the New / Existing choice (with `fixedFlag`). */
  onChangeFlag?: () => void;
  /** With `fixedFlag`: switch the flag and pick this client (duplicate GST -> Existing Client). */
  onFlagChange?: (f: ClientType, pick?: SearchOption) => void;
  initialPick?: SearchOption;
  /** Instead of creating an order, hand the picked client back (Lead > Change Client). */
  onSubmitClient?: (body: { clientType: ClientType; clientId?: string; zohoId?: string }, label: string) => Promise<void>;
  footNote?: string;
}) {
  const toast = useToast();
  const [ownFlag, setFlag] = useState<ClientType | null>(null);
  const flag = fixedFlag ?? ownFlag;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SearchOption | null>(initialPick ?? null);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [error, setError] = useState<string>();
  /** The order was refused because this Zoho customer has the client's GSTIN. */
  const [zohoClash, setZohoClash] = useState<SearchOption | null>(null);
  const [editing, setEditing] = useState(false);
  const [requestKey] = useState(newRequestKey);
  const dq = useDebounced(query);
  const crm = useClients({ q: dq, status: "ACTIVE", source: "CRM", limit: 20, sort: "name" }, flag === "NEW");
  const zoho = useZohoClients(dq, flag === "EXISTING");
  const details = useClient(flag === "NEW" ? picked?.value : undefined);
  const zohoDetail = useZohoClient(flag === "EXISTING" ? picked?.value : undefined);
  const create = useCreateOrder();

  const zohoRows = zoho.data?.items ?? [];
  const opts: SearchOption[] =
    flag === "NEW"
      ? (crm.data?.data ?? []).map((c) => ({ value: c._id, label: c.name, sublabel: [c.clientNo, c.clientName, c.phone].filter(Boolean).join(" · ") }))
      : zohoRows.map((z) => ({ value: z.zohoId, label: z.name, sublabel: [z.clientNo ? `In CRM as ${z.clientNo}` : null, z.clientName, z.gstin, z.city].filter(Boolean).join(" · ") }));

  const zohoPick = flag === "EXISTING" ? zohoRows.find((z) => z.zohoId === picked?.value) : undefined;
  const crmPick = flag === "NEW" && details.data?._id === picked?.value ? details.data : undefined;
  // The full read carries the contact persons; the search row shows meanwhile. Only the selected customer's detail is used.
  const zohoView = (zohoDetail.data?.zohoId === picked?.value ? zohoDetail.data : undefined) ?? zohoPick;

  const switchToZoho = (pick: SearchOption) => {
    setAdding(false);
    setZohoClash(null);
    setError(undefined);
    if (fixedFlag) return onFlagChange?.("EXISTING", pick);
    setFlag("EXISTING");
    setPicked(pick);
    setQuery("");
  };

  const chooseFlag = (f: ClientType) => {
    if (f === flag) return;
    setFlag(f);
    setPicked(null);
    setQuery("");
    setError(undefined);
    setZohoClash(null);
  };

  const submit = async () => {
    if (!flag) return setError("Choose New Client or Existing Client");
    if (!picked) return setError("Select the client company");
    try {
      const body = flag === "NEW" ? { clientId: picked.value } : { zohoId: picked.value };
      if (onSubmitClient) return await onSubmitClient({ ...body, clientType: flag }, picked.label);
      const r = await create.mutateAsync({ ...body, clientType: flag, requestKey, initialNotes: notes.trim() || undefined });
      toast(`Order ${r.order.orderNo} created for ${r.client.name}. The lead is at Project Assign.`);
      onCreated(r.order);
    } catch (e) {
      setError(errorMessage(e));
      const d = e instanceof ApiError && e.code === "ZOHO_DUPLICATE_GST" ? (e.details as { zohoId?: string; name?: string }[] | undefined)?.[0] : undefined;
      setZohoClash(d?.zohoId ? { value: d.zohoId, label: d.name ?? "Zoho customer" } : null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="min-h-[340px] space-y-5">
        {fixedFlag ? (
          <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-2.5", fixedFlag === "NEW" ? "border-warning/60 bg-warning-soft/50" : "border-success/60 bg-success-soft/50")}>
            <span className="flex items-center gap-2.5">
              {(() => {
                const f = FLAGS.find((x) => x.value === fixedFlag)!;
                return (
                  <>
                    <span className={cn("flex size-8 items-center justify-center rounded-lg", fixedFlag === "NEW" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                      <f.icon className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{f.label}</span>
                      <span className="block text-xs text-muted-foreground">{f.hint}</span>
                    </span>
                  </>
                );
              })()}
            </span>
            {onChangeFlag && (
              <Button variant="ghost" size="sm" onClick={onChangeFlag} disabled={create.isPending}>
                <ArrowLeftRight className="size-4" aria-hidden /> Change
              </Button>
            )}
          </div>
        ) : (
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
        )}

        <AnimatePresence mode="wait" initial={false}>
          {flag && (
            <motion.div key={flag} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-4">
              <Field label={`${fixedFlag ? "" : "2. "}${flag === "NEW" ? "Client Company (Client Management)" : "Client Company (Zoho)"}`} htmlFor="co-client" required error={!picked ? error : undefined}>
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
                    setZohoClash(null);
                  }}
                  onClear={() => setPicked(null)}
                  loading={flag === "NEW" ? crm.isFetching : zoho.isFetching}
                  invalid={!picked && !!error}
                  placeholder={flag === "NEW" ? "Search company name or Client ID..." : "Search Zoho customer name, Client ID or GST number..."}
                  emptyText={flag === "NEW" ? "No client in Client Management matches. Use Add New Client above." : zoho.isError ? errorMessage(zoho.error) : "No Zoho customer matches."}
                  actionPlacement="top"
                  action={
                    flag === "NEW"
                      ? {
                          label: "Add New Client",
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
                  {flag === "NEW" ? (
                    crmPick ? <CrmClientCard client={crmPick} onEdit={() => setEditing(true)} /> : <p className="text-sm text-muted-foreground">Loading client details...</p>
                  ) : zohoView ? (
                    <ZohoClientCard zoho={zohoView} loadingContacts={zohoDetail.isPending} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{zohoDetail.isError ? errorMessage(zohoDetail.error) : "Loading Zoho customer..."}</p>
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
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
            {zohoClash && (
              <Button type="button" variant="outline" size="sm" className="mt-2 flex" onClick={() => switchToZoho(zohoClash)}>
                <Repeat className="size-3.5" aria-hidden /> Switch to Existing Client · {zohoClash.label}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">{footNote}</p>
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
        onUseZohoClient={(z) => switchToZoho({ value: z.zohoId, label: z.name })}
        onSaved={(c) => {
          setAdding(false);
          setFlag("NEW");
          setPicked({ value: c._id, label: c.name });
          setError(undefined);
        }}
      />
      <ClientEditDrawer clientId={crmPick?._id} open={editing} onOpenChange={setEditing} />
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
