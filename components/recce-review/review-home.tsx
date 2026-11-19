"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { MonitorView, ProgressView } from "@/components/recce-review/progress";
import { ReviewInbox } from "@/components/recce-review/inbox";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

export function ReviewHome() {
  const { user } = useAuth();
  const monitor = user?.role === "SUPER_ADMIN" || user?.role === "MANAGEMENT";
  const [tab, setTab] = useState("inbox");
  const tabs = [{ key: "inbox", label: "Review Inbox" }, { key: "progress", label: "Progress" }, ...(monitor ? [{ key: "monitor", label: "Monitoring" }] : [])];
  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-4">
      <PageHeader icon={ClipboardCheck} title="Recce Review" subtitle="Shop photo evidence from vendors and the in-house team: verify, approve, send back for rework." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Recce review sections" />
      {tab === "inbox" && <ReviewInbox />}
      {tab === "progress" && <ProgressView />}
      {tab === "monitor" && monitor && <MonitorView />}
    </div>
  );
}
