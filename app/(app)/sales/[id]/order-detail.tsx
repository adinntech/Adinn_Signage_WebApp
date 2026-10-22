"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderDetailView, type OrderTab } from "@/components/sales/order-detail-view";

/** Full-page order details (deep links); the Kanban opens the same view in a modal. */
export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1600px] space-y-3">
      <Link href="/sales" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Sales Handling
      </Link>
      <OrderDetailView id={id} initialTab={(params.get("tab") as OrderTab) || null} onTabChange={(t) => router.replace(`/sales/${id}?tab=${t}`, { scroll: false })} />
    </div>
  );
}
