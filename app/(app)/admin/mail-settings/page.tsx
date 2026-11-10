import { redirect } from "next/navigation";

/** Mail settings now live inside Mail contacts; keep old links working. */
export default function Page() {
  redirect("/admin/mail-contacts");
}
