import { redirect } from "next/navigation";
import { ProjectWizard } from "@/components/bd/project-wizard";

/** New projects are created by Client Servicing now. This page only continues an existing draft (?edit=<id>). */
export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  if (!edit) redirect("/bd/dashboard");
  return <ProjectWizard />;
}
