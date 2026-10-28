import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewClientForm } from "./company/new-client-form";

// Pages here render only after the client-side sign-in check in AppShell, so the server cannot prerender them for instant navigation.
export const instant = false;

/** Add Client opens the company form directly (no New / Existing choice in Client Management). `?draft=` resumes a draft. */
export default function AddClientPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-7xl" />}>
      <NewClientForm />
    </Suspense>
  );
}
