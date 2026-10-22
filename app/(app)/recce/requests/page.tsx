import { ProjectsTableView } from "@/components/projects/projects-table-view";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function RecceRequestsPage() {
  return (
    <ProjectsTableView
      title="Recce requests"
      subtitle="New project requests waiting to be picked up for recce planning."
      fixedStatus="NEW"
    />
  );
}
