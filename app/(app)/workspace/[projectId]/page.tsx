import { WorkspaceView } from "@/components/workspace/workspace-view";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default function WorkspacePage() {
  return <WorkspaceView />;
}
