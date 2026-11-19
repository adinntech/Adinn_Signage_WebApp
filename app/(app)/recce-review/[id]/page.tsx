import { ReviewWorkspace } from "@/components/recce-review/workspace";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default function RecceReviewWorkspacePage() {
  return <ReviewWorkspace />;
}
