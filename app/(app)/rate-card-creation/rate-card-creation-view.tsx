"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FilePlus2, Plus, ReceiptIndianRupee, RotateCcw, Search } from "lucide-react";
import { RateCardEditor } from "@/components/sales/rate-card/rate-card-stage";
import { ZohoCompanyField } from "@/components/sales/rate-card/zoho-company-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { DateFiltersPanel, EMPTY_RANGE, MoreFiltersButton, datesSet, rangeParams, type DateRange } from "@/components/ui/date-range-filter";
import { Pagination } from "@/components/ui/pagination";
import type { SearchOption } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { useRateCardCreation, useRateCardList, useSaveRateCardCreation } from "@/lib/api/ratecards";
import { newRequestKey } from "@/lib/api/sales";
import { formatDateTimeIST } from "@/lib/format";

const BASE = "/rate-card-creation";
/** Rows per page offered on the list (default 10). */
const LIST_SIZES = [10, 25, 50] as const;

/**
 * One rate card in the editor (preview left, fields right): a new one (id null) or a saved one. The Client Company
 * (Zoho) picker replaces the read-only Company Name; the first save creates the rate card and opens it by its id.
 */
function CardEditor({ id, onCreated }: { id: string | null; onCreated: (id: string) => void }) {
  const q = useRateCardCreation(id);
  const save = useSaveRateCardCreation(id);
  const [requestKey] = useState(newRequestKey);
  // undefined: not changed here (the saved company, if any).
  const [picked, setPicked] = useState<SearchOption | null | undefined>(undefined);
  const [companyError, setCompanyError] = useState<string>();

  if (q.isPending)
    return (
      <div className="grid gap-5 xl:grid-cols-[5fr_7fr]">
        <Skeleton className="h-[640px]" />
        <Skeleton className="h-[640px]" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const company = picked === undefined ? (d.client ? { value: d.client.zohoId, label: d.client.name } : null) : picked;

  return (
    <RateCardEditor
      data={d}
      step={{
        source: { rateCardId: d.orderId },
        clientName: company?.label ?? "",
        save: async (v) => {
          if (!company) {
            setCompanyError("Select the client company");
            throw new Error("Select the client company (Zoho) first.");
          }
          const r = await save.mutateAsync({ ...v, zohoId: company.value, requestKey: id ? undefined : requestKey });
          if (!id) onCreated(r.id);
          return r;
        },
        company: (fill) => (
          <ZohoCompanyField
            value={company}
            onChange={(o) => {
              setPicked(o);
              if (o) setCompanyError(undefined);
            }}
            onFill={fill}
            error={companyError}
          />
        ),
      }}
    />
  );
}

/**
 * Client Servicing > Rate Card Creation: rate cards made without an order. Lines and prices start from the master rate
 * card (Rate Card Management, read only here); each save is a version with its own PDF. The open rate card is in the
 * URL (?card=new | <id>), so a reload keeps it open.
 */
export function RateCardCreationView() {
  const router = useRouter();
  const params = useSearchParams();
  const card = params.get("card");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [created, setCreated] = useState<DateRange>(EMPTY_RANGE);
  const [updated, setUpdated] = useState<DateRange>(EMPTY_RANGE);
  const [moreOpen, setMoreOpen] = useState(false);
  const dq = useDebounced(q);
  // Date ranges are sent only when valid (From on or before To); both ends are whole India days.
  const c = rangeParams(created);
  const u = rangeParams(updated);
  const list = useRateCardList({ q: dq || undefined, page, limit, createdFrom: c.from, createdTo: c.to, updatedFrom: u.from, updatedTo: u.to });
  const rows = list.data?.data ?? [];
  const offset = ((list.data?.meta.page ?? 1) - 1) * (list.data?.meta.limit ?? limit);
  const dated = !!(created.from || created.to || updated.from || updated.to);
  const open = (c: string | null) => router.replace(c ? `${BASE}?card=${encodeURIComponent(c)}` : BASE, { scroll: false });

  return (
    // The page grows with its rows (the main area scrolls), so a page of 10 / 25 / 50 rows shows in full.
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        icon={ReceiptIndianRupee}
        title="Rate Card Creation"
        subtitle="Create client rate cards from the master rates, with a live PDF preview and a PDF for every version."
        actions={
          <Button variant="brand" onClick={() => open("new")}>
            <Plus className="size-4" aria-hidden /> New Rate Card
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search rate cards"
            placeholder="Search quotation ref, company, Client ID or GST"
            className="pl-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <MoreFiltersButton open={moreOpen} count={datesSet(created, updated)} onClick={() => setMoreOpen((o) => !o)} />
        {/* Reset: clears the search and the date filters, and goes back to page 1. */}
        <Button
          variant="outline"
          disabled={!q && !dated && page === 1}
          onClick={() => {
            setQ("");
            setCreated(EMPTY_RANGE);
            setUpdated(EMPTY_RANGE);
            setPage(1);
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Reset
        </Button>
        </div>
        <DateFiltersPanel open={moreOpen} created={created} updated={updated} onCreated={(r) => (setCreated(r), setPage(1))} onUpdated={(r) => (setUpdated(r), setPage(1))} />
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Rate Cards</h2>
          {list.data && <span className="text-xs text-muted-foreground">{list.data.meta.total} rate cards</span>}
        </div>
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title={dq || dated ? "No rate cards match your filters" : "No rate cards yet"}
            action={
              !dq && !dated ? (
                <Button variant="brand" onClick={() => open("new")}>
                  <Plus className="size-4" aria-hidden /> New Rate Card
                </Button>
              ) : undefined
            }
          />
        ) : (
          // Horizontal scroll only: every row of the page shows, the page itself scrolls down.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-16 px-4 py-3">S.No.</th>
                  <th className="px-4 py-3">Quotation Ref</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Client ID</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Last Updated At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <motion.tr key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="cursor-pointer hover:bg-muted/50" onClick={() => open(r._id)}>
                    <td className="px-4 py-3 text-muted-foreground">{offset + i + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-brand">{r.quotationRef}</td>
                    <td className="px-4 py-3 font-semibold">{r.client?.name ?? "-"}</td>
                    <td className="px-4 py-3 font-mono">{r.client?.zohoCustomerNo ?? "-"}</td>
                    <td className="px-4 py-3">{r.label ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.createdBy ?? "-"}</td>
                    {/* India time, e.g. "03 Nov 2026, 04:53 PM". */}
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTimeIST(r.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTimeIST(r.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`View ${r.quotationRef}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          open(r._id);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!list.isError && rows.length > 0 && (
          <Pagination
            meta={list.data?.meta}
            onPage={setPage}
            onLimit={(n) => {
              setLimit(n);
              setPage(1);
            }}
            sizes={LIST_SIZES}
          />
        )}
      </Card>

      <Modal
        open={!!card}
        onOpenChange={(o) => !o && open(null)}
        // Closes only with Close (not Escape or a click outside), so nothing typed is lost.
        dismissible={false}
        variant="drawer"
        className="max-w-[min(1500px,100vw)]"
        title={card === "new" ? "New Rate Card" : "Rate Card"}
        description="Client Company (Zoho), contact and address, signage items and rates from the master rate card, with the live PDF preview."
      >
        {card && <CardEditor key={card} id={card === "new" ? null : card} onCreated={(id) => open(id)} />}
      </Modal>
    </div>
  );
}
