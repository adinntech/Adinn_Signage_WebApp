import { redirect } from "next/navigation";

/** Old link: Add Client now lives at /clients/new. */
export default function NewClientPage() {
  redirect("/clients/new");
}
