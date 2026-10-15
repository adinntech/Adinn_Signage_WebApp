import { ProjectsTableView } from "@/components/projects/projects-table-view";

export default function RecceRequestsPage() {
  return (
    <ProjectsTableView
      title="Recce requests"
      subtitle="New project requests waiting to be picked up for recce planning."
      fixedStatus="NEW"
    />
  );
}
