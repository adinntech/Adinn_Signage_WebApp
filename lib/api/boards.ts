import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, saveBlob } from "@/lib/api";
import { qs } from "./common";
import type { Unit } from "./sites";

export type BoardDecision = "PENDING" | "APPROVED" | "REJECTED" | "CHANGED";
export const DECISION_LABEL: Record<BoardDecision, string> = { PENDING: "Waiting for client", APPROVED: "OK", REJECTED: "Cancelled", CHANGED: "Board changed" };

export interface BoardOption {
  _id: string;
  project: string;
  site: string;
  boardType: string;
  width?: number;
  height?: number;
  unit?: Unit;
  quantity: number;
  sqft?: number;
  notes?: string;
  decision: BoardDecision;
  decisionRemark?: string;
  decidedAt?: string;
}
export interface BoardInput {
  siteId?: string;
  boardType?: string;
  width?: number;
  height?: number;
  unit?: Unit;
  quantity?: number;
  notes?: string;
}
export interface BoardSummary {
  totals: Record<BoardDecision, number>;
  perSite: Record<string, Partial<Record<BoardDecision, number>>>;
}

const key = (pid: string) => ["boards", pid] as const;

export function useBoards(pid: string, siteId?: string) {
  return useQuery({ queryKey: [...key(pid), "list", siteId ?? "all"], queryFn: () => api<BoardOption[]>(`/projects/${pid}/boards${qs({ siteId })}`), enabled: !!pid });
}
export function useBoardSummary(pid: string) {
  return useQuery({ queryKey: [...key(pid), "summary"], queryFn: () => api<BoardSummary>(`/projects/${pid}/boards/summary`), enabled: !!pid });
}
function useBoardMutation<V>(pid: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: key(pid) }) });
}
export const useSaveBoard = (pid: string) =>
  useBoardMutation(pid, ({ id, body }: { id?: string; body: BoardInput }) =>
    id ? api(`/boards/${id}`, { method: "PATCH", body: JSON.stringify(body) }) : api(`/projects/${pid}/boards`, { method: "POST", body: JSON.stringify(body) }),
  );
export const useDecideBoard = (pid: string) =>
  useBoardMutation(pid, ({ id, decision, remark }: { id: string; decision: BoardDecision; remark?: string }) =>
    api(`/boards/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, remark }) }),
  );
export const useDeleteBoard = (pid: string) => useBoardMutation(pid, (id: string) => api(`/boards/${id}`, { method: "DELETE" }));

export async function downloadBoards(pid: string, decision?: BoardDecision) {
  const { blob, fileName } = await apiBlob(`/projects/${pid}/boards/export${qs({ decision })}`);
  saveBlob(blob, fileName ?? "board-options.xlsx");
}
