"use client";

import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * A modal dialog keeps the keyboard inside: focus moves in on open, Tab wraps around, Escape closes,
 * and focus returns to the element that had it before.
 */
export function useDialogFocus(open: boolean, dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex='-1'])") ?? [])].filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const inside = dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !inside)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); opener?.focus(); };
  }, [open, dialogRef]);
}

/** Asks before an action the player might regret. The safe choice comes first and has the focus. */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = "Abbrechen", onConfirm, onCancel }: { title: string; children?: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onCancel);
  // The header blurs its background, which would trap a fixed dialog inside it; the dialog lives on <body>.
  return createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div ref={dialogRef} className="account-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <h2 id="confirm-dialog-title">{title}</h2>
      {children}
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-secondary" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="mode-primary" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>, document.body);
}
