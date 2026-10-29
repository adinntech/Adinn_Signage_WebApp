import { ProjectJourneyView } from "@/components/journey/project-journey-view";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default function ProjectJourneyPage() {
  return <ProjectJourneyView />;
}
