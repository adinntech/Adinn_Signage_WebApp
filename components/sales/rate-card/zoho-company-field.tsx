"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zohoAddress } from "@/components/clients/client-picker";
import { Field } from "@/components/ui/field";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { useDebounced } from "@/hooks/use-debounced";
import { api, errorMessage } from "@/lib/api";
import { useZohoClients, type ZohoClientOption } from "@/lib/api/sales";

/**
 * Client Company (Zoho) for Rate Card Creation, searched the Create Project way: nothing is listed until something is
 * typed, then the matches of what is typed (company name, Client ID, GST number). Choosing a company reads its details
 * (the same read as Create Project) and fills the contact person (Zoho's primary contact, else blank) and the full
 * address; clearing clears them. Reopening a saved rate card keeps its saved fields.
 */
export function ZohoCompanyField({
  value,
  onChange,
  onFill,
  error,
}: {
  value: SearchOption | null;
  onChange: (o: SearchOption | null) => void;
  onFill: (d: { contactName: string; address: string } | null) => void;
  error?: string;
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const dq = useDebounced(query);
  const typed = query.trim();
  const zoho = useZohoClients(dq, !!dq.trim());
  // Rows of an earlier search (still typing, or the previous answer shown while the new one loads) are not offered.
  const stale = dq.trim() !== typed || zoho.isPlaceholderData;
  const rows = !typed || stale ? [] : (zoho.data?.items ?? []);
  const options: SearchOption[] = rows.map((z) => ({ value: z.zohoId, label: z.name, sublabel: [z.zohoCustomerNo ? `Client ID ${z.zohoCustomerNo}` : null, z.gstin, z.city].filter(Boolean).join(" · ") }));

  // Only the latest pick fills the fields (a slower read for an earlier pick is ignored).
  const latestPick = useRef<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string>();

  const pick = async (o: SearchOption) => {
    onChange(o);
    setQuery("");
    setReadError(undefined);
    latestPick.current = o.value;
    setReading(true);
    try {
      const z = await qc.fetchQuery({
        queryKey: ["sales", "zoho-client", o.value],
        queryFn: () => api<ZohoClientOption>(`/sales/zoho-clients/${encodeURIComponent(o.value)}`),
        staleTime: 60_000,
      });
      if (latestPick.current === o.value) onFill({ contactName: z.contacts?.find((k) => k.isPrimary)?.name ?? "", address: zohoAddress(z) });
    } catch (e) {
      if (latestPick.current === o.value) setReadError(errorMessage(e));
    } finally {
      if (latestPick.current === o.value) setReading(false);
    }
  };

  return (
    <Field label="Client Company (Zoho)" htmlFor="rcc-company" required error={error ?? readError} className="md:col-span-2" hint={reading ? "Reading the company's contact and address…" : undefined}>
      <SearchSelect
        id="rcc-company"
        value={value}
        options={options}
        query={query}
        onQueryChange={setQuery}
        onSelect={(o) => void pick(o)}
        onClear={() => {
          latestPick.current = null;
          setReading(false);
          setReadError(undefined);
          onChange(null);
          onFill(null);
        }}
        loading={!!typed && (zoho.isFetching || stale)}
        invalid={!!(error ?? readError)}
        placeholder="Search Zoho customer name, Client ID or GST number..."
        emptyText={!typed ? "Type to search Zoho clients" : zoho.isError ? errorMessage(zoho.error) : "No Zoho customer matches."}
      />
    </Field>
  );
}
