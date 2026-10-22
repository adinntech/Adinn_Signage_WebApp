import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientDetailsView } from "./client-details";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function ClientDetailsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 max-w-7xl" />}>
      <ClientDetailsView />
    </Suspense>
  );
}
