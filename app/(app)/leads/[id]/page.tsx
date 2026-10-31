import { Suspense } from "react";
import { CsRouteRedirect } from "@/components/leads/cs-route-redirect";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadWorkspace } from "@/components/leads/lead-workspace";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function LeadPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CsRouteRedirect>
        <LeadWorkspace />
      </CsRouteRedirect>
    </Suspense>
  );
}
