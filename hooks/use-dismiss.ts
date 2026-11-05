import { useEffect, useRef } from "react";

/** Closes a popup on a click or touch outside it, or on Escape. Put the returned ref on the popup's wrapper (button included). */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const onClose = useRef(close);
  useEffect(() => {
    onClose.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose.current();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose.current();
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return ref;
}
