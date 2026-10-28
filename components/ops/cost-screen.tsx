"use client";

import { useParams } from "next/navigation";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useProject } from "@/lib/api/projects";
import { CostComparison } from "./cost-comparison";
import { ProjectScreenHeader } from "./project-screen-header";

/** Operations → Cost Comparison for one project: vendor vs in-house, special approval, client decision and expense bills. */
export function CostScreen() {
  const { id } = useParams<{ id: string }>();
  const project = useProject(id);
  if (project.isPending) return <RowsSkeleton rows={6} className="p-4" />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
  const p = project.data;
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <ProjectScreenHeader project={p} current="cost" title="Cost Comparison" />
      <CostComparison projectId={p._id} closed={p.status === "CANCELLED" || p.status === "LOSS"} />
    </div>
  );
}
