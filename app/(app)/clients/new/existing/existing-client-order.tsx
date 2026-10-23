"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Building2, ExternalLink, FilePlus2, Search, Star, Users } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailItem, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { FormActionBar } from "@/components/clients/company-form";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { clientTypeOf, useClients, type Client } from "@/lib/api/clients";
import { newRequestKey, useCreateOrder } from "@/lib/api/sales";

const addressOf = (c: Client) => [c.address, c.city, c.district, c.state].filter(Boolean).join(", ") + (c.pincode ? ` - ${c.pincode}` : "");

/** Screen 04: pick a registered company and create another order for it (company record is not modified). */
export function ExistingClientOrder() {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const dq = useDebounced(query);
  const options = useClients({ q: dq, status: "ACTIVE", limit: 20, sort: "name" });
  const create = useCreateOrder();
  const requestKey = useRef(newRequestKey());

  // Next keeps visited routes mounted (React Activity), so state survives leaving the page. Start every visit fresh:
  // the cleanup runs when the page is hidden (navigating away, including after Create New Order), not on re-renders.
  useLayoutEffect(
    () => () => {
      setSelected(null);
      setQuery("");
      requestKey.current = newRequestKey();
    },
    [],
  );

  const opts: SearchOption[] = (options.data?.data ?? []).map((c) => ({ value: c._id, label: c.name, sublabel: [c.clientNo, c.city, c.email].filter(Boolean).join(" · ") }));

  const onCreate = async () => {
    if (!selected) return;
    try {
      const r = await create.mutateAsync({ clientId: selected._id, requestKey: requestKey.current });
      toast(`Order ${r.order.orderNo} created for ${selected.name} in New Order.`);
      // Open the new order in the Sales Handling modal; replace so Back does not return to the submitted form.
      router.replace(`/sales?order=${r.order._id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        icon={Users}
        title="Existing Client Selection"
        subtitle="Select a registered company to create a new order."
        className="mb-5"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/clients/new">
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Link>
          </Button>
        }
      />
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Search} title="Existing Company Selection" description="Search by company name or Client ID." />
          <div className="max-w-2xl">
            <label htmlFor="existing-client" className="sr-only">
              Company Name
            </label>
            <SearchSelect
              id="existing-client"
              value={selected ? { value: selected._id, label: `${selected.name} (${selected.clientNo ?? selected.code})` } : null}
              options={opts}
              query={query}
              onQueryChange={setQuery}
              onSelect={(o) => {
                setSelected(options.data?.data.find((c) => c._id === o.value) ?? null);
                setQuery("");
                requestKey.current = newRequestKey();
              }}
              loading={options.isFetching}
              placeholder="Search company name or Client ID..."
              emptyText="No registered company matches. Use New Client to register it."
            />
          </div>
        </Card>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div key={selected._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <Card className="p-5 sm:p-6">
                <SectionTitle icon={Building2} title="Selected Company Information" description="Shown from the client master; it is not changed by creating an order." action={<ClientTypeBadge type={clientTypeOf(selected)} />} />
                <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <DetailItem label="Company Name">{selected.name}</DetailItem>
                  <DetailItem label="Client ID">
                    <span className="font-mono text-brand">{selected.clientNo ?? selected.code}</span>
                  </DetailItem>
                  <DetailItem label="Company Email">{selected.email}</DetailItem>
                  <DetailItem label="Company Address" className="sm:col-span-2">
                    {addressOf(selected)}
                  </DetailItem>
                  <DetailItem label="GST Number">{selected.gstin}</DetailItem>
                  <DetailItem label="Industry">{selected.industry}</DetailItem>
                </dl>
              </Card>
              <Card className="overflow-hidden">
                <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                  <SectionTitle icon={Users} title="Registered Contact Persons" />
                </div>
                {selected.contacts.length === 0 ? (
                  <EmptyState title="No contact persons registered" description="Add contacts from the client details page." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3">Contact Name</th>
                          <th className="px-5 py-3">Designation</th>
                          <th className="px-5 py-3">Mobile Number</th>
                          <th className="px-5 py-3">Email Address</th>
                          <th className="px-5 py-3">Primary Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selected.contacts.map((k, i) => (
                          <tr key={`${k.name}-${i}`}>
                            <td className="px-5 py-3 font-medium">{k.name}</td>
                            <td className="px-5 py-3">{k.designation ?? "-"}</td>
                            <td className="px-5 py-3 tabular-nums">{k.phone ? `+91 ${k.phone}` : "-"}</td>
                            <td className="px-5 py-3">{k.email ?? "-"}</td>
                            <td className="px-5 py-3">
                              {k.isPrimary ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                                  <Star className="size-3" aria-hidden /> Primary
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <EmptyState icon={Search} title="Select a company" description="Company information and its registered contacts appear here." />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FormActionBar>
        <Button variant="ghost" asChild>
          <Link href="/clients">
            <ArrowLeft className="size-4" aria-hidden /> Back to Client List
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/clients/new">Cancel</Link>
        </Button>
        {selected ? (
          <Button variant="brand-outline" asChild>
            <Link href={`/clients/${selected._id}`}>
              <ExternalLink className="size-4" aria-hidden /> View Client Details
            </Link>
          </Button>
        ) : (
          <Button variant="brand-outline" disabled>
            <Building2 className="size-4" aria-hidden /> View Client Details
          </Button>
        )}
        <Button variant="brand" disabled={!selected} loading={create.isPending} onClick={onCreate}>
          <FilePlus2 className="size-4" aria-hidden /> Create New Order
        </Button>
      </FormActionBar>
    </div>
  );
}
