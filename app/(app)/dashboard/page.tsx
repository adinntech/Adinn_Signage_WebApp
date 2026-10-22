import { DashboardView } from "./dashboard-view";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}
