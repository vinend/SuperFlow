"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function Dialog({
  label,
  className = "",
  close,
  busy = false,
  children,
  contextual = false,
}: {
  label: string;
  className?: string;
  close: () => void;
  busy?: boolean;
  children: ReactNode;
  contextual?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const media = window.matchMedia("(min-width: 1180px)");
    function show() {
      if (dialog.open) dialog.close();
      const modal = !contextual || !media.matches;
      dialog.setAttribute("aria-modal", String(modal));
      if (modal) {
        dialog.showModal();
        document.body.style.overflow = "hidden";
      } else {
        dialog.show();
        if (!document.querySelector("dialog:modal"))
          document.body.style.overflow = overflow;
      }
      dialog.scrollTop = 0;
    }
    show();
    media.addEventListener("change", show);
    function escape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !dialog.matches(":modal") &&
        !document.querySelector("dialog:modal")
      ) {
        event.preventDefault();
        closeRef.current();
      }
    }
    document.addEventListener("keydown", escape);
    return () => {
      media.removeEventListener("change", show);
      document.removeEventListener("keydown", escape);
      dialog.close();
      if (!document.querySelector("dialog:modal"))
        document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [contextual]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`modal ${className}`}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || !event.currentTarget.matches(":modal"))
          return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((item) => item.getClientRects().length && item.tabIndex >= 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close();
      }}
    >
      {children}
    </dialog>
  );
}
