"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, KeyRound, Mail } from "lucide-react";
import { AuthShell, FormAlert } from "@/components/auth/auth-shell";
import { CredentialFields } from "@/components/auth/credential-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiError, confirmReset, requestResetCode } from "@/lib/api";
import { checkCredential, credentialShape, identifierRule, toCredential } from "@/lib/auth-rules";

const API_MESSAGES: Record<string, string> = {
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  NETWORK_ERROR: "Unable to reach the server. Check your connection and try again.",
};

// The 6-digit code is the one-time verification code from the email. It is not the MPIN (the MPIN stays 4 digits).
const schema = z
  .object({ code: z.string(), ...credentialShape })
  .superRefine((v, ctx) => {
    if (!/^\d{6}$/.test(v.code)) ctx.addIssue({ code: "custom", path: ["code"], message: "Enter the 6-digit code from the email" });
    checkCredential(v, ctx, true);
  });
type FormValues = z.infer<typeof schema>;

/**
 * Forgot MPIN / password, two steps: 1) enter email or employee ID, a 6-digit verification code is emailed;
 * 2) enter the code and a new MPIN or password. The method defaults to what the login screen had selected
 * (?method=mpin|password) and can be switched. Each request is sent once: buttons are guarded while a call runs and
 * resend waits for the cooldown the server reports.
 */
export function ForgotForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [identifier, setIdentifier] = useState(params.get("id") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const inFlight = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", authMethod: params.get("method") === "mpin" ? "MPIN" : "PASSWORD", password: "", mpin: "", confirm: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  const method = useWatch({ control: form.control, name: "authMethod" }) === "MPIN" ? "MPIN" : "password";

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send() {
    if (inFlight.current) return;
    const id = identifierRule.safeParse(identifier);
    if (!id.success) return setError(id.error.issues[0]?.message ?? "Enter your email or employee ID");
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await requestResetCode(id.data);
      setIdentifier(id.data.toLowerCase());
      setWait(r.resendAfterSeconds);
      setStep("confirm");
      toast("If this account exists, a code has been emailed.", "success");
    } catch (err) {
      setError(err instanceof ApiError ? (API_MESSAGES[err.code] ?? err.message) : "Something went wrong. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function submit(v: FormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await confirmReset(identifier, v.code, toCredential(v));
      toast(`${r.authMethod === "MPIN" ? "MPIN" : "Password"} updated. Please sign in.`, "success");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? (API_MESSAGES[err.code] ?? err.message) : "Something went wrong. Please try again.");
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthShell
      size="md"
      title={step === "request" ? "Forgot MPIN or password?" : `Set a new ${method}`}
      subtitle={step === "request" ? "Enter your email or employee ID. We will email you a 6-digit verification code." : `Enter the 6-digit code emailed to the address linked to ${identifier}, then choose your new ${method}.`}
    >
      {error && <FormAlert kind="error">{error}</FormAlert>}

      <FormProvider {...form}>
        <form
          noValidate
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "request") void send();
            else void handleSubmit(submit, () => setError("Please check the highlighted fields."))(e);
          }}
        >
          {step === "request" ? (
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-semibold text-[#102449] 2xl:text-base">
                Email or Employee ID
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Enter your email or employee ID" className="h-11 pl-10 2xl:h-12 2xl:text-base" value={identifier} onChange={(e) => setIdentifier(e.target.value.slice(0, 120))} disabled={busy} />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-sm font-semibold text-[#102449] 2xl:text-base">
                  6-digit verification code (from the email)
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="h-11 pl-10 tracking-[0.4em] 2xl:h-12 2xl:text-base"
                    disabled={busy}
                    autoFocus
                    aria-invalid={!!errors.code}
                    {...register("code", { onChange: (e) => (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6)) })}
                  />
                </div>
                {errors.code && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <CredentialFields mode="create" switchLabel="Use MPIN" disabled={busy} />
            </>
          )}

          <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base font-semibold 2xl:h-14 2xl:text-lg" loading={busy}>
            {step === "request" ? "Send code" : `Reset ${method}`}
            {!busy && <ArrowRight className="size-5" aria-hidden />}
          </Button>

          {step === "confirm" && (
            <div className="flex items-center justify-between text-sm 2xl:text-base">
              <button type="button" className="font-medium text-[#2563EB] hover:underline" onClick={() => { setStep("request"); setError(null); }} disabled={busy}>
                Change email
              </button>
              <button type="button" className="font-medium text-[#2563EB] hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline" onClick={() => void send()} disabled={busy || wait > 0}>
                {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
              </button>
            </div>
          )}
        </form>
      </FormProvider>

      <p className="mt-6 border-t border-[#e6edf9] pt-4 text-center text-sm text-muted-foreground 2xl:text-base">
        <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
