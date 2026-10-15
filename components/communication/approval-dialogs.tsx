"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useDecideApproval, useRequestApproval, type Message } from "@/lib/api/communications";
import { useUserLookup } from "@/lib/api/users";
import { ROLE_LABELS } from "@/lib/nav";

export function RequestApprovalDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const toast = useToast();
  const users = useUserLookup([]);
  const request = useRequestApproval();
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked.length) {
      setError("Choose at least one approver");
      return;
    }
    try {
      await request.mutateAsync({ id: message._id, to: picked, comment: comment.trim() || undefined });
      toast("Approval requested");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Request approval"
      description={message.subject ?? "Message"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="approval-form" loading={request.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <form id="approval-form" onSubmit={submit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Approvers</legend>
          {users.isPending ? (
            <RowsSkeleton rows={3} className="p-0" />
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => users.refetch()} className="py-6" />
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border">
              {users.data.map((u) => (
                <li key={u._id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={picked.includes(u._id)}
                      onChange={(e) => setPicked((s) => (e.target.checked ? [...s, u._id] : s.filter((x) => x !== u._id)))}
                    />
                    <span className="flex-1">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {error}
            </p>
          )}
        </fieldset>
        <Field label="Comment" htmlFor="ap-comment">
          <Textarea id="ap-comment" className="min-h-20" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function DecideApprovalDialog({
  message,
  status,
  onClose,
}: {
  message: Message;
  status: "APPROVED" | "REJECTED";
  onClose: () => void;
}) {
  const toast = useToast();
  const decide = useDecideApproval();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={status === "APPROVED" ? "Approve request" : "Reject request"}
      description={message.subject}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={status === "APPROVED" ? "default" : "destructive"}
            loading={decide.isPending}
            onClick={async () => {
              try {
                await decide.mutateAsync({ id: message._id, status, comment: comment.trim() || undefined });
                toast(status === "APPROVED" ? "Approved" : "Rejected");
                onClose();
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            {status === "APPROVED" ? "Approve" : "Reject"}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Field label="Comment (optional)" htmlFor="dec-comment">
        <Textarea id="dec-comment" className="min-h-20" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  );
}
