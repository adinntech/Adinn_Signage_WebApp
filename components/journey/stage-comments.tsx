"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquareText, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAddJourneyComment, useDeleteJourneyComment, type JourneyStage } from "@/lib/api/journey";
import { formatDateTime } from "@/lib/format";

const MAX = 500;

/** Comments for one stage: who said what and when. Admin and Management add them; the author or Super Admin removes one. */
export function StageComments({ projectId, stage }: { projectId: string; stage: JourneyStage }) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const { user } = useAuth();
  const add = useAddJourneyComment(projectId);
  const del = useDeleteJourneyComment(projectId);
  const [text, setText] = useState("");
  const body = text.trim();

  const post = () => {
    if (!body) return;
    add.mutateAsync({ stage: stage.key, body }).then(
      () => setText(""),
      (e) => toast(errorMessage(e), "error"),
    );
  };

  return (
    <section aria-label={`Comments on ${stage.label}`}>
      <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquareText className="size-3" aria-hidden /> Comments {stage.comments.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{stage.comments.length}</span>}
      </h4>
      <div className="rounded-xl border border-border bg-surface focus-within:border-royal/50">
        <textarea
          aria-label={`Add a comment on ${stage.label}`}
          placeholder="Add a comment for this stage..."
          maxLength={MAX}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              post();
            }
          }}
          className="bare-field block w-full resize-none rounded-t-xl bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="pl-1 text-[11px] tabular-nums text-muted-foreground">
            {text.length}/{MAX} · Ctrl+Enter to post
          </span>
          <Button size="sm" variant="brand" loading={add.isPending} disabled={!body} onClick={post}>
            <Send className="size-3.5" aria-hidden /> Post
          </Button>
        </div>
      </div>

      {stage.comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No comments yet. Leave a note for the team about this stage.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          <AnimatePresence initial={false}>
            {stage.comments.map((c) => (
              <motion.li key={c.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, x: 24 }} transition={{ duration: 0.22 }} className="group rounded-lg border border-border bg-white px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap break-words">{c.text}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{c.author}</span>
                  <time dateTime={c.at}>{formatDateTime(c.at)}</time>
                  {(c.authorId === user?.id || user?.role === "SUPER_ADMIN") && (
                    <button type="button" aria-label="Delete comment" title="Delete" disabled={del.isPending} onClick={() => del.mutateAsync(c.id).catch((e) => toast(errorMessage(e), "error"))} className="ml-auto rounded p-1 opacity-0 hover:bg-danger-soft hover:text-danger focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  )}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
