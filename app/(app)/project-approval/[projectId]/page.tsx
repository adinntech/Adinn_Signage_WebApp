import { ApprovalProjectOverview } from "@/components/project-approval/project-overview";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ApprovalProjectOverview projectId={projectId} />;
}
