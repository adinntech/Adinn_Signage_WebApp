import { LeadsView } from "../leads/leads-view";

// Client Servicing (active flow): Create Project, the Lead Management list under its own URL.
// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function CreateProjectPage() {
  return <LeadsView />;
}
