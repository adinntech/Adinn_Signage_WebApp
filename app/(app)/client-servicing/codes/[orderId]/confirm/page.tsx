import { CodeConfirmOrder } from "@/components/client-servicing/code-confirm-order";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default function CodeConfirmOrderPage() {
  return <CodeConfirmOrder />;
}
