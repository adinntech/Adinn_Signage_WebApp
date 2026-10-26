import { NewLeadWorkspace } from "@/components/leads/lead-workspace";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function NewLeadPage() {
  return <NewLeadWorkspace />;
}
