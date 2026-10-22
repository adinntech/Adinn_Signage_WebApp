import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Official ADINN logos. The artwork is dark and red, so on the navy sidebar it sits on a white rounded card to stay
 * fully readable. Expanded: the full logo (Adinn_Logo.svg). Collapsed (`compact`): the "A" mark (Adinn_A_Only_Logo.png).
 */
export function AdinnLogo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 select-none items-center justify-center rounded-xl bg-white shadow-soft", compact ? "size-11" : "h-14 w-44 px-3", className)}
    >
      {compact ? (
        <Image src="/Images/Adinn_A_Only_Logo.png" alt="ADINN" width={36} height={36} priority className="size-9 object-contain" />
      ) : (
        <Image src="/Images/Adinn_Logo.svg" alt="ADINN Advertising Services Ltd." width={100} height={39} priority className="h-10 w-auto" />
      )}
    </span>
  );
}
