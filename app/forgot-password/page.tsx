import { Suspense } from "react";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotForm />
    </Suspense>
  );
}
