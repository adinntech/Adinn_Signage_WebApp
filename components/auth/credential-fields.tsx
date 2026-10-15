"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_CHECKS, passwordStrength, type CredentialValues } from "@/lib/auth-rules";
import { cn } from "@/lib/utils";
import { MpinInput } from "./mpin-input";

type PasswordInputProps = React.ComponentProps<"input"> & { id: string; label: string; hideLabel?: boolean; error?: string | undefined };

function PasswordInput({ id, label, hideLabel, error, ...rest }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id={id} type={show ? "text" : "password"} className="h-10 rounded-lg border-[#d9e3f5] bg-[#f8fbff] pl-9 pr-10 text-sm shadow-none focus-visible:bg-white 2xl:h-11 2xl:text-base" aria-invalid={!!error} {...rest} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function StrengthMeter({ value }: { value: string }) {
  const st = passwordStrength(value);
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-3">
        <div role="progressbar" aria-label="Password strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={st.pct} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e1e7f0]">
          <motion.div className="h-full origin-left rounded-full" initial={false} animate={{ width: `${st.pct}%`, backgroundColor: st.color }} transition={{ duration: 0.3, ease: "easeOut" }} />
        </div>
        <span className="w-12 text-right text-xs font-semibold" style={{ color: st.color }}>
          {st.label}
        </span>
      </div>
    </div>
  );
}

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };

/**
 * Password-or-MPIN block shared by the sign in and register forms. The on/off switch picks the method:
 * off = password, on = 4-digit MPIN. Must live inside a react-hook-form <FormProvider> whose values include
 * authMethod/password/mpin/confirm. mode "login": single field. mode "create": strength hints plus a confirmation field.
 */
export function CredentialFields({ mode, switchLabel, disabled }: { mode: "login" | "create"; switchLabel: string; disabled?: boolean }) {
  const { register, control, watch, setValue, clearErrors, formState } = useFormContext<CredentialValues>();
  const useMpin = watch("authMethod") === "MPIN";
  const password = watch("password");
  const errors = formState.errors;
  const create = mode === "create";

  function toggle(on: boolean) {
    setValue("authMethod", on ? "MPIN" : "PASSWORD");
    setValue("password", "");
    setValue("mpin", "");
    setValue("confirm", "");
    clearErrors(["password", "mpin", "confirm"]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-soft">
        <div className="flex items-center gap-2.5">
          <span className={cn("flex size-8 items-center justify-center rounded-lg transition", useMpin ? "bg-[var(--accent,#2563EB)] text-white" : "bg-secondary text-primary")}>
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <p id="mpin-switch-label" className="text-sm font-semibold text-foreground 2xl:text-base">
              {switchLabel}
            </p>
            <p className="text-xs text-muted-foreground 2xl:text-sm">{useMpin ? "On: quick 4-digit MPIN" : "Off: use a password"}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={useMpin}
          aria-labelledby="mpin-switch-label"
          disabled={disabled}
          onClick={() => toggle(!useMpin)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
            useMpin ? "bg-[var(--accent,#2563EB)]" : "bg-border",
          )}
        >
          <motion.span aria-hidden className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow" animate={{ x: useMpin ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
        </button>
      </div>

      {!create && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-[#102449] 2xl:text-base">Password / MPIN</span>
          <button type="button" disabled={disabled} onClick={() => toggle(!useMpin)} className="text-sm font-medium text-[var(--accent,#2563EB)] hover:underline disabled:opacity-60 2xl:text-base">
            {useMpin ? "Use password instead?" : "Use MPIN instead?"}
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {useMpin ? (
          <motion.div key="mpin" {...fade} className={create ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
            <div className="space-y-1.5">
              {create ? <Label>Set 4-digit MPIN</Label> : <span className="sr-only">MPIN</span>}
              <Controller control={control} name="mpin" render={({ field }) => <MpinInput label="MPIN" value={field.value} onChange={field.onChange} invalid={!!errors.mpin} disabled={disabled} />} />
              {errors.mpin && (
                <p role="alert" className="text-xs text-danger">
                  {errors.mpin.message}
                </p>
              )}
            </div>
            {create && (
              <div className="space-y-1.5">
                <Label>Confirm 4-digit MPIN</Label>
                <Controller control={control} name="confirm" render={({ field }) => <MpinInput label="Confirm MPIN" value={field.value} onChange={field.onChange} invalid={!!errors.confirm} disabled={disabled} />} />
                {errors.confirm && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.confirm.message}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="password" {...fade} className="space-y-4">
            {create ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordInput id="password" label="Create password" placeholder="Create a strong password" autoComplete="new-password" error={errors.password?.message} disabled={disabled} {...register("password")} />
                  <PasswordInput id="confirm" label="Confirm password" placeholder="Confirm your password" autoComplete="new-password" error={errors.confirm?.message} disabled={disabled} {...register("confirm")} />
                </div>
                <StrengthMeter value={password ?? ""} />
                <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs 2xl:text-sm" aria-label="Password requirements">
                  {PASSWORD_CHECKS.map((c) => {
                    const ok = c.test(password ?? "");
                    return (
                      <li key={c.key} className={cn("flex items-center gap-1.5 transition-colors", ok ? "text-success" : "text-muted-foreground")}>
                        <Check className={cn("size-3.5 transition-opacity", ok ? "opacity-100" : "opacity-30")} aria-hidden />
                        {c.label}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <PasswordInput id="password" hideLabel label="Password" placeholder="Enter your password" autoComplete="current-password" error={errors.password?.message} disabled={disabled} {...register("password")} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
