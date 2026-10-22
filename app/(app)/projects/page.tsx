import { ProjectsTableView } from "@/components/projects/projects-table-view";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

export default function ProjectsPage() {
  return <ProjectsTableView title="Projects" subtitle="Every signage recce project, from requirement to handover." />;
}
