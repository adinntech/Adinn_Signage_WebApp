import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesBoard } from "./sales-board";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function SalesHandlingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SalesBoard />
    </Suspense>
  );
}
