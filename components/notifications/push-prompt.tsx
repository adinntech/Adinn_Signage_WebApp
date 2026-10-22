"use client";

import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePush } from "@/hooks/use-push";
import { errorMessage } from "@/lib/api";

const KEY = "adinn.push.prompt.dismissed";

/** One-time banner asking the person to allow Chrome notifications, so a new assignment is never missed. */
export function PushPrompt() {
  const toast = useToast();
  const { state, busy, enable } = usePush();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden || state !== "off") return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable: it will simply show again next time */
    }
  };

  return (
    <div role="region" aria-label="Turn on notifications" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-royal/25 bg-[#eef4ff] px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-royal text-white">
        <BellRing className="size-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm text-navy">
        <strong>Get notified when a project is assigned to you.</strong> Turn on Chrome notifications and you will be told even when this tab is closed.
      </p>
      <Button
        size="sm"
        className="bg-royal hover:bg-royal/90"
        loading={busy}
        onClick={() =>
          enable()
            .then((s) => {
              if (s === "on") toast("Notifications are on for this browser");
              else if (s === "blocked") toast("Notifications are blocked. Allow them from the lock icon next to the address bar, then try again.", "error");
              else if (s === "unavailable") toast("Browser notifications are not set up on the server yet.", "error");
            })
            .catch((e) => toast(errorMessage(e), "error"))
        }
      >
        Turn on notifications
      </Button>
      <button type="button" onClick={dismiss} aria-label="Not now" className="rounded-md p-1.5 text-muted-foreground hover:bg-white">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
