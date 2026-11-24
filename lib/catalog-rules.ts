/**
 * Pure rules of the Media catalog admin screen: what may be typed, how a form is checked, how an edit becomes a request that carries only
 * what changed, how an order change is sent, and how the "used by N boards" refusal is read. No React and no network here, so every rule is
 * unit tested. The backend (`src/modules/catalog/catalog.validators.ts`) stays authoritative; this only gives instant feedback.
 */
import {
  CATALOG_ICONS,
  type CatalogData,
  type CatalogDefaultsResult,
  type CatalogInstallation,
  type CatalogMedia,
  type CatalogQuestion,
  type CatalogUsage,
  type InstallationCreateInput,
  type InstallationPatch,
  type MediaCreateInput,
  type MediaPatch,
  type QuestionCreateInput,
  type QuestionPatch,
  type QuestionScope,
  type QuestionType,
  type ReorderKind,
  type ShowIfValue,
  type Sidedness,
} from "@/types/catalog";

/* ------------------------------------------------ limits (the same numbers as the backend validators) ------------------------------------------------ */

export const MEDIA_CODE_RE = /^[A-Z0-9_]{2,30}$/;
export const INSTALLATION_CODE_RE = /^[a-z0-9_]{2,40}$/;
export const QUESTION_KEY_RE = /^[a-z0-9_]{2,50}$/;
export const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const LIMITS = {
  mediaCode: 30,
  installationCode: 40,
  questionKey: 50,
  mediaShortName: 30,
  mediaName: 80,
  installationName: 60,
  description: 200,
  label: 120,
  option: 60,
  options: 20,
  hint: 120,
  unit: 10,
  showIfText: 60,
  depthMax: 20,
  thicknessMax: 200,
  installationsPerMedia: 20,
  media: 60,
  installations: 40,
  questionsPerGroup: 40,
} as const;

export const SIDEDNESS_LABEL: Record<Sidedness, string> = { SINGLE: "Single side", DOUBLE: "Double side", SELECTABLE: "Selectable (single or double)" };
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = { TEXT: "Text", NUMBER: "Number", YES_NO: "Yes / No", CHOICE: "Choice" };
export const SCOPE_LABEL: Record<QuestionScope, string> = { COMMON: "Common (all boards)", MEDIA: "Media type", INSTALLATION: "Installation type" };

/** "lightbulb_outline" becomes "Lightbulb outline". */
export const iconLabel = (name: string) => {
  const s = name.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : name;
};
export const isCatalogIcon = (name: string) => (CATALOG_ICONS as readonly string[]).includes(name);

/* ------------------------------------------------ typed-text cleaning (what is removed while typing or pasting) ------------------------------------------------ */

/** Control characters (a new line included) and angle brackets are never accepted: these names are shown back on the web and the phone. */
const UNSAFE = /[\u0000-\u001f\u007f<>]/g;
export const cleanText = (v: string, max: number) => v.replace(UNSAFE, "").slice(0, max);
export const cleanMediaCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, LIMITS.mediaCode);
export const cleanInstallationCode = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, LIMITS.installationCode);
export const cleanQuestionKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, LIMITS.questionKey);
/** "#" then up to six hex digits, capitals (a pasted "d71920" becomes "#D71920"). */
export const cleanColor = (v: string) => `#${v.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6)}`;

/** A typed amount as a number, or NaN when it is empty or not a number ("5." and ".5" are accepted: the box lets them be typed). */
export function parseAmount(text: string): number {
  const t = text.trim();
  if (t === "" || t === ".") return NaN;
  return /^\d*\.?\d*$/.test(t) ? Number(t) : NaN;
}

/** White or dark text, whichever reads better on this colour (the chip behind an icon). */
export function readableTextOn(hex: string): "#FFFFFF" | "#0F1B33" {
  if (!COLOR_RE.test(hex)) return "#FFFFFF";
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.4 ? "#0F1B33" : "#FFFFFF";
}

export type FormErrors = Record<string, string>;
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const dupes = (list: string[]) => new Set(list).size !== list.length;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------ media ------------------------------------------------ */

export interface MediaForm {
  code: string;
  shortName: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  illuminated: boolean;
  sidedness: Sidedness;
  /** Typed as text so "0." can be typed; checked and converted on save. */
  depthFt: string;
  thicknessMm: string;
  installations: string[];
  active: boolean;
}

/** A new media type starts with the same defaults the backend would apply. */
export const emptyMediaForm = (): MediaForm => ({
  code: "", shortName: "", name: "", description: "", icon: "category_outlined", color: "#455A64", illuminated: false, sidedness: "SINGLE",
  depthFt: "0", thicknessMm: "0", installations: [], active: true,
});
export const mediaFormFrom = (m: CatalogMedia): MediaForm => ({
  code: m.code, shortName: m.shortName, name: m.name, description: m.description, icon: m.icon, color: m.color, illuminated: m.illuminated, sidedness: m.sidedness,
  depthFt: String(m.depthFt), thicknessMm: String(m.thicknessMm), installations: [...m.installations], active: m.active,
});

export function validateMediaForm(f: MediaForm, opts: { creating: boolean; existingCodes?: string[]; original?: CatalogMedia }): FormErrors {
  const e: FormErrors = {};
  if (opts.creating) {
    if (!f.code) e.code = "Enter a code";
    else if (!MEDIA_CODE_RE.test(f.code)) e.code = "2 to 30 capital letters, digits or _";
    else if (opts.existingCodes?.some((c) => c.toUpperCase() === f.code)) e.code = `A media type with code ${f.code} already exists`;
  }
  const short = f.shortName.trim();
  if (!short) e.shortName = "Enter a short name";
  else if (short.length > LIMITS.mediaShortName) e.shortName = `At most ${LIMITS.mediaShortName} characters`;
  const name = f.name.trim();
  if (!name) e.name = "Enter a name";
  else if (name.length > LIMITS.mediaName) e.name = `At most ${LIMITS.mediaName} characters`;
  if (f.description.trim().length > LIMITS.description) e.description = `At most ${LIMITS.description} characters`;
  if (!isCatalogIcon(f.icon) && f.icon !== opts.original?.icon) e.icon = "Pick an icon from the list";
  if (!COLOR_RE.test(f.color)) e.color = "A colour like #D71920";
  const depth = parseAmount(f.depthFt);
  if (!(depth >= 0 && depth <= LIMITS.depthMax)) e.depthFt = `A number from 0 to ${LIMITS.depthMax} (0 if it does not apply)`;
  const thick = parseAmount(f.thicknessMm);
  if (!(thick >= 0 && thick <= LIMITS.thicknessMax)) e.thicknessMm = `A number from 0 to ${LIMITS.thicknessMax} (0 if it does not apply)`;
  if (f.installations.length > LIMITS.installationsPerMedia) e.installations = `At most ${LIMITS.installationsPerMedia} installation methods`;
  else if (dupes(f.installations)) e.installations = "An installation method is listed twice";
  return e;
}

export function buildMediaCreate(f: MediaForm): MediaCreateInput {
  return {
    code: f.code, shortName: f.shortName.trim(), name: f.name.trim(), description: f.description.trim(), icon: f.icon, color: f.color.toUpperCase(),
    illuminated: f.illuminated, sidedness: f.sidedness, depthFt: parseAmount(f.depthFt), thicknessMm: parseAmount(f.thicknessMm), installations: [...f.installations], active: f.active,
  };
}

/** Only the fields that differ from what is stored. An empty object means "nothing to save". */
export function buildMediaPatch(orig: CatalogMedia, f: MediaForm): MediaPatch {
  const p: MediaPatch = {};
  if (f.shortName.trim() !== orig.shortName) p.shortName = f.shortName.trim();
  if (f.name.trim() !== orig.name) p.name = f.name.trim();
  if (f.description.trim() !== orig.description) p.description = f.description.trim();
  if (f.icon !== orig.icon) p.icon = f.icon;
  if (f.color.toUpperCase() !== orig.color.toUpperCase()) p.color = f.color.toUpperCase();
  if (f.illuminated !== orig.illuminated) p.illuminated = f.illuminated;
  if (f.sidedness !== orig.sidedness) p.sidedness = f.sidedness;
  const depth = parseAmount(f.depthFt);
  if (depth !== orig.depthFt) p.depthFt = depth;
  const thick = parseAmount(f.thicknessMm);
  if (thick !== orig.thicknessMm) p.thicknessMm = thick;
  if (!sameList(f.installations, orig.installations)) p.installations = [...f.installations];
  if (f.active !== orig.active) p.active = f.active;
  return p;
}

export const isEmptyPatch = (p: object) => Object.keys(p).length === 0;

/**
 * The backend's refusal of a form as field errors: a 422 lists `details: [{ path, message }]` (a path like "options.1" belongs to the field "options");
 * a 409 on a create ("... already exists") belongs to the code / key field. Null when nothing maps to a field (the caller shows the message itself).
 */
export function serverFormErrors(err: unknown, conflictField?: string): FormErrors | null {
  const e = err as { status?: unknown; message?: unknown; details?: unknown } | null;
  if (!e || typeof e !== "object") return null;
  const out: FormErrors = {};
  if (Array.isArray(e.details)) {
    for (const d of e.details as { path?: string | (string | number)[]; message?: string }[]) {
      const path = Array.isArray(d?.path) ? d.path : String(d?.path ?? "").split(".");
      const field = String(path[0] ?? "");
      if (field && !out[field]) out[field] = d?.message ?? "Invalid value";
    }
  }
  if (!Object.keys(out).length && e.status === 409 && conflictField && typeof e.message === "string") out[conflictField] = e.message;
  return Object.keys(out).length ? out : null;
}

/** Search by code, short name or name. */
export function filterMedia(list: CatalogMedia[], q: string): CatalogMedia[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  return list.filter((m) => [m.code, m.shortName, m.name].some((x) => x.toLowerCase().includes(t)));
}

export type EntryStatus = "legacy" | "active" | "inactive";
/** Legacy wins: those media are never offered for a new board whatever their switch says. */
export const mediaStatus = (m: Pick<CatalogMedia, "legacy" | "active">): EntryStatus => (m.legacy ? "legacy" : m.active ? "active" : "inactive");

/* ------------------------------------------------ installation types ------------------------------------------------ */

export interface InstallationForm {
  code: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
}
export const emptyInstallationForm = (): InstallationForm => ({ code: "", name: "", description: "", icon: "category_outlined", active: true });
export const installationFormFrom = (i: CatalogInstallation): InstallationForm => ({ code: i.code, name: i.name, description: i.description, icon: i.icon, active: i.active });

export function validateInstallationForm(f: InstallationForm, opts: { creating: boolean; existingCodes?: string[]; original?: CatalogInstallation }): FormErrors {
  const e: FormErrors = {};
  if (opts.creating) {
    if (!f.code) e.code = "Enter a code";
    else if (!INSTALLATION_CODE_RE.test(f.code)) e.code = "2 to 40 lowercase letters, digits or _";
    else if (opts.existingCodes?.some((c) => c.toLowerCase() === f.code)) e.code = `An installation type with code ${f.code} already exists`;
  }
  const name = f.name.trim();
  if (!name) e.name = "Enter a name";
  else if (name.length > LIMITS.installationName) e.name = `At most ${LIMITS.installationName} characters`;
  if (f.description.trim().length > LIMITS.description) e.description = `At most ${LIMITS.description} characters`;
  if (!isCatalogIcon(f.icon) && f.icon !== opts.original?.icon) e.icon = "Pick an icon from the list";
  return e;
}
export const buildInstallationCreate = (f: InstallationForm): InstallationCreateInput => ({ code: f.code, name: f.name.trim(), description: f.description.trim(), icon: f.icon, active: f.active });
export function buildInstallationPatch(orig: CatalogInstallation, f: InstallationForm): InstallationPatch {
  const p: InstallationPatch = {};
  if (f.name.trim() !== orig.name) p.name = f.name.trim();
  if (f.description.trim() !== orig.description) p.description = f.description.trim();
  if (f.icon !== orig.icon) p.icon = f.icon;
  if (f.active !== orig.active) p.active = f.active;
  return p;
}

/* ------------------------------------------------ questions: groups ------------------------------------------------ */

/** The group a question list is shown for: Common, one media type, or one installation type. */
export interface ScopeChoice {
  scope: QuestionScope;
  scopeCode: string;
}
export const COMMON_SCOPE: ScopeChoice = { scope: "COMMON", scopeCode: "" };

/** The order the backend sorts by (and the phone shows): order, then the code. */
export const byOrder = <T extends { order: number }>(a: T, b: T, tie: (t: T) => string) => a.order - b.order || tie(a).localeCompare(tie(b));
export const sortMedia = (list: CatalogMedia[]) => [...list].sort((a, b) => byOrder(a, b, (m) => m.code));
export const sortInstallations = (list: CatalogInstallation[]) => [...list].sort((a, b) => byOrder(a, b, (i) => i.code));

/** The questions of ONE group in display order (all of them, inactive too: a reorder must send every one). */
export const questionsOfGroup = (all: CatalogQuestion[], s: ScopeChoice) =>
  all.filter((q) => q.scope === s.scope && (s.scope === "COMMON" ? true : q.scopeCode === s.scopeCode)).sort((a, b) => byOrder(a, b, (q) => q.id));

/** A scope that points at an entry that no longer exists (deleted meanwhile) falls back to Common; a media / installation scope with no code takes the first entry. */
export function normalizeScope(s: ScopeChoice, media: CatalogMedia[], installations: CatalogInstallation[]): ScopeChoice {
  if (s.scope === "MEDIA") {
    const list = sortMedia(media);
    if (list.some((m) => m.code === s.scopeCode)) return s;
    return list[0] ? { scope: "MEDIA", scopeCode: list[0].code } : COMMON_SCOPE;
  }
  if (s.scope === "INSTALLATION") {
    const list = sortInstallations(installations);
    if (list.some((i) => i.code === s.scopeCode)) return s;
    return list[0] ? { scope: "INSTALLATION", scopeCode: list[0].code } : COMMON_SCOPE;
  }
  return COMMON_SCOPE;
}

/** "Common (all boards)", "Media type: GSB Board", "Installation type: Shop Fascia". */
export function scopeTitle(s: ScopeChoice, media: CatalogMedia[], installations: CatalogInstallation[]): string {
  if (s.scope === "MEDIA") return `Media type: ${media.find((m) => m.code === s.scopeCode)?.name ?? s.scopeCode}`;
  if (s.scope === "INSTALLATION") return `Installation type: ${installations.find((i) => i.code === s.scopeCode)?.name ?? s.scopeCode}`;
  return SCOPE_LABEL.COMMON;
}

/* ------------------------------------------------ questions: show-if rule ------------------------------------------------ */

/** A question another one may depend on: its answer decides whether the dependent question is asked. */
export interface ShowIfCandidate {
  key: string;
  label: string;
  type: QuestionType;
  options: string[];
  /** "this group" or "common". */
  from: "group" | "common";
}

/** The other questions of the same group, then the common ones (the first of a key wins, as on the phone). Never the question itself. */
export function showIfCandidates(all: CatalogQuestion[], s: ScopeChoice, selfKey: string): ShowIfCandidate[] {
  const seen = new Set<string>(selfKey ? [selfKey] : []);
  const out: ShowIfCandidate[] = [];
  const add = (list: CatalogQuestion[], from: ShowIfCandidate["from"]) => {
    for (const q of list) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      out.push({ key: q.id, label: q.label, type: q.type, options: q.options, from });
    }
  };
  add(questionsOfGroup(all, s), "group");
  if (s.scope !== "COMMON") add(questionsOfGroup(all, COMMON_SCOPE), "common");
  return out;
}

/** What the value of a rule is picked from: Yes / No, the options of a choice question, or typed (number / text). */
export type ShowIfValueKind = { kind: "yesno" } | { kind: "choice"; options: string[] } | { kind: "number" } | { kind: "text" };
export function showIfValueKind(c: Pick<ShowIfCandidate, "type" | "options"> | undefined): ShowIfValueKind {
  if (c?.type === "YES_NO") return { kind: "yesno" };
  if (c?.type === "CHOICE") return { kind: "choice", options: c.options };
  if (c?.type === "NUMBER") return { kind: "number" };
  return { kind: "text" };
}

/** A stored rule value as the text the form holds ("true" / "false" for Yes / No). */
export const showIfText = (v: ShowIfValue | null | undefined): string => (v === null || v === undefined ? "" : String(v));
/** Reading a rule value back for the table: Yes / No for booleans. */
export const showIfDisplay = (v: ShowIfValue | null | undefined): string => (v === true ? "Yes" : v === false ? "No" : showIfText(v));

/** The text of the form turned into the value to send, by the type of the question it waits for. Undefined when it is not a valid value. */
export function showIfStored(kind: ShowIfValueKind["kind"], text: string): ShowIfValue | undefined {
  if (kind === "yesno") return text === "true" ? true : text === "false" ? false : undefined;
  if (kind === "number") {
    const n = parseAmount(text);
    return Number.isFinite(n) ? n : undefined;
  }
  const t = text.trim();
  return t ? t : undefined;
}

/* ------------------------------------------------ questions: form ------------------------------------------------ */

export interface QuestionForm {
  scope: QuestionScope;
  scopeCode: string;
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
  unit: string;
  required: boolean;
  hint: string;
  /** The rule is switched on. */
  showIf: boolean;
  showIfId: string;
  showIfValue: string;
  active: boolean;
}

export const emptyQuestionForm = (s: ScopeChoice): QuestionForm => ({
  scope: s.scope, scopeCode: s.scopeCode, id: "", label: "", type: "TEXT", options: [], unit: "", required: true, hint: "", showIf: false, showIfId: "", showIfValue: "", active: true,
});
export const questionFormFrom = (q: CatalogQuestion): QuestionForm => ({
  scope: q.scope, scopeCode: q.scopeCode, id: q.id, label: q.label, type: q.type, options: [...q.options], unit: q.unit ?? "", required: q.required, hint: q.hint ?? "",
  showIf: !!q.showIfId, showIfId: q.showIfId ?? "", showIfValue: showIfText(q.showIfValue), active: q.active,
});

/** Choosing another type on a NEW question: a choice starts with two empty options, everything that belongs to another type is dropped. */
export function withQuestionType(f: QuestionForm, type: QuestionType): QuestionForm {
  return { ...f, type, options: type === "CHOICE" ? (f.options.length ? f.options : ["", ""]) : [], unit: type === "NUMBER" ? f.unit : "" };
}

export interface QuestionFormContext {
  creating: boolean;
  /** Keys already used in the group the question is created in. */
  siblingKeys?: string[];
  candidates: ShowIfCandidate[];
  original?: CatalogQuestion;
}

export function validateQuestionForm(f: QuestionForm, ctx: QuestionFormContext): FormErrors {
  const e: FormErrors = {};
  if (ctx.creating) {
    if (f.scope !== "COMMON" && !f.scopeCode) e.scopeCode = f.scope === "MEDIA" ? "Choose the media type" : "Choose the installation type";
    if (!f.id) e.id = "Enter a key";
    else if (!QUESTION_KEY_RE.test(f.id)) e.id = "2 to 50 lowercase letters, digits or _";
    else if (ctx.siblingKeys?.includes(f.id)) e.id = `A question with key ${f.id} already exists here`;
  }
  const label = f.label.trim();
  if (label.length < 2) e.label = "Enter the question (at least 2 characters)";
  else if (label.length > LIMITS.label) e.label = `At most ${LIMITS.label} characters`;

  if (f.type === "CHOICE") {
    const opts = f.options.map((o) => o.trim());
    const blank = opts.findIndex((o) => o === "");
    if (opts.length < 2) e.options = "A choice question needs at least two options";
    else if (blank >= 0) e.options = `Option ${blank + 1} is empty: fill it or remove it`;
    else if (opts.length > LIMITS.options) e.options = `At most ${LIMITS.options} options`;
    else if (dupes(opts)) e.options = "An option is listed twice";
  }
  const unit = f.unit.trim();
  if (f.type === "NUMBER" && unit.length > LIMITS.unit) e.unit = `At most ${LIMITS.unit} characters`;
  if (f.hint.trim().length > LIMITS.hint) e.hint = `At most ${LIMITS.hint} characters`;

  if (f.showIf) {
    const selfKey = ctx.original?.id ?? f.id;
    if (!f.showIfId) e.showIfId = "Choose the question it depends on";
    else if (f.showIfId === selfKey) e.showIfId = "A question cannot depend on itself";
    else {
      const kind = ruleValueKind(f.showIfId, ctx.candidates, ctx.original);
      const stored = showIfStored(kind.kind, f.showIfValue);
      if (stored === undefined) e.showIfValue = kind.kind === "yesno" ? "Choose Yes or No" : kind.kind === "choice" ? "Choose the answer" : kind.kind === "number" ? "Enter a number" : "Enter the answer";
      else if (typeof stored === "string" && stored.length > LIMITS.showIfText) e.showIfValue = `At most ${LIMITS.showIfText} characters`;
      else if (kind.kind === "choice" && !kind.options.includes(String(stored))) e.showIfValue = "Choose one of that question's options";
    }
  }
  return e;
}

/** What the value of the rule is picked from, by the question it waits for. A question that is not in the list (one of another group) is read from the stored value. */
export function ruleValueKind(showIfId: string, candidates: ShowIfCandidate[], original?: CatalogQuestion): ShowIfValueKind {
  const target = candidates.find((c) => c.key === showIfId);
  if (target) return showIfValueKind(target);
  if (original && original.showIfId === showIfId) return showIfValueKind(typeOfStoredValue(original.showIfValue));
  return showIfValueKind(undefined);
}

/** A rule on a question that is not in the list (for example one of another group): its value type is read from the stored value. */
function typeOfStoredValue(v: ShowIfValue | null): Pick<ShowIfCandidate, "type" | "options"> | undefined {
  if (typeof v === "boolean") return { type: "YES_NO", options: [] };
  if (typeof v === "number") return { type: "NUMBER", options: [] };
  return undefined;
}

/** The rule of the form as {id, value}, or null when it is off or incomplete. `kind` comes from the question it waits for. */
function ruleOf(f: QuestionForm, kind: ShowIfValueKind["kind"]): { id: string; value: ShowIfValue } | null {
  if (!f.showIf || !f.showIfId) return null;
  const value = showIfStored(kind, f.showIfValue);
  return value === undefined ? null : { id: f.showIfId, value };
}

export function buildQuestionCreate(f: QuestionForm, kind: ShowIfValueKind["kind"]): QuestionCreateInput {
  const rule = ruleOf(f, kind);
  const unit = f.type === "NUMBER" ? f.unit.trim() : "";
  const hint = f.hint.trim();
  return {
    scope: f.scope,
    scopeCode: f.scope === "COMMON" ? "" : f.scopeCode,
    id: f.id,
    label: f.label.trim(),
    type: f.type,
    options: f.type === "CHOICE" ? f.options.map((o) => o.trim()) : [],
    required: f.required,
    active: f.active,
    ...(unit ? { unit } : {}),
    ...(hint ? { hint } : {}),
    ...(rule ? { showIfId: rule.id, showIfValue: rule.value } : {}),
  };
}

/**
 * Only the fields that differ. Scope, key and type are never sent (they cannot change). A cleared unit / hint / rule is sent as `null` on purpose;
 * a rule is always sent as the pair (id and value) because the backend refuses one without the other.
 */
export function buildQuestionPatch(orig: CatalogQuestion, f: QuestionForm, kind: ShowIfValueKind["kind"]): QuestionPatch {
  const p: QuestionPatch = {};
  if (f.label.trim() !== orig.label) p.label = f.label.trim();
  if (orig.type === "CHOICE") {
    const opts = f.options.map((o) => o.trim());
    if (!sameList(opts, orig.options)) p.options = opts;
  }
  if (orig.type === "NUMBER") {
    const unit = f.unit.trim() || null;
    if (unit !== orig.unit) p.unit = unit;
  }
  const hint = f.hint.trim() || null;
  if (hint !== orig.hint) p.hint = hint;
  if (f.required !== orig.required) p.required = f.required;
  if (f.active !== orig.active) p.active = f.active;
  const rule = ruleOf(f, kind);
  const nextId = rule?.id ?? null;
  const nextValue = rule?.value ?? null;
  if (nextId !== orig.showIfId || nextValue !== orig.showIfValue) {
    p.showIfId = nextId;
    p.showIfValue = nextValue;
  }
  return p;
}

/* ------------------------------------------------ order ------------------------------------------------ */

/** The list with one entry moved up (-1) or down (+1); null when it cannot move (already first / last). */
export function moveItem<T>(list: readonly T[], index: number, dir: -1 | 1): T[] | null {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return null;
  const next = [...list];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}

/** The body of the reorder call: media / installation codes, or the question uids of ONE group, in the new order. */
export const reorderBody = (kind: ReorderKind, ids: string[]) => ({ kind, ids });

/** The same list with `order` set to the position in `ids` for every entry named there (the screen shows the new order before the server answers). */
export function applyOrder<T extends { order: number }>(items: readonly T[], idOf: (t: T) => string, ids: readonly string[]): T[] {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return items.map((t) => (pos.has(idOf(t)) ? { ...t, order: pos.get(idOf(t))! } : t));
}

/** The whole catalog with a reorder already applied (media / installation codes, or the question uids of one group). */
export function applyCatalogOrder(data: CatalogData, kind: ReorderKind, ids: readonly string[]): CatalogData {
  if (kind === "media") return { ...data, media: applyOrder(data.media, (m) => m.code, ids) };
  if (kind === "installations") return { ...data, installations: applyOrder(data.installations, (i) => i.code, ids) };
  return { ...data, questions: applyOrder(data.questions, (q) => q.uid, ids) };
}

/* ------------------------------------------------ delete, in use, defaults ------------------------------------------------ */

/** The 409 the backend answers when a media type or installation method is still used by recorded boards ("X is used by 3 boards already ..."). */
export function inUseConflict(err: unknown): { count: number; message: string } | null {
  const e = err as { status?: unknown; message?: unknown } | null;
  if (!e || e.status !== 409 || typeof e.message !== "string") return null;
  const m = /is used by (\d+) boards?/i.exec(e.message);
  return m ? { count: Number(m[1]), message: e.message } : null;
}

/** Questions whose "show only if" waits for the answer to this one (they stay hidden for good once it is deleted). */
export const dependentsOf = (q: CatalogQuestion, all: CatalogQuestion[]) =>
  all.filter((o) => o.uid !== q.uid && o.showIfId === q.id && (q.scope === "COMMON" || (o.scope === q.scope && o.scopeCode === q.scopeCode)));

export const mediaDeleteImpact =(code: string, questions: CatalogQuestion[]) => ({ questions: questions.filter((q) => q.scope === "MEDIA" && q.scopeCode === code).length });
export const installationDeleteImpact = (code: string, media: CatalogMedia[], questions: CatalogQuestion[]) => ({
  media: media.filter((m) => m.installations.includes(code)).length,
  questions: questions.filter((q) => q.scope === "INSTALLATION" && q.scopeCode === code).length,
});

/** Boards that use an entry (0 while the usage numbers are not loaded). */
export const usageOf = (usage: CatalogUsage | undefined, kind: "media" | "installations", code: string) => usage?.[kind][code] ?? 0;

/** The toast after "Load built-in defaults". */
export function defaultsMessage(r: CatalogDefaultsResult): string {
  const parts = [
    r.media ? plural(r.media, "media type") : "",
    r.installations ? plural(r.installations, "installation method") : "",
    r.questions ? plural(r.questions, "question") : "",
  ].filter(Boolean);
  return parts.length ? `Added back ${parts.join(", ")}.` : "Nothing to add: every built-in entry is already in the catalog.";
}
