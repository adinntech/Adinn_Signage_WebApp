import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderDetail } from "./order-detail";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function OrderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <OrderDetail />
    </Suspense>
  );
}
