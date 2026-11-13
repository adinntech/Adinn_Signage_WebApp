import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type LabWorkflow = "VENDOR_ID" | "RATE_APPROVAL" | "PROJECT_CODE";
export type LabGroup = LabWorkflow | "CROSS";
export type LabStatus = "EXTRACTED" | "REVIEW_REQUIRED" | "INVALID" | "CANCELLED" | "PENDING" | "NOT_FOUND" | "UNMATCHED" | "DUPLICATE" | "APPROVED" | "REJECTED";

export interface LabRequest {
  requestId?: string;
  recipients: string[];
  state?: "PENDING" | "APPROVED" | "NOT_APPROVED";
  requestedAmount?: number;
  existingValues: string[];
  processedMessageIds: string[];
}
export interface LabInput {
  workflow: LabWorkflow;
  subject: string;
  body: string;
  sender?: string;
  messageId?: string;
  request?: LabRequest;
  expectStatus?: string;
  expectValue?: string | null;
}
export interface LabResult {
  workflow: LabWorkflow;
  status: LabStatus;
  value: string | null;
  raw: string | null;
  normalized: string | null;
  confidence: number;
  reason: string;
  candidates: string[];
  flags: string[];
  amounts: number[];
  cleanedText: string;
  match: { requestIdsFound: string[]; requestMatched: boolean | null; senderAuthorized: boolean | null; state: string | null; duplicateMessage: boolean };
}
export interface LabAnalysis { result: LabResult; expected: boolean; pass: boolean | null; failureReason: string }
export interface LabRow {
  id: string;
  group: LabGroup;
  workflow: LabWorkflow;
  title: string;
  rawReply: string;
  expectedValue: string | null;
  expectedStatus: LabStatus;
  actualValue: string | null;
  actualStatus: LabStatus;
  actualNormalized: string | null;
  pass: boolean;
  failureReason: string;
  reason: string;
  confidence: number;
  cleanedText: string;
  flags: string[];
}
export interface LabRun { total: number; passed: number; failed: number; rows: LabRow[] }
export interface LabRules { vendorMinDigits: number; vendorMaxDigits: number; projectMinDigits: number; estDigits: number; estSeparators: string; extraProjectPatterns: string[] }
export interface LabCase { id: string; group: LabGroup; workflow: LabWorkflow; title: string; input: Omit<LabInput, "workflow" | "request"> & { html?: string; request?: Partial<LabRequest> }; expectStatus: LabStatus; expectValue: string | null }

const BASE = "/mail-settings/reply-lab";
export const useLabRules = () => useQuery({ queryKey: ["reply-lab", "rules"], queryFn: () => api<LabRules>(`${BASE}/rules`) });
export const useLabCases = () => useQuery({ queryKey: ["reply-lab", "cases"], queryFn: () => api<LabCase[]>(`${BASE}/cases`), staleTime: 600_000 });
/** Reads one reply text. Nothing is saved anywhere. */
export const useAnalyzeReply = () => useMutation({ mutationFn: (b: LabInput) => api<LabAnalysis>(`${BASE}/analyze`, { method: "POST", body: JSON.stringify(b) }) });
/** Runs the stored suite (all, one group or chosen ids). Nothing is saved anywhere. */
export const useRunReplySuite = () => useMutation({ mutationFn: (b: { group?: LabGroup; ids?: string[] }) => api<LabRun>(`${BASE}/run`, { method: "POST", body: JSON.stringify(b) }) });
