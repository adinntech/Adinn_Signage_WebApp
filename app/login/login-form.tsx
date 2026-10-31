"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, IdCard, Info, Mail, Smartphone } from "lucide-react";
import { AuthShell, FormAlert } from "@/components/auth/auth-shell";
import { CredentialFields } from "@/components/auth/credential-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AUTH_ERROR_MESSAGES, CREDENTIAL_DEFAULTS, checkCredential, credentialShape, toCredential } from "@/lib/auth-rules";
import { LOGIN_ROLES, readLoginPref, writeLoginPref, type LoginRoleKey } from "@/lib/login-roles";
import { cn, safeNext } from "@/lib/utils";
import { RoleCards } from "./role-cards";

const ROLE_KEYS = LOGIN_ROLES.map((r) => r.key) as [LoginRoleKey, ...LoginRoleKey[]];

const ID_TYPES = {
  email: { label: "Email", field: "Email Address", placeholder: "Enter your email address", icon: Mail, type: "email" },
  employeeId: { label: "Employee ID", field: "Employee ID", placeholder: "Enter your employee ID", icon: IdCard, type: "text" },
} as const;
type IdType = keyof typeof ID_TYPES;

const schema = z
  .object({
    role: z.enum(ROLE_KEYS, { error: "Select your role" }),
    idType: z.enum(["email", "employeeId"]),
    identifier: z.string().trim(),
    remember: z.boolean(),
    ...credentialShape,
  })
  .superRefine((v, ctx) => {
    // Recce/vendor cards show the "use the mobile app" panel instead of the form.
    if (LOGIN_ROLES.find((r) => r.key === v.role)?.mobileOnly) return;
    const add = (message: string) => ctx.addIssue({ code: "custom", path: ["identifier"], message });
    if (v.idType === "email") {
      if (!v.identifier) add("Enter your email address");
      else if (!z.email().safeParse(v.identifier).success) add("Enter a valid email address");
    } else if (!v.identifier) add("Enter your employee ID");
    else if (!/^[A-Za-z0-9._-]{2,30}$/.test(v.identifier)) add("Enter a valid employee ID");
    checkCredential(v, ctx, false);
  });
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "");
  const expired = params.get("reason") === "expired";
  const { status, user, login } = useAuth();
  const toast = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { idType: "email", identifier: "", remember: false, ...CREDENTIAL_DEFAULTS },
  });
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const role = useWatch({ control, name: "role" });
  const idType = useWatch({ control, name: "idType" }) as IdType;
  const roleOption = LOGIN_ROLES.find((r) => r.key === role);
  const mobileOnly = roleOption?.mobileOnly ?? false;
  const accent = roleOption?.accent ?? "#2563EB";
  const idMeta = ID_TYPES[idType];

  function pickIdType(next: IdType) {
    if (next === idType) return;
    setValue("idType", next);
    setValue("identifier", "");
    clearErrors("identifier");
  }

  // Restore the last role (and ID, if "remember me" was used) after hydration.
  useEffect(() => {
    const pref = readLoginPref();
    if (pref.role) setValue("role", pref.role);
    if (pref.identifier) {
      setValue("idType", pref.identifier.includes("@") ? "email" : "employeeId");
      setValue("identifier", pref.identifier);
      setValue("remember", true);
    }
  }, [setValue]);

  // Already signed in (e.g. opened /login in a second tab): go straight to the role home.
  useEffect(() => {
    if (status === "authenticated" && user) router.replace(next || user.home || "/dashboard");
  }, [status, user, next, router]);

  // Field-level messages stay under each input; also surface the first one as a toast so it is not missed.
  function onInvalid(errs: typeof errors) {
    const first = errs.role?.message ?? errs.identifier?.message ?? errs.password?.message ?? errs.mpin?.message;
    toast(first ?? "Please check the highlighted fields.", "error");
  }

  async function onSubmit(values: FormValues) {
    try {
      const me = await login(values.identifier, toCredential(values), values.remember, values.role);
      writeLoginPref({ role: values.role, identifier: values.remember ? values.identifier : undefined });
      router.replace(next || me.home || "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
          for (const d of err.details as { path?: string; message?: string }[]) {
            if (d.path === "identifier" || d.path === "password" || d.path === "mpin") setError(d.path, { message: d.message ?? "Invalid value" });
          }
        }
        toast(AUTH_ERROR_MESSAGES[err.code] ?? err.message, "error");
      } else {
        toast("Something went wrong. Please try again.", "error");
      }
    }
  }

  return (
    <AuthShell size="xl" eyebrow="Welcome to" title="ADINN Signage Recce CRM" subtitle="Sign in with your email or employee ID, using your password or MPIN.">
      {expired && (
        <FormAlert kind="info">
          <span className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            Your session expired. Please sign in again.
          </span>
        </FormAlert>
      )}
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate style={{ "--accent": accent } as CSSProperties} className="mt-6 grid gap-6 xl:mt-8 xl:grid-cols-[minmax(15rem,0.82fr)_minmax(0,1.18fr)] xl:gap-8 2xl:gap-10">
          <div className="min-w-0">
            <RoleCards registration={register("role")} invalid={!!errors.role} />
            {errors.role && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {errors.role.message}
              </p>
            )}
          </div>

          <div className="min-w-0 rounded-3xl border border-[color-mix(in_srgb,var(--accent)_22%,#dfe7f7)] bg-white/90 p-5 shadow-card transition-colors duration-300 sm:p-6 2xl:p-8">
            {/* Remounts on every role change (key) so it always shows the selected role and fades in */}
            {roleOption && (
              <motion.div key={roleOption.key} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-4 flex items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_9%,white)] px-3.5 py-2.5" data-testid="role-banner">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                  <roleOption.icon className="size-4.5" aria-hidden />
                </span>
                <p className="text-sm text-[#102449] 2xl:text-base">
                  Signing in as <strong>{roleOption.label}</strong>
                  <span className="text-muted-foreground"> · {roleOption.hint}</span>
                </p>
              </motion.div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              {mobileOnly ? (
                <motion.div key="mobile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#2563EB]/25 bg-[#2563EB]/5 p-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-[#2563EB] text-white">
                    <Smartphone className="size-7" aria-hidden />
                  </span>
                  <p className="mt-4 text-base font-semibold text-[#102449] 2xl:text-lg">Recce and vendor teams use the mobile app</p>
                  <p className="mt-1.5 text-sm text-muted-foreground 2xl:text-base">Open the ADINN Recce app on your phone and sign in with your email or employee ID and your password or MPIN. New here? Register in the app.</p>
                </motion.div>
              ) : (
                <motion.div key="web" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
                  <div role="tablist" aria-label="Sign in with" className="grid grid-cols-2 gap-2 rounded-2xl bg-[#eef3fc] p-1.5">
                    {(Object.keys(ID_TYPES) as IdType[]).map((k) => {
                      const { label, icon: Icon } = ID_TYPES[k];
                      const active = idType === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => pickIdType(k)}
                          className={cn(
                            "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors duration-300 2xl:h-12 2xl:text-base",
                            active ? "bg-[var(--accent)] text-white shadow-soft" : "text-[#102449]/80 hover:bg-white",
                          )}
                        >
                          <Icon className="size-4 2xl:size-5" aria-hidden />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="identifier" className="text-sm font-semibold text-[#102449] 2xl:text-base">
                      {idMeta.field}
                    </Label>
                    <div className="relative">
                      <idMeta.icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground 2xl:size-5" aria-hidden />
                      <Input
                        id="identifier"
                        type={idMeta.type}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={idMeta.placeholder}
                        className="h-11 pl-10 2xl:h-12 2xl:text-base"
                        aria-invalid={!!errors.identifier}
                        aria-describedby={errors.identifier ? "identifier-error" : undefined}
                        {...register("identifier")}
                      />
                    </div>
                    {errors.identifier && (
                      <p id="identifier-error" role="alert" className="text-sm text-danger">
                        {errors.identifier.message}
                      </p>
                    )}
                  </div>

                  <CredentialFields mode="login" switchLabel="Use MPIN" disabled={isSubmitting} />

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground 2xl:text-base">
                      <input type="checkbox" className="size-4 rounded border-border accent-[var(--accent)] 2xl:size-5" {...register("remember")} />
                      Remember me
                    </label>
                    {/* Carries the typed ID and whether "Use MPIN" is on, so a password user resets a password and an MPIN user an MPIN. */}
                    <Link href={`/forgot-password?method=${getValues("authMethod") === "MPIN" ? "mpin" : "password"}${getValues("identifier") ? `&id=${encodeURIComponent(getValues("identifier"))}` : ""}`} className="text-sm font-medium text-[var(--accent)] hover:underline 2xl:text-base">
                      Forgot MPIN / password?
                    </Link>
                  </div>

                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button type="submit" size="lg" className="h-12 w-full rounded-2xl bg-linear-to-r from-[var(--accent)] to-[color-mix(in_srgb,var(--accent),white_22%)] text-base font-semibold transition-all duration-300 hover:brightness-110 2xl:h-14 2xl:text-lg" loading={isSubmitting}>
                      {isSubmitting ? "Signing in..." : (
                        <>
                          Login
                          <ArrowRight className="size-5" aria-hidden />
                        </>
                      )}
                    </Button>
                  </motion.div>

                  <p className="border-t border-[#e6edf9] pt-4 text-center text-sm text-muted-foreground 2xl:text-base">
                    New to ADINN?{" "}
                    <Link href="/register" className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
                      Create an account
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </FormProvider>
    </AuthShell>
  );
}
