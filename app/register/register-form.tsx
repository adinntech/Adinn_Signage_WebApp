"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Hash, Mail, Phone, User } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { CredentialFields } from "@/components/auth/credential-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiError, fetchRegisterOptions, fieldErrorsOf, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AUTH_ERROR_MESSAGES, CREDENTIAL_DEFAULTS, checkCredential, credentialShape, emailRule, employeeIdRule, nameRule, phoneRule, toCredential } from "@/lib/auth-rules";
import { LOGIN_ROLES, WEB_REGISTER_ROLES } from "@/lib/login-roles";
import { cn } from "@/lib/utils";

const ROLES = WEB_REGISTER_ROLES.map((r) => r.role) as [Role, ...Role[]];

const schema = z
  .object({
    role: z.enum(ROLES, { error: "Select your role" }),
    name: nameRule,
    email: emailRule,
    phone: phoneRule,
    employeeId: employeeIdRule,
    ...credentialShape,
  })
  .superRefine((v, ctx) => checkCredential(v, ctx, true));
type FormValues = z.infer<typeof schema>;

type TextFieldProps = React.ComponentProps<"input"> & { id: string; label: string; icon: typeof User; error?: string | undefined; hint?: string };

function TextField({ id, label, icon: Icon, error, hint, ...rest }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#102449] 2xl:text-base">
        {label}
        <span className="ml-0.5 text-danger" aria-hidden>
          *
        </span>
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground 2xl:size-5" aria-hidden />
        <Input id={id} className="h-11 rounded-xl border-[#d9e3f5] bg-white pl-10 2xl:h-12 2xl:text-base" aria-invalid={!!error} aria-required {...rest} />
      </div>
      {error ? (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="text-xs text-danger 2xl:text-sm">
          {error}
        </motion.p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const { register: signUp } = useAuth();
  const options = useQuery({ queryKey: ["register-options"], queryFn: fetchRegisterOptions, staleTime: 30_000 });
  const adminAvailable = options.data?.adminAvailable ?? false;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "BD", name: "", email: "", phone: "", employeeId: "", ...CREDENTIAL_DEFAULTS },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  // Surface the first problem as a toast too, so it is not missed below the fold.
  function onInvalid(errs: typeof errors) {
    const first = errs.role?.message ?? errs.name?.message ?? errs.employeeId?.message ?? errs.email?.message ?? errs.phone?.message ?? errs.password?.message ?? errs.mpin?.message ?? errs.confirm?.message;
    toast(first ?? "Please check the highlighted fields.", "error");
  }

  async function onSubmit(v: FormValues) {
    try {
      // The account is created and signed in, so go straight to the role's home.
      const me = await signUp({ name: v.name, email: v.email, phone: v.phone, employeeId: v.employeeId, role: v.role, credential: toCredential(v) });
      toast(`Welcome, ${me.name.split(" ")[0]}! Your account is ready.`, "success");
      router.replace(me.home || "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [path, message] of Object.entries(fieldErrorsOf(err))) {
          if (path in v) setError(path as keyof FormValues, { message });
        }
        toast(AUTH_ERROR_MESSAGES[err.code] ?? err.message, "error");
      } else toast("Something went wrong. Please try again.", "error");
    }
  }

  return (
    <AuthShell size="form" title="Create your account" subtitle="Register with your details and choose a password or a 4-digit MPIN. You will be signed in right away.">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="mt-6 space-y-5 2xl:mt-8 2xl:space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-[#102449] 2xl:text-base">
              I work in{" "}
              <span className="text-danger" aria-hidden>
                *
              </span>
            </legend>
            <div className={cn("mt-2 grid grid-cols-2 gap-1.5 rounded-2xl border bg-white p-1.5 shadow-soft sm:grid-cols-4", errors.role ? "border-danger" : "border-[#dfe7f7]")}>
              {WEB_REGISTER_ROLES.map(({ role, key, hint }) => {
                const opt = LOGIN_ROLES.find((r) => r.key === key);
                const Icon = opt?.icon;
                const closed = role === "SUPER_ADMIN" && !adminAvailable;
                return (
                  <motion.label key={role} whileTap={closed ? undefined : { scale: 0.97 }} className={cn("relative", closed ? "cursor-not-allowed opacity-55" : "cursor-pointer")}>
                    <input type="radio" value={role} disabled={closed} className="peer sr-only" {...register("role")} />
                    <span
                      className={cn(
                        "flex h-full flex-col items-center gap-0.5 rounded-xl px-2 py-3 text-center transition-colors duration-300",
                        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                        "hover:bg-[#2563EB]/5 peer-checked:bg-linear-to-br peer-checked:from-[#2563EB] peer-checked:to-[#1d6bff] peer-checked:text-white peer-checked:shadow-soft",
                        "peer-checked:[&_.hint]:text-white/80 peer-checked:[&_.ico]:text-white",
                      )}
                    >
                      {Icon && <Icon className="ico size-5 text-[#2563EB] transition-colors 2xl:size-6" aria-hidden />}
                      <span className="text-sm font-semibold 2xl:text-base">{opt?.label ?? role}</span>
                      <span className="hint text-[11px] leading-tight text-muted-foreground 2xl:text-xs">{closed ? "Invite only" : hint}</span>
                    </span>
                  </motion.label>
                );
              })}
            </div>
            {errors.role && (
              <p role="alert" className="mt-1 text-xs text-danger 2xl:text-sm">
                {errors.role.message}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Recce and vendor teams register in the ADINN Recce mobile app. Admin sign-up is open only until the first admin exists.</p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="name" label="Full name" icon={User} autoComplete="name" placeholder="Enter your full name" error={errors.name?.message} {...register("name")} />
            <TextField id="employeeId" label="Employee ID" icon={Hash} autoCapitalize="characters" placeholder="Enter employee ID" error={errors.employeeId?.message} {...register("employeeId")} />
            <TextField id="email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="Enter your email address" error={errors.email?.message} {...register("email")} />
            <TextField
              id="phone"
              label="Phone"
              icon={Phone}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
              placeholder="Enter your phone number"
              hint="10 digits, numbers only"
              error={errors.phone?.message}
              {...register("phone", {
                // Only digits can be typed or pasted, and never more than 10.
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
                },
              })}
            />
          </div>

          <CredentialFields mode="create" switchLabel="Use 4-digit MPIN" disabled={isSubmitting} />

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button type="submit" size="lg" className="h-12 w-full rounded-2xl bg-linear-to-r from-[#2563EB] to-[#1d6bff] text-base font-semibold hover:brightness-110 2xl:h-14 2xl:text-lg" loading={isSubmitting}>
              {isSubmitting ? (
                "Creating account..."
              ) : (
                <>
                  Create account
                  <ArrowRight className="size-5" aria-hidden />
                </>
              )}
            </Button>
          </motion.div>

          <p className="flex items-center gap-3 text-center text-sm text-muted-foreground 2xl:text-base">
            <span aria-hidden className="h-px flex-1 bg-[#dfe7f7]" />
            <span>
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">
                Sign in
              </Link>
            </span>
            <span aria-hidden className="h-px flex-1 bg-[#dfe7f7]" />
          </p>
        </form>
      </FormProvider>
    </AuthShell>
  );
}
