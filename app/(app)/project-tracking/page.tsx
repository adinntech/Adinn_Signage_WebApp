import { redirect } from "next/navigation";

// Project Tracking was renamed to Recce Tracking: old links and bookmarks go to the new address.
export default function Page() {
  redirect("/recce-tracking");
}
