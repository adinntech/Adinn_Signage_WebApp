import { ClientProfile } from "@/components/client-servicing/client-profile";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default function ClientProfilePage() {
  return <ClientProfile />;
}
