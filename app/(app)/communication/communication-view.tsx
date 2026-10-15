"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCheck, FolderPlus, Inbox, Mail, Paperclip, Search } from "lucide-react";
import { AttachmentInput } from "@/components/communication/attachment-meta";
import { ComposeDialog } from "@/components/communication/compose-dialog";
import { CreateTaskDialog } from "@/components/communication/create-task-dialog";
import { DeliveryBadge, MailActions, MessageCard, senderOf } from "@/components/communication/message-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import type { Attachment } from "@/lib/api/common";
import { useCreateMessage, useMessages, type Message } from "@/lib/api/communications";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "unlinked" | "unactioned";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unlinked", label: "Unlinked" },
  { key: "unactioned", label: "Unactioned" },
];

function AttachDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateMessage();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Attach files"
      description="Records file name, size and type in this thread. Files are not uploaded yet."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            onClick={async () => {
              if (!files.length) return setError("Choose at least one file");
              try {
                await create.mutateAsync({
                  type: "FILE",
                  replyToId: message._id,
                  projectId: message.project?._id,
                  body: `Attached ${files.length} file${files.length === 1 ? "" : "s"} (metadata only)`,
                  attachments: files,
                });
                toast("Attachment recorded");
                onClose();
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            Record attachments
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      <AttachmentInput id="attach-files" value={files} onChange={setFiles} />
    </Modal>
  );
}

function Reader({ message, onBack }: { message: Message; onBack: () => void }) {
  const { can } = useAuth();
  const thread = useMessages({ threadId: message.threadId, limit: 100, sort: "sentAt" });
  const [task, setTask] = useState(false);
  const [attach, setAttach] = useState(false);
  const current = thread.data?.data.find((m) => m._id === message._id) ?? message;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <Button variant="ghost" size="sm" className="-ml-3 lg:hidden" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Back to list
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-primary">{current.subject ?? "(no subject)"}</h2>
            <p className="text-sm text-muted-foreground">
              {senderOf(current)} &middot; {formatDateTime(current.sentAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DeliveryBadge status={current.deliveryStatus} />
            {current.project ? (
              <Link href={`/projects/${current.project._id}`}>
                <Badge tone="primary">{current.project.code}</Badge>
              </Link>
            ) : (
              <Badge tone="warning">Unlinked</Badge>
            )}
          </div>
        </div>
        {current.type === "EMAIL" && (
          <MailActions
            message={current}
            extra={
              <>
                {can("communications:write") && (
                  <Button variant="outline" size="sm" onClick={() => setAttach(true)}>
                    <Paperclip className="size-4" aria-hidden /> Attach
                  </Button>
                )}
                {!current.project && can("projects:write") && (
                  <Button size="sm" onClick={() => setTask(true)}>
                    <FolderPlus className="size-4" aria-hidden /> Create task
                  </Button>
                )}
              </>
            }
          />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {thread.isPending ? (
          <RowsSkeleton rows={3} className="p-0" />
        ) : thread.isError ? (
          <ErrorState error={thread.error} onRetry={() => thread.refetch()} className="py-8" />
        ) : (
          <ol className="space-y-3">
            {thread.data.data.map((m) => (
              <li key={m._id} className={cn(m._id === message._id && "rounded-lg ring-2 ring-accent/40")}>
                <MessageCard message={m} showActions={false} />
              </li>
            ))}
          </ol>
        )}
      </div>
      {task && <CreateTaskDialog message={current} onClose={() => setTask(false)} />}
      {attach && <AttachDialog message={current} onClose={() => setAttach(false)} />}
    </div>
  );
}

export function CommunicationView() {
  const { can } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Message | null>(null);
  const [logging, setLogging] = useState(false);
  const dq = useDebounced(q);
  const list = useMessages({
    type: "EMAIL",
    q: dq,
    page,
    limit: 25,
    unlinked: filter === "unlinked" ? true : undefined,
    actioned: filter === "unactioned" ? false : undefined,
  });
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Communication</h1>
          <p className="text-sm text-muted-foreground">Project mail workspace. Replies and forwards are logged only; the email provider is not configured.</p>
        </div>
        {can("communications:write") && (
          <Button onClick={() => setLogging(true)}>
            <Mail className="size-4" aria-hidden /> Log received email
          </Button>
        )}
      </div>

      <Card className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
        <section
          aria-label="Messages"
          className={cn("min-h-0 flex-col border-border lg:flex lg:border-r", selected ? "hidden" : "flex")}
        >
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search mail"
                placeholder="Search subject, body, sender"
                className="pl-9"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div role="tablist" aria-label="Mail filter" className="flex rounded-lg bg-muted p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  type="button"
                  aria-selected={filter === f.key}
                  onClick={() => {
                    setFilter(f.key);
                    setPage(1);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    filter === f.key ? "bg-surface text-primary shadow-soft" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.isPending ? (
              <RowsSkeleton />
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={dq || filter !== "all" ? "No mail matches" : "No mail yet"}
                description={can("communications:write") ? "Use Log received email to record an incoming message." : undefined}
              />
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((m) => (
                  <li key={m._id}>
                    <button
                      type="button"
                      onClick={() => setSelected(m)}
                      aria-current={selected?._id === m._id}
                      className={cn(
                        "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        selected?._id === m._id && "bg-secondary",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-sm", !m.actioned ? "font-semibold" : "font-medium")}>
                          {senderOf(m)}
                        </span>
                        {m.actioned && <CheckCheck className="size-4 shrink-0 text-success" aria-label="Actioned" />}
                        <time dateTime={m.sentAt} className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(m.sentAt)}
                        </time>
                      </div>
                      <p className="truncate text-sm">{m.subject ?? "(no subject)"}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.body}</p>
                      <div className="mt-1 flex gap-1">
                        {m.project ? <Badge tone="primary">{m.project.code}</Badge> : <Badge tone="warning">Unlinked</Badge>}
                        <Badge tone="neutral">{m.direction === "INBOUND" ? "Inbound" : "Outbound"}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!list.isError && rows.length > 0 && <Pagination meta={list.data?.meta} onPage={setPage} />}
        </section>

        <section aria-label="Message reader" className={cn("min-h-0 min-w-0 lg:block", selected ? "block" : "hidden")}>
          {selected ? (
            <Reader key={selected._id} message={selected} onBack={() => setSelected(null)} />
          ) : (
            <EmptyState icon={Mail} title="Select a message" description="Pick an email from the list to read the thread." className="h-full justify-center" />
          )}
        </section>
      </Card>

      {logging && (
        <ComposeDialog
          mode="log"
          onClose={() => setLogging(false)}
          onDone={(m) => {
            setSelected(m);
            setFilter("all");
          }}
        />
      )}
    </div>
  );
}
