import { ProjectTrackingPage } from "@/components/project-tracking/tracking-page";

// Renders only after the client-side sign-in check in AppShell (a server page: "instant" is not allowed in a client module).
export const instant = false;

export default function Page() {
  return <ProjectTrackingPage />;
}
