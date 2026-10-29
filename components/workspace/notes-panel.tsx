"use client";

import { useEffect, useRef, useState } from "react";
import { AtSign, Check, Eye, EyeOff, Globe, Lock, Paperclip, Pencil, StickyNote, Trash2, X } from "lucide-react";
import { Attachments } from "@/components/connect/attachments";
import { Avatar, FormattedText, roleLabel, timeOf } from "@/components/connect/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon, kindOfName } from "@/components/upload/file-drop";
import { errorMessage } from "@/lib/api";
import { noteFileUrl, saveDraft, useCreateNote, useDeleteNote, useDraft, useEditNote, useNotes, type Person, type Visibility, type WsNote } from "@/lib/api/workspace";
import { formatBytes } from "@/lib/format";

const MAX_FILES = 5;
const MAX_MB = 25;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv";
const VISIBILITY: Record<Visibility, { label: string; hint: string; icon: typeof Globe }> = {
  PROJECT: { label: "Everyone on the project", hint: "People on the project and Admin / Management can read it", icon: Globe },
  PRIVATE: { label: "Only me", hint: "Nobody else can see this note", icon: Lock },
};

/** The note box. What is typed is saved as a draft after a short pause, so closing the page loses nothing. */
function NoteComposer({ pid, people, meId, initial }: { pid: string; people: Person[]; meId: string; initial: { body: string; visibility: Visibility } }) {
  const toast = useToast();
  const create = useCreateNote(pid);
  const [text, setText] = useState(initial.body);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [files, setFiles] = useState<File[]>([]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">(initial.body ? "saved" : "idle");
  const [menu, setMenu] = useState(false);
  const dirty = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      setSaved("saving");
      saveDraft(pid, { body: text, visibility }).then(
        () => setSaved(text.trim() ? "saved" : "idle"),
        () => setSaved("idle"),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [text, visibility, pid]);

  const change = (v: string, vis = visibility) => {
    dirty.current = true;
    setText(v);
    setVisibility(vis);
  };
  const mention = (p: Person) => {
    const el = box.current;
    const at = el?.selectionStart ?? text.length;
    change(`${text.slice(0, at)}@${p.name} ${text.slice(at)}`);
    setMenu(false);
    requestAnimationFrame(() => el?.focus());
  };
  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (files.length + picked.length > MAX_FILES) return toast(`At most ${MAX_FILES} files per note`, "error");
    const big = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) return toast(`${big.name} is larger than ${MAX_MB} MB`, "error");
    setFiles([...files, ...picked]);
  };
  const post = async () => {
    const body = text.trim();
    if (!body && !files.length) return;
    const mentions = people.filter((p) => p.id !== meId && body.toLowerCase().includes(`@${p.name.toLowerCase()}`)).map((p) => p.id);
    try {
      await create.mutateAsync({ body, visibility, mentions, files });
      dirty.current = false;
      setText("");
      setFiles([]);
      setSaved("idle");
      toast("Note added");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const V = VISIBILITY[visibility];
  return (
    <Card className="p-4">
      <textarea
        ref={box}
        value={text}
        maxLength={4000}
        rows={3}
        aria-label="New note"
        placeholder="Write a note for the team..."
        onChange={(e) => change(e.target.value)}
        className="block w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-royal/50 focus:ring-2 focus:ring-royal/15"
      />
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pl-1 pr-2">
              <FileTypeIcon kind={kindOfName(f.name)} name={f.name} className="size-8" />
              <span className="max-w-40 truncate text-xs font-medium">{f.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="relative">
          <Button size="sm" variant="outline" aria-expanded={menu} onClick={() => setMenu(!menu)} disabled={visibility === "PRIVATE"} title={visibility === "PRIVATE" ? "A private note cannot mention anyone" : "Mention someone"}>
            <AtSign className="size-4" aria-hidden /> Mention
          </Button>
          {menu && (
            <ul role="menu" className="absolute left-0 top-full z-20 mt-1 max-h-56 w-56 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-card">
              {people.filter((p) => p.id !== meId).map((p) => (
                <li key={p.id} role="none">
                  <button role="menuitem" type="button" onClick={() => mention(p)} className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">{roleLabel(p.role)}</span>
                  </button>
                </li>
              ))}
              {people.length <= 1 && <li className="px-3 py-2 text-xs text-muted-foreground">No one else is on this project yet.</li>}
            </ul>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
          <Paperclip className="size-4" aria-hidden /> Attach
        </Button>
        <input ref={input} type="file" hidden multiple accept={ACCEPT} onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
        <div className="w-56" title={V.hint}>
          <Select aria-label="Who can see this note" value={visibility} onChange={(e) => change(text, e.target.value as Visibility)} className="h-8 text-xs">
            {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY[v].label}
              </option>
            ))}
          </Select>
        </div>
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saved === "saving" ? "Saving draft..." : saved === "saved" ? "Draft saved" : ""}
          </span>
          <Button size="sm" variant="brand" loading={create.isPending} disabled={!text.trim() && files.length === 0} onClick={post}>
            Add note
          </Button>
        </span>
      </div>
    </Card>
  );
}

function NoteCard({ pid, n, people, meName }: { pid: string; n: WsNote; people: Person[]; meName: string }) {
  const toast = useToast();
  const edit = useEditNote(pid);
  const del = useDeleteNote(pid);
  const [editing, setEditing] = useState<{ body: string; visibility: Visibility } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const run = (p: Promise<unknown>) => p.catch((e) => toast(errorMessage(e), "error"));
  const V = VISIBILITY[n.visibility];
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={n.author.name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-primary">{n.author.name}</span>
            <span className="text-xs text-muted-foreground">{roleLabel(n.author.role)}</span>
            <time className="text-[11px] text-muted-foreground" dateTime={n.createdAt}>
              {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {timeOf(n.createdAt)}
            </time>
            <Badge tone={n.visibility === "PRIVATE" ? "warning" : "neutral"}>
              {n.visibility === "PRIVATE" ? <EyeOff className="size-3" aria-hidden /> : <Eye className="size-3" aria-hidden />} {n.visibility === "PRIVATE" ? "Only me" : "Project"}
            </Badge>
            {n.edited && <span className="text-[11px] text-muted-foreground">(edited)</span>}
          </p>
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea autoFocus value={editing.body} maxLength={4000} rows={3} aria-label="Edit note" onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="w-full resize-y rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-royal/50" />
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <Select aria-label="Who can see this note" value={editing.visibility} onChange={(e) => setEditing({ ...editing, visibility: e.target.value as Visibility })} className="h-8 text-xs">
                    {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY[v].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button size="sm" variant="brand" loading={edit.isPending} disabled={!editing.body.trim()} onClick={() => run(edit.mutateAsync({ id: n.id, ...editing }).then(() => setEditing(null)))}>
                  <Check className="size-4" aria-hidden /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            n.body && (
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
                <FormattedText text={n.body} mentionNames={people.map((p) => p.name)} meName={meName} />
              </p>
            )
          )}
          <Attachments channelId={`note:${pid}`} items={n.attachments} linkOf={(fileId) => noteFileUrl(pid, n.id, fileId)} />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <V.icon className="size-3" aria-hidden /> {V.hint}
          </p>
        </div>
        {!editing && (n.canEdit || n.canDelete) && (
          <div className="flex shrink-0 gap-0.5">
            {n.canEdit && (
              <button type="button" aria-label="Edit note" title="Edit" onClick={() => setEditing({ body: n.body, visibility: n.visibility })} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
            {n.canDelete && (
              <button type="button" aria-label="Delete note" title="Delete" onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete this note?" description="It is removed for everyone and its files are erased. This cannot be undone." confirmLabel="Delete" destructive loading={del.isPending} onConfirm={() => run(del.mutateAsync(n.id).then(() => setConfirm(false)))} />
    </Card>
  );
}

/** Notes: write, attach files, mention people, choose who can read; edit and delete your own. */
export function NotesPanel({ pid, me }: { pid: string; me: { id: string; name: string } }) {
  const notes = useNotes(pid);
  const draft = useDraft(pid);
  const people = notes.data?.people ?? [];
  return (
    <div className="space-y-4">
      {draft.isFetched ? <NoteComposer pid={pid} people={people} meId={me.id} initial={{ body: draft.data?.body ?? "", visibility: draft.data?.visibility ?? "PROJECT" }} /> : <Skeleton className="h-40" />}
      {notes.isPending ? (
        <Skeleton className="h-32" />
      ) : notes.isError ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : notes.data.notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" description="Notes are for the team: decisions, reminders, things to remember." />
      ) : (
        notes.data.notes.map((n) => <NoteCard key={n.id} pid={pid} n={n} people={people} meName={me.name} />)
      )}
    </div>
  );
}
