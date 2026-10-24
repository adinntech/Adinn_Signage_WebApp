"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, FilePlus2, Repeat, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { useClient, useClients, type ClientType } from "@/lib/api/clients";
import { newRequestKey, useCreateOrder, type Order } from "@/lib/api/sales";
import { cn } from "@/lib/utils";

const FLAGS: { value: ClientType; label: string; hint: string; icon: typeof Sparkles }[] = [
  { value: "NEW", label: "New Client", hint: "First business with this client", icon: Sparkles },
  { value: "EXISTING", label: "Existing Client", hint: "Repeat order from a client we already serve", icon: Repeat },
];

/** Body of the dialog; mounted only while open, so every opening starts with an empty form and a fresh request key. */
function CreateOrderForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (o: Order) => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [client, setClient] = useState<SearchOption | null>(null);
  const [flag, setFlag] = useState<ClientType | null>(null);
  const [error, setError] = useState<string>();
  const [requestKey] = useState(newRequestKey);
  const dq = useDebounced(query);
  const options = useClients({ q: dq, status: "ACTIVE", limit: 20, sort: "name" });
  const details = useClient(client?.value);
  const create = useCreateOrder();

  // Suggested flag: New for the client's first order, Existing once it has orders. The BD can change it.
  const orderCount = details.data?._id === client?.value ? details.data?.orderCount : undefined;
  const suggested: ClientType | null = orderCount === undefined ? null : orderCount > 0 ? "EXISTING" : "NEW";
  const chosen = flag ?? suggested;

  const opts: SearchOption[] = (options.data?.data ?? []).map((c) => ({ value: c._id, label: c.name, sublabel: [c.clientNo, c.city].filter(Boolean).join(" · ") }));

  const submit = async () => {
    if (!client) return setError("Select the client company");
    if (!chosen) return setError("Choose New Client or Existing Client");
    try {
      const r = await create.mutateAsync({ clientId: client.value, clientType: chosen, requestKey });
      toast(`Order ${r.order.orderNo} created for ${client.label}.`);
      onCreated(r.order);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-5">
      {/* Room for the open client list inside the dialog's scroll area. */}
      <div className="min-h-[300px] space-y-5">
        <Field label="Client Company Name" htmlFor="co-client" required error={!client ? error : undefined}>
          <SearchSelect
            id="co-client"
            value={client}
            options={opts}
            query={query}
            onQueryChange={setQuery}
            onSelect={(o) => {
              setClient(o);
              setFlag(null);
              setQuery("");
              setError(undefined);
            }}
            onClear={() => {
              setClient(null);
              setFlag(null);
            }}
            loading={options.isFetching}
            invalid={!client && !!error}
            placeholder="Search company name or Client ID..."
            emptyText="No registered client matches. Add the client in Client Management first."
          />
        </Field>

        <fieldset disabled={!client} className="min-w-0 disabled:opacity-60">
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            Client Flag <span className="text-danger">*</span>
          </legend>
          <div role="radiogroup" aria-label="Client flag" className="grid gap-3 sm:grid-cols-2">
            {FLAGS.map((f) => {
              const on = chosen === f.value;
              return (
                <label
                  key={f.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    on ? (f.value === "NEW" ? "border-warning bg-warning-soft/50" : "border-success bg-success-soft/50") : "border-border hover:bg-muted/60",
                  )}
                >
                  <input type="radio" name="co-flag" className="sr-only" checked={on} onChange={() => setFlag(f.value)} />
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", f.value === "NEW" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                    <f.icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.hint}</span>
                    {suggested === f.value && <span className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">Suggested</span>}
                  </span>
                </label>
              );
            })}
          </div>
          {client && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden />
              {orderCount === undefined ? "Checking this client's orders..." : orderCount === 0 ? "This client has no orders yet." : `This client already has ${orderCount} order${orderCount === 1 ? "" : "s"}.`}
            </p>
          )}
        </fieldset>

        {error && client && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients/new">
            <UserPlus className="size-4" aria-hidden /> Add New Client
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} loading={create.isPending}>
            <FilePlus2 className="size-4" aria-hidden /> Create Order
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Order Management: pick a registered client and flag it New / Existing to create an order. */
export function CreateOrderDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (o: Order) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Create Order" description="Select the client company and flag it as a new or existing client." className="max-w-2xl">
      <CreateOrderForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
    </Modal>
  );
}
