import { CodeRequestHub } from "@/components/client-servicing/code-request-hub";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default function CodeRequestHubPage() {
  return <CodeRequestHub />;
}
