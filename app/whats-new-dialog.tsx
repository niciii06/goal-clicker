"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import type { WhatsNewEntry } from "./whats-new";

/** Shows what the latest update changed, once per player; closing it marks the entry as seen. */
export function WhatsNewDialog({ entry, onClose }: { entry: WhatsNewEntry; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onClose);
  return createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="account-dialog whats-new-dialog" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      <p className="eyebrow">WAS IST NEU · {entry.date}</p>
      <h2 id="whats-new-title">{entry.title}</h2>
      <ul>{entry.items.map((item) => <li key={item}>{item}</li>)}</ul>
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-primary" onClick={onClose}>Verstanden</button>
      </div>
    </div>
  </div>, document.body);
}
