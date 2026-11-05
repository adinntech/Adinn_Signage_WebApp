"use client";

import { useState } from "react";
import { Download, Mic, Pause, Play, Save, Square, Trash2 } from "lucide-react";
import { durationLabel, roleLabel } from "@/components/connect/format";
import { AudioPlayer, Waveform } from "@/components/voice/audio-player";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { MAX_RECORD_SECONDS, canRecordVoice, useVoiceCapture } from "@/hooks/use-voice-capture";
import { errorMessage, saveBlob } from "@/lib/api";
import { useDeleteVoiceNote, useUploadVoiceNote, useVoiceNotes, voiceNoteUrl, type VoiceNote } from "@/lib/api/workspace";
import { formatBytes } from "@/lib/format";

/**
 * "Record Voice Note" (reference screen 12): timer, live waveform, pause / resume / stop, then listen back with seek and
 * speed, give it a title and save it to the project with upload progress.
 */
export function VoiceRecorderCard({ pid }: { pid: string }) {
  const toast = useToast();
  const v = useVoiceCapture();
  const upload = useUploadVoiceNote(pid);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const supported = canRecordVoice();

  const save = async () => {
    if (!v.result) return;
    setProgress(0);
    try {
      await upload.mutateAsync({ file: v.result.file, title: title.trim(), durationSec: v.result.durationSec, peaks: v.result.peaks, onProgress: setProgress });
      toast("Voice note saved");
      setTitle("");
      v.discard();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-primary">Record Voice Note</h2>
      {v.phase === "idle" && (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <button type="button" onClick={v.start} disabled={!supported} aria-label="Start recording" className="flex size-16 items-center justify-center rounded-full bg-danger text-white shadow-card transition-transform hover:scale-105 disabled:opacity-50">
            <Mic className="size-7" aria-hidden />
          </button>
          <p className="text-xs text-muted-foreground">{supported ? `Tap to record. Up to ${MAX_RECORD_SECONDS / 60} minutes.` : "This browser cannot record audio. Try a recent Chrome, Edge or Firefox."}</p>
        </div>
      )}
      {(v.phase === "recording" || v.phase === "paused") && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`flex size-14 items-center justify-center rounded-full bg-danger text-white ${v.phase === "recording" ? "ring-4 ring-danger/25" : "opacity-60"}`} aria-hidden>
              <Mic className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-primary" role="timer" aria-live="off">
                {durationLabel(v.seconds)}
              </p>
              <p className="text-xs font-medium text-danger">{v.phase === "paused" ? "Paused" : "Recording..."}</p>
            </div>
          </div>
          <Waveform bars={v.levels.length ? v.levels : [8]} height={44} className="justify-end" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={v.phase === "paused" ? v.resume : v.pause}>
              {v.phase === "paused" ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />} {v.phase === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button variant="destructive" size="sm" onClick={v.stop}>
              <Square className="size-4" aria-hidden /> Stop
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={v.discard} aria-label="Discard recording">
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
      {v.phase === "review" && v.result && (
        <div className="space-y-3">
          <AudioPlayer src={v.result.url} durationSec={v.result.durationSec} peaks={v.result.peaks} />
          <Input aria-label="Voice note title" placeholder="Title (optional), e.g. Site discussion" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} disabled={upload.isPending} />
          {upload.isPending && (
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-royal transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="brand" size="sm" loading={upload.isPending} onClick={save}>
              <Save className="size-4" aria-hidden /> {upload.isPending ? `Uploading ${progress}%` : "Save voice note"}
            </Button>
            <Button variant="ghost" size="sm" onClick={v.discard} disabled={upload.isPending}>
              <Trash2 className="size-4" aria-hidden /> Discard
            </Button>
          </div>
        </div>
      )}
      {v.error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {v.error}
        </p>
      )}
    </Card>
  );
}

/** One saved recording with its player, download and (for its author or a manager) delete. */
export function VoiceNoteRow({ pid, n }: { pid: string; n: VoiceNote }) {
  const toast = useToast();
  const del = useDeleteVoiceNote(pid);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const { url } = await voiceNoteUrl(pid, n.id);
      const res = await fetch(url);
      if (!res.ok) throw new Error("The recording could not be downloaded");
      saveBlob(await res.blob(), `${(n.title || "voice-note").replace(/[^\w.-]+/g, "-")}${n.fileName.slice(n.fileName.lastIndexOf("."))}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{n.title || "Voice note"}</p>
          <p className="text-xs text-muted-foreground">
            {n.author.name} · {roleLabel(n.author.role)} · {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {formatBytes(n.size)}
          </p>
        </div>
        <button type="button" onClick={download} disabled={busy} aria-label="Download voice note" title="Download" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50">
          <Download className="size-4" aria-hidden />
        </button>
        {n.canDelete && (
          <button type="button" onClick={() => setConfirm(true)} aria-label="Delete voice note" title="Delete" className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <AudioPlayer getUrl={() => voiceNoteUrl(pid, n.id).then((r) => r.url)} durationSec={n.durationSec} peaks={n.peaks} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this voice note?"
        description="The recording is erased for everyone. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutateAsync(n.id).then(
            () => setConfirm(false),
            (e) => toast(errorMessage(e), "error"),
          )
        }
      />
    </li>
  );
}

export function VoiceList({ pid, limit, onViewAll }: { pid: string; limit?: number; onViewAll?: () => void }) {
  const q = useVoiceNotes(pid);
  if (q.isPending) return <Skeleton className="h-28" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = limit ? q.data.slice(0, limit) : q.data;
  if (rows.length === 0) return <EmptyState icon={Mic} title="No voice notes yet" description="Record one and it is saved to this project for the whole team." />;
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((n) => (
          <VoiceNoteRow key={n.id} pid={pid} n={n} />
        ))}
      </ul>
      {limit && q.data.length > limit && onViewAll && (
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onViewAll}>
          View all {q.data.length} voice notes
        </Button>
      )}
    </>
  );
}
