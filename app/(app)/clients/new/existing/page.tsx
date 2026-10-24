import { redirect } from "next/navigation";

/** Old link: orders for a registered client are now created in Order Management. */
export default function ExistingClientPage() {
  redirect("/orders");
}
