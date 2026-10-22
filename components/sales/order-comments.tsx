"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import { RoleBadge } from "@/components/ui/role-badge";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formData, openFile, type FileRef } from "@/lib/api/files";
import { ORDER_STAGES, STAGE_META, useAddComment, useComments, useOrderHistory, type HistoryEntry, type OrderStage } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StageBadge } from "./stage";

/** Stage the order was in at a given time, from pipeline history (entries are newest first). */
function stageAt(history: HistoryEntry[], at: string): OrderStage {
  const t = new Date(at).getTime();
  const hit = history.find((h) => h.toStage && new Date(h.at).getTime() <= t);
  return hit?.toStage ?? "NEW_ORDER";
}

export function AttachmentChip({ file }: { file: FileRef }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => openFile(file.fileId).catch((e) => toast(errorMessage(e), "error"))}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:border-brand/50 hover:text-brand"
    >
      <Paperclip className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{file.name}</span>
      {file.size ? <span className="text-muted-foreground">{formatBytes(file.size)}</span> : null}
    </button>
  );
}

/** Comments tab: internal notes with optional attachments, latest first. */
export function OrderComments({ orderId }: { orderId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const list = useComments(orderId);
  const history = useOrderHistory(orderId);
  const [stage, setStage] = useState<OrderStage | "ALL">("ALL");
  const withStage = (list.data ?? []).map((c) => ({ ...c, stage: stageAt(history.data ?? [], c.createdAt) }));
  const shown = stage === "ALL" ? withStage : withStage.filter((c) => c.stage === stage);
  const add = useAddComment(orderId);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const submit = async () => {
    if (!body.trim() && !files.length) return toast("Write a comment or attach a file", "error");
    try {
      await add.mutateAsync(formData(files, { body: body.trim() }));
      setBody("");
      setFiles([]);
      toast("Comment added");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {can("sales:write") && (
        <Card className="h-fit space-y-3 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-primary">Add Internal Comment</h3>
          <label htmlFor="comment-body" className="sr-only">
            Comment
          </label>
          <Textarea id="comment-body" maxLength={4000} placeholder="Visible to the internal team only..." value={body} onChange={(e) => setBody(e.target.value)} />
          <FileUploader id="comment-files" files={files} onChange={setFiles} multiple compact hint="Images or documents, up to 10 files" />
          <div className="flex justify-end">
            <Button variant="brand" onClick={submit} loading={add.isPending}>
              <Send className="size-4" aria-hidden /> Add Comment
            </Button>
          </div>
        </Card>
      )}
      <Card className={can("sales:write") ? "lg:col-span-3" : "lg:col-span-5"}>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3" role="group" aria-label="Filter comments by stage">
          <span className="mr-1 text-sm font-semibold">Comment History</span>
          {(["ALL", ...ORDER_STAGES] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stage === s}
              onClick={() => setStage(s)}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", stage === s ? "border-brand bg-brand-soft text-brand" : "border-border text-muted-foreground hover:bg-muted")}
            >
              {s === "ALL" ? `All (${withStage.length})` : `${STAGE_META[s].short} (${withStage.filter((c) => c.stage === s).length})`}
            </button>
          ))}
        </div>
        {list.isPending ? (
          <RowsSkeleton rows={4} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState icon={MessageSquare} title={withStage.length ? "No comments in this stage" : "No comments yet"} description="Notes and files shared by the team appear here, newest first." />
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {shown.map((c) => (
                <motion.li key={c._id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                    {c.createdBy?.name?.slice(0, 2).toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{c.createdBy?.name}</span>
                      <RoleBadge role={c.role} />
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      <StageBadge stage={c.stage} className="ml-auto" />
                    </div>
                    {c.body && <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>}
                    {c.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.attachments.map((a) => (
                          <AttachmentChip key={a.fileId} file={a} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>
    </div>
  );
}
