/**
 * Media catalog (web admin). The shapes mirror the backend module `src/modules/catalog` exactly: the media types a board can be made of,
 * the installation methods, and the site questions asked per board. The backend stays authoritative for every rule.
 */

/** Icon names the admin screens offer. The phone and the web each map a name to their own icon; an unknown name shows a plain default. */
export const CATALOG_ICONS = [
  "lightbulb_outline", "crop_landscape", "crop_square", "rectangle_outlined", "layers_outlined", "text_fields", "text_rotation_none", "flip", "flag_outlined",
  "blur_on", "change_history", "window_outlined", "door_sliding_outlined", "storefront_outlined", "wallpaper", "wallpaper_outlined", "format_paint_outlined",
  "signpost_outlined", "roofing_outlined", "open_in_full", "view_week_outlined", "view_quilt_outlined", "view_column_outlined", "view_agenda", "view_agenda_outlined",
  "handyman_outlined", "construction", "straighten", "inventory_2_outlined", "category_outlined", "light_mode_outlined", "architecture",
] as const;
export type CatalogIcon = (typeof CATALOG_ICONS)[number];

export const SIDEDNESS = ["SINGLE", "DOUBLE", "SELECTABLE"] as const;
export type Sidedness = (typeof SIDEDNESS)[number];

export const QUESTION_TYPES = ["TEXT", "NUMBER", "YES_NO", "CHOICE"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** COMMON: asked for every board. MEDIA: only for one media type. INSTALLATION: only for one installation method. */
export const QUESTION_SCOPES = ["COMMON", "MEDIA", "INSTALLATION"] as const;
export type QuestionScope = (typeof QUESTION_SCOPES)[number];

/** The answer a `showIf` rule waits for: Yes / No, one of the options, a number or a short text. */
export type ShowIfValue = string | number | boolean;

export interface CatalogMedia {
  code: string;
  shortName: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  illuminated: boolean;
  sidedness: Sidedness;
  depthFt: number;
  thicknessMm: number;
  /** Id of the phone's 3D model; not edited here. */
  template: string;
  /** Installation codes offered for this media, in the order they are offered. */
  installations: string[];
  /** Older media kept so old records stay readable: never offered for a new board, and the flag cannot be changed. */
  legacy: boolean;
  active: boolean;
  order: number;
}

export interface CatalogInstallation {
  code: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
  order: number;
}

export interface CatalogQuestion {
  /** The question's database id (used in the URLs and by the reorder call). */
  uid: string;
  scope: QuestionScope;
  /** The media or installation code; empty for COMMON. */
  scopeCode: string;
  /** The key the answer is stored under on a board. */
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
  unit: string | null;
  required: boolean;
  hint: string | null;
  showIfId: string | null;
  showIfValue: ShowIfValue | null;
  active: boolean;
  order: number;
}

/** `GET /catalog` without a version: everything in one answer. */
export interface CatalogData {
  version: number;
  unchanged: false;
  media: CatalogMedia[];
  installations: CatalogInstallation[];
  questions: CatalogQuestion[];
}

/** `GET /catalog/usage`: boards of recorded recces that use each entry. */
export interface CatalogUsage {
  media: Record<string, number>;
  installations: Record<string, number>;
}

/** `POST /catalog/defaults`: how many built-in entries were added back. */
export interface CatalogDefaultsResult {
  media: number;
  installations: number;
  questions: number;
}

/* ------------------------------------------------ request bodies ------------------------------------------------ */

export interface MediaCreateInput {
  code: string;
  shortName: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  illuminated: boolean;
  sidedness: Sidedness;
  depthFt: number;
  thicknessMm: number;
  installations: string[];
  active: boolean;
}
/** An edit sends ONLY the fields that changed (the backend fills nothing in). */
export type MediaPatch = Partial<Omit<MediaCreateInput, "code">>;

export interface InstallationCreateInput {
  code: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
}
export type InstallationPatch = Partial<Omit<InstallationCreateInput, "code">>;

export interface QuestionCreateInput {
  scope: QuestionScope;
  scopeCode: string;
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
  unit?: string;
  required: boolean;
  hint?: string;
  showIfId?: string;
  showIfValue?: ShowIfValue;
  active: boolean;
}
/** Scope, key and type are fixed after creation. `null` clears an optional value on purpose. */
export interface QuestionPatch {
  label?: string;
  options?: string[];
  unit?: string | null;
  required?: boolean;
  hint?: string | null;
  showIfId?: string | null;
  showIfValue?: ShowIfValue | null;
  active?: boolean;
}

export type ReorderKind = "media" | "installations" | "questions";
export interface ReorderResult {
  version: number;
  ordered: number;
}
export interface MediaDeleteResult {
  deleted: string;
  questionsDeleted: number;
}
export interface InstallationDeleteResult {
  deleted: string;
  removedFromMedia: number;
  questionsDeleted: number;
}
