"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    key: "company",
    icon: UserPlus,
    title: "New Client",
    text: "Register a new company and its contact persons. A New Order card is created automatically.",
  },
  {
    key: "existing",
    icon: Users,
    title: "Existing Client",
    text: "Select a company already registered in the CRM and create another order for it.",
  },
] as const;
type Choice = (typeof OPTIONS)[number]["key"];

/** Screen 02: choose New Client or Existing Client. */
export function ClientTypeSelect() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const go = () => choice && router.push(`/clients/new/${choice}`);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader icon={Building2} title="Add Client" subtitle="Choose the client type to proceed." />
      <Card className="overflow-hidden">
        <div
          role="radiogroup"
          aria-label="Client type"
          className="grid gap-4 p-5 sm:p-6 md:grid-cols-2"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              setChoice((c) => (c === "company" ? "existing" : "company"));
            }
          }}
        >
          {OPTIONS.map((o) => {
            const active = choice === o.key;
            return (
              <motion.button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active || (!choice && o.key === "company") ? 0 : -1}
                onClick={() => setChoice(o.key)}
                onDoubleClick={() => router.push(`/clients/new/${o.key}`)}
                whileHover={{ y: -2 }}
                className={cn(
                  "group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active ? "border-brand bg-brand-soft/60 shadow-card" : "border-border bg-surface hover:border-brand/40 hover:bg-brand-soft/20",
                )}
              >
                <span
                  aria-hidden
                  className={cn("absolute right-4 top-4 flex size-5 items-center justify-center rounded-full border-2 transition-colors", active ? "border-brand" : "border-border group-hover:border-brand/50")}
                >
                  {active && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                <span className={cn("flex size-14 items-center justify-center rounded-full ring-4 transition-colors", active ? "bg-brand text-white ring-brand/15" : "bg-brand-soft text-brand ring-brand-soft/60")}>
                  <o.icon className="size-7" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-semibold text-primary">{o.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{o.text}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button variant="ghost" asChild>
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden /> Back to Client List
            </Link>
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/clients">Cancel</Link>
            </Button>
            <Button variant="brand" onClick={go} disabled={!choice} title={choice ? undefined : "Select a client type to continue"}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
