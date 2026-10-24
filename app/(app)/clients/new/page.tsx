import { NewClientForm } from "./company/new-client-form";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

/** Add Client opens the company form directly (no New / Existing choice in Client Management). */
export default function AddClientPage() {
  return <NewClientForm />;
}
