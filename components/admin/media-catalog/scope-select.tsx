"use client";

import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { COMMON_SCOPE, SCOPE_LABEL, sortInstallations, sortMedia, type ScopeChoice } from "@/lib/catalog-rules";
import { QUESTION_SCOPES, type CatalogInstallation, type CatalogMedia, type QuestionScope } from "@/types/catalog";

/**
 * Which group of questions: Common (all boards), one media type, or one installation type. Choosing a kind with entries selects the first entry,
 * so there is always a valid group. Used above the list and when a new question is made.
 */
export function ScopeSelect({
  value,
  media,
  installations,
  onChange,
  idPrefix,
  required,
}: {
  value: ScopeChoice;
  media: CatalogMedia[];
  installations: CatalogInstallation[];
  onChange: (s: ScopeChoice) => void;
  idPrefix: string;
  required?: boolean;
}) {
  const mediaList = sortMedia(media);
  const installList = sortInstallations(installations);
  const empty = (s: QuestionScope) => (s === "MEDIA" ? mediaList.length === 0 : s === "INSTALLATION" ? installList.length === 0 : false);

  function pickKind(scope: QuestionScope) {
    if (scope === "MEDIA") onChange(mediaList[0] ? { scope, scopeCode: mediaList[0].code } : COMMON_SCOPE);
    else if (scope === "INSTALLATION") onChange(installList[0] ? { scope, scopeCode: installList[0].code } : COMMON_SCOPE);
    else onChange(COMMON_SCOPE);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Questions for" htmlFor={`${idPrefix}-scope`} {...(required ? { required: true } : {})}>
        <Select id={`${idPrefix}-scope`} value={value.scope} onChange={(e) => pickKind(e.target.value as QuestionScope)}>
          {QUESTION_SCOPES.map((s) => (
            <option key={s} value={s} disabled={empty(s)}>{SCOPE_LABEL[s]}{empty(s) ? " (none yet)" : ""}</option>
          ))}
        </Select>
      </Field>
      {value.scope === "MEDIA" && (
        <Field label="Media type" htmlFor={`${idPrefix}-code`} {...(required ? { required: true } : {})}>
          <Select id={`${idPrefix}-code`} value={value.scopeCode} onChange={(e) => onChange({ scope: "MEDIA", scopeCode: e.target.value })}>
            {mediaList.map((m) => <option key={m.code} value={m.code}>{m.name}{m.legacy ? " (legacy)" : m.active ? "" : " (inactive)"}</option>)}
          </Select>
        </Field>
      )}
      {value.scope === "INSTALLATION" && (
        <Field label="Installation type" htmlFor={`${idPrefix}-code`} {...(required ? { required: true } : {})}>
          <Select id={`${idPrefix}-code`} value={value.scopeCode} onChange={(e) => onChange({ scope: "INSTALLATION", scopeCode: e.target.value })}>
            {installList.map((i) => <option key={i.code} value={i.code}>{i.name}{i.active ? "" : " (inactive)"}</option>)}
          </Select>
        </Field>
      )}
    </div>
  );
}
