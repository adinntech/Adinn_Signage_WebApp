import { z } from "zod";
import type { Credential } from "@/lib/api";

/** Mirrors the backend rules (common/validators/credentials.ts). The backend stays authoritative. */
const WEAK_MPINS = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "0123", "3210"]);

export const PASSWORD_CHECKS = [
  { key: "len", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { key: "letter", label: "A letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { key: "digit", label: "A number", test: (v: string) => /\d/.test(v) },
] as const;

export const passwordError = (v: string) => {
  const failed = PASSWORD_CHECKS.find((c) => !c.test(v));
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : null;
};
export type Strength = { level: 0 | 1 | 2 | 3; label: string; color: string; pct: number };

/**
 * Weak (red): the minimum rules are not met yet. Fair (yellow): the rules are met.
 * Strong (green): rules met plus at least two extras (upper + lower case, a symbol, 12+ characters).
 */
export function passwordStrength(v: string): Strength {
  if (!v) return { level: 0, label: "", color: "#e1e7f0", pct: 0 };
  const met = v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
  if (!met) return { level: 1, label: "Weak", color: "#DC2626", pct: 33 };
  const extras = Number(/[a-z]/.test(v) && /[A-Z]/.test(v)) + Number(/[^A-Za-z0-9]/.test(v)) + Number(v.length >= 12);
  return extras >= 2 ? { level: 3, label: "Strong", color: "#059669", pct: 100 } : { level: 2, label: "Fair", color: "#F59E0B", pct: 66 };
}

export const mpinError = (v: string) => (!/^\d{4}$/.test(v) ? "MPIN must be exactly 4 digits" : WEAK_MPINS.has(v) ? "Choose a less obvious MPIN" : null);

export const identifierRule = z
  .string()
  .trim()
  .min(1, "Enter your email or employee ID")
  .refine((v) => (v.includes("@") ? z.email().safeParse(v).success : /^[A-Za-z0-9._-]{2,30}$/.test(v)), { error: "Enter a valid email or employee ID" });

export const nameRule = z.string().trim().min(2, "Enter your full name");
export const emailRule = z.email("Enter a valid email address");
export const phoneRule = z
  .string()
  .trim()
  .min(1, "Enter your phone number")
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");
export const employeeIdRule = z.string().trim().regex(/^[A-Za-z0-9._-]{2,30}$/, "Enter a valid employee ID");

export const credentialShape = {
  authMethod: z.enum(["PASSWORD", "MPIN"]),
  password: z.string(),
  mpin: z.string(),
  confirm: z.string(),
};
export type CredentialValues = z.infer<z.ZodObject<typeof credentialShape>>;

/** create=true enforces strength and confirmation (register); false only requires a value (sign in). */
export function checkCredential(v: CredentialValues, ctx: z.RefinementCtx, create: boolean) {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.authMethod === "MPIN") {
    const err = create ? mpinError(v.mpin) : /^\d{4}$/.test(v.mpin) ? null : "Enter your 4-digit MPIN";
    if (err) add("mpin", err);
    else if (create && v.confirm !== v.mpin) add("confirm", "MPINs do not match");
  } else if (!v.password) {
    add("password", "Enter your password");
  } else if (create) {
    const err = passwordError(v.password);
    if (err) add("password", err);
    else if (v.confirm !== v.password) add("confirm", "Passwords do not match");
  }
}

export const toCredential = (v: CredentialValues): Credential =>
  v.authMethod === "MPIN" ? { authMethod: "MPIN", mpin: v.mpin } : { authMethod: "PASSWORD", password: v.password };

export const CREDENTIAL_DEFAULTS: CredentialValues = { authMethod: "PASSWORD", password: "", mpin: "", confirm: "" };

/** Map backend error codes to friendly sentences. */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect details. If you registered with an MPIN, switch on “Use MPIN”.",
  USER_NOT_FOUND: "User not found",
  ACCOUNT_DISABLED: "This account is inactive. Contact your administrator.",
  ACCOUNT_LOCKED: "Too many wrong attempts. Try again in 15 minutes or ask your administrator to reset your credential.",
  PLATFORM_NOT_ALLOWED: "Recce and vendor accounts sign in on the ADINN Recce mobile app, not the web CRM.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  NETWORK_ERROR: "Unable to reach the server. Check your connection and try again.",
  CONFLICT: "An account with these details already exists.",
};
