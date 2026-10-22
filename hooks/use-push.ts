"use client";

import { useCallback, useEffect, useState } from "react";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/push";

/** Whether this browser gets Chrome-style notifications for the signed-in person, and how to change it. */
export function usePush() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void currentPushState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      return s;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush();
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
