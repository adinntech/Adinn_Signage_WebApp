import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FileRef } from "./files";

export interface EmailTemplate {
  _id: string;
  key: "COMPANY_PROFILE";
  name: string;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  pdf: (FileRef & { uploadedAt?: string }) | null;
  version: number;
  updatedBy?: { name: string; role?: string } | null;
  updatedAt: string;
  fromEmail: string | null;
  mailEnabled: boolean;
}
export interface TemplateChange {
  id: string;
  templateName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedBy: string;
  role: string;
  at: string;
}

const SLUG = "company-profile";
const KEY = ["email-templates", SLUG] as const;

export function useCompanyProfileTemplate() {
  return useQuery({ queryKey: KEY, queryFn: () => api<EmailTemplate>(`/email-templates/${SLUG}`) });
}

export function useTemplateHistory(enabled = true) {
  return useQuery({ queryKey: [...KEY, "history"], queryFn: () => api<TemplateChange[]>(`/email-templates/${SLUG}/history`), enabled });
}

function useTemplateMutation<V>(fn: (v: V) => Promise<EmailTemplate>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (t) => {
      qc.setQueryData(KEY, t);
      qc.invalidateQueries({ queryKey: [...KEY, "history"] });
    },
  });
}

export const useSaveTemplate = () =>
  useTemplateMutation((v: { subject: string; body: string }) => api<EmailTemplate>(`/email-templates/${SLUG}`, { method: "PUT", body: JSON.stringify(v) }));
export const useRestoreTemplate = () =>
  useTemplateMutation(() => api<EmailTemplate>(`/email-templates/${SLUG}/restore-default`, { method: "POST", body: "{}" }));
export const useUploadTemplatePdf = () =>
  useTemplateMutation((body: FormData) => api<EmailTemplate>(`/email-templates/${SLUG}/pdf`, { method: "POST", body }));
export const useRemoveTemplatePdf = () => useTemplateMutation(() => api<EmailTemplate>(`/email-templates/${SLUG}/pdf`, { method: "DELETE" }));
