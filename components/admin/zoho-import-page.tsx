"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Building2, CloudDownload, IndianRupee, ListChecks, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DetailItem, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useZohoClients, useZohoImport, useZohoPreview } from "@/lib/api/zoho";

/** Company names only need letters, digits and a few punctuation marks. */
const NAME_CHARS = /[^A-Za-z0-9 .,&()'/-]/g;

/** SUPER_ADMIN: find a Zoho Books customer by name, review its details, and add it to the Clients collection with OK. */
export function ZohoImportPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>();
  const [page, setPage] = useState(1);
  const q = useDebounced(query.trim());
  const search = useZohoClients(q, page);
  const preview = useZohoPreview(picked);
  const run = useZohoImport();

  const onOk = async () => {
    if (!picked) return;
    try {
      const r = await run.mutateAsync(picked);
      const verb = r.outcome === "CREATED" ? "added to" : r.outcome === "LINKED" ? "linked with the existing client in" : "refreshed in";
      toast(`${r.client.name} ${verb} Clients (${r.client.clientNo}).`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const p = preview.data;
  const c = p?.client;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader icon={CloudDownload} title="Import Client from Zoho" subtitle="Search an existing customer in Zoho Books and add it to the Clients list." />
      <Card className="p-5 sm:p-6">
        <SectionTitle icon={Search} title="Search Zoho customers" description="Type part of the company name, e.g. agni." />
        <div className="max-w-2xl">
          <label htmlFor="zoho-q" className="sr-only">
            Company name
          </label>
          <Input
            id="zoho-q"
            value={query}
            maxLength={100}
            placeholder="Company name, Client ID, GSTN,..."
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value.replace(NAME_CHARS, ""));
              setPage(1);
              setPicked(undefined);
            }}
          />
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="max-h-80 overflow-y-auto">
            {search.isPending ? (
              <RowsSkeleton rows={4} className="p-3" />
            ) : search.isError ? (
              <ErrorState error={search.error} onRetry={() => search.refetch()} title="Could not load Zoho customers" />
            ) : search.data.rows.length === 0 ? (
              <EmptyState title="No Zoho customer matches" description="Check the spelling or try a shorter name." />
            ) : (
              <ul className="divide-y">
                {search.data.rows.map((r) => (
                  <li key={r.contactId}>
                    <button
                      type="button"
                      onClick={() => setPicked(r.contactId)}
                      aria-pressed={picked === r.contactId}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted ${picked === r.contactId ? "bg-brand-soft" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[r.gstin, r.email, r.phone].filter(Boolean).join(" · ")}</span>
                      </span>
                      {r.imported && <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">In Clients {r.clientNo}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t bg-muted px-4 py-2 text-sm">
            <span className="text-muted-foreground">Page {page}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1 || search.isFetching} onClick={() => setPage((n) => n - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={!search.data?.hasMore || search.isFetching} onClick={() => setPage((n) => n + 1)}>
                Next
              </Button>
            </span>
          </div>
        </div>
      </Card>

      {picked &&
        (preview.isPending ? (
          <Card className="p-5">
            <RowsSkeleton rows={5} />
          </Card>
        ) : preview.isError || !p || !c ? (
          <Card>
            <ErrorState error={preview.error} onRetry={() => preview.refetch()} title="Could not load this customer" />
          </Card>
        ) : (
          <>
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={Building2} title="Details from Zoho" description="This is exactly what will be stored in Clients. Invalid mobiles, emails or GSTINs are left out." />
              <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem label="Client ID">
                  <span className="font-mono text-brand">{p.identity.clientNo}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.identity.mode === "NEW" ? "assigned when you click OK" : p.identity.mode === "LINK" ? "existing client, will be linked" : "already imported"}</span>
                </DetailItem>
                <DetailItem label="Client Code">
                  <span className="font-mono">{p.identity.code}</span>
                </DetailItem>
                <DetailItem label="Zoho Customer No">{p.zohoCustomerNo}</DetailItem>
                <DetailItem label="Zoho Contact ID">
                  <span className="font-mono text-xs">{p.contactId}</span>
                </DetailItem>
                <DetailItem label="Company Name">{c.name}</DetailItem>
                <DetailItem label="Company Email">{c.email}</DetailItem>
                <DetailItem label="GST Number">{c.gstin}</DetailItem>
                <DetailItem label="Address" className="sm:col-span-2">
                  {[c.address, c.city, c.state].filter(Boolean).join(", ") + (c.pincode ? ` - ${c.pincode}` : "")}
                </DetailItem>
                <DetailItem label="Industry">{c.industry}</DetailItem>
              </dl>
            </Card>
            <Card className="overflow-hidden">
              <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                <SectionTitle icon={Users} title="Contact persons" />
              </div>
              {c.contacts.length === 0 ? (
                <EmptyState title="No contact persons in Zoho" description="Add them later from the client details page." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Designation</th>
                        <th className="px-5 py-3">Mobile</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Primary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {c.contacts.map((k, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3">{k.name}</td>
                          <td className="px-5 py-3">{k.designation ?? "-"}</td>
                          <td className="px-5 py-3">{k.phone ?? "-"}</td>
                          <td className="px-5 py-3">{k.email ?? "-"}</td>
                          <td className="px-5 py-3">{k.isPrimary ? "Yes" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            {/* <Card className="overflow-hidden">
              <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                <SectionTitle icon={IndianRupee} title="Recent payments" description="Shown for reference; payments are not stored in Clients." />
              </div>
              {p.payments.length === 0 ? (
                <EmptyState title="No payments in Zoho" />
              ) : (
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Payment #</th>
                        <th className="px-5 py-3">Mode</th>
                        <th className="px-5 py-3">Invoices</th>
                        <th className="px-5 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {p.payments.map((x) => (
                        <tr key={x.id}>
                          <td className="px-5 py-3">{formatDate(x.date)}</td>
                          <td className="px-5 py-3">{x.number ?? "-"}</td>
                          <td className="px-5 py-3">{x.mode ?? "-"}</td>
                          <td className="px-5 py-3">{x.invoices ?? "-"}</td>
                          <td className="px-5 py-3 text-right">{formatCurrency(x.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card className="overflow-hidden">
              <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                <SectionTitle icon={ListChecks} title="Tasks" description="Zoho tasks linked to this customer; shown for reference, not stored." />
              </div>
              {!p.tasks.available ? (
                <EmptyState title="Tasks are not available" description="The Zoho token has no access to tasks. Add the tasks read scope to the Self Client." />
              ) : p.tasks.items.length === 0 ? (
                <EmptyState title="No tasks for this customer" />
              ) : (
                <ul className="max-h-60 divide-y overflow-y-auto text-sm">
                  {p.tasks.items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0 truncate font-medium">{t.title ?? "Untitled task"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{[t.status, t.dueDate && formatDate(t.dueDate), t.assignee].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card> */}
            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card p-4">
              {p.imported && (
                <span className="mr-auto flex items-center gap-1.5 text-sm text-success">
                  <BadgeCheck className="size-4" aria-hidden /> Already in Clients ({p.clientNo}). OK refreshes it.
                </span>
              )}
              <Button variant="ghost" asChild>
                <Link href="/clients">View Clients</Link>
              </Button>
              <Button onClick={onOk} disabled={run.isPending}>
                {run.isPending ? "Saving..." : p.imported ? "OK - Refresh" : "OK - Add to Clients"}
              </Button>
            </div>
          </>
        ))}
    </div>
  );
}
