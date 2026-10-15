import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectDetail } from "./project-detail";

export default function ProjectPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 max-w-7xl" />}>
      <ProjectDetail />
    </Suspense>
  );
}
