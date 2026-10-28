import Link from "next/link";
import { ArrowLeft, BarChart3, FolderKanban, MapPin, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/api/projects";
import { OPS_STAGE_LABEL, STATUS_META, reqLabel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const SCREENS = [
  { key: "projects", label: "Details", icon: FolderKanban },
  { key: "cost", label: "Cost comparison", icon: BarChart3 },
  { key: "allocation", label: "Shop allocation", icon: MapPin },
  { key: "movement", label: "Movement", icon: Route },
] as const;
export type ProjectScreenKey = (typeof SCREENS)[number]["key"];

/** Title strip shared by the project-level screens, with one-click switching between them. */
export function ProjectScreenHeader({ project, current, title }: { project: Project; current: ProjectScreenKey; title: string }) {
  return (
    <header className="rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/operations/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-royal"><ArrowLeft className="size-4" aria-hidden /> Projects</Link>
        <span className="h-5 w-px bg-border" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-navy">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">{project.code} · {project.client?.name} · {project.campaign} · {reqLabel(project.requirementType)}</p>
        </div>
        <Badge tone={STATUS_META[project.status]?.tone ?? "neutral"}>{OPS_STAGE_LABEL[project.status] ?? STATUS_META[project.status]?.label ?? project.status}</Badge>
      </div>
      <nav aria-label="Project screens" className="flex gap-1 overflow-x-auto border-t border-border px-3">
        {SCREENS.map((s) => (
          <Link key={s.key} href={`/operations/${s.key}/${project._id}`} aria-current={s.key === current ? "page" : undefined} className={cn("flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium", s.key === current ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <s.icon className="size-4" aria-hidden /> {s.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
