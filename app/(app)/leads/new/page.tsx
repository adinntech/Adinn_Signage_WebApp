import { NewLeadWorkspace } from "@/components/leads/lead-workspace";
import { Suspense } from "react";
import { CsRouteRedirect } from "@/components/leads/cs-route-redirect";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function NewLeadPage() {
  return (
    <Suspense>
      <CsRouteRedirect>
        <NewLeadWorkspace />
      </CsRouteRedirect>
    </Suspense>
  );
}
