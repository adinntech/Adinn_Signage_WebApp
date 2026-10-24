import { redirect } from "next/navigation";

/** Client Servicing lands on its own orders ("My Orders") until it has a dashboard of its own. */
export default function ClientServicingHome() {
  redirect("/orders");
}
