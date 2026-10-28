"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Route } from "lucide-react";
import { AllocationItinerary } from "@/components/allocation/allocation-itinerary";
import { LocateShops } from "@/components/allocation/locate-shops";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useAllocationOverview } from "@/lib/api/allocation";
import { useProject } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { ProjectScreenHeader } from "./project-screen-header";

/** Operations → Movement: the in-house team's day-wise road routes for one project. */
export function MovementScreen() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const project = useProject(id);
  const ov = useAllocationOverview(id);
  if (project.isPending || ov.isPending) return <RowsSkeleton rows={6} className="p-4" />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
  if (ov.isError) return <ErrorState error={ov.error} onRetry={() => ov.refetch()} />;
  const p = project.data;
  const o = ov.data;
  const inHouse = o.teams.find((t) => !t.vendorId)?.shops ?? 0;
  const canEdit = can("sites:write") && can("verification:manage") && p.status !== "CANCELLED" && p.status !== "LOSS";

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <ProjectScreenHeader project={p} current="movement" title="Movement" />
      {!o.origin ? (
        <EmptyState icon={MapPin} title="Set the start point first" description="Day routes start and end at your office or hub. Set it on the Shop Allocation map." action={<Button asChild><Link href={`/operations/allocation/${id}`}>Open Shop Allocation</Link></Button>} />
      ) : inHouse === 0 ? (
        <EmptyState icon={Route} title="No shops are allocated to the in-house team" description="Give shops to the in-house team in Shop Allocation, then plan their routes here." action={<Button asChild><Link href={`/operations/allocation/${id}`}>Allocate shops</Link></Button>} />
      ) : (
        <>
          {canEdit && o.withoutCoords > 0 && <div className="max-w-sm"><LocateShops projectId={id} missing={o.withoutCoords} /></div>}
          <AllocationItinerary projectId={id} />
        </>
      )}
    </div>
  );
}
