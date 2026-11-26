import { ApprovalProjectsList } from "@/components/project-approval/projects-list";

// Renders only after the client-side sign-in check in AppShell (a server page: "instant" is not allowed in a client module).
export const instant = false;

export default function ProjectApprovalPage() {
  return <ApprovalProjectsList />;
}
