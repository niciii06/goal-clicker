"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import type { WhatsNewEntry } from "./whats-new";

/**
 * Shows what the latest update changed, once per player; closing it marks the entry as seen. With `archive` it
 * lists every existing entry again (opened from the Club tab), newest first.
 */
export function WhatsNewDialog({ entry, archive, onClose }: { entry: WhatsNewEntry; archive?: readonly WhatsNewEntry[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onClose);
  return createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="account-dialog whats-new-dialog" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      {archive ? <>
        <p className="eyebrow">NEUIGKEITEN</p>
        <h2 id="whats-new-title">Was sich zuletzt geändert hat</h2>
        <div className="whats-new-archive">{archive.map((item) => <section key={item.id}><p className="eyebrow">{item.date}</p><h3>{item.title}</h3><ul>{item.items.map((line) => <li key={line}>{line}</li>)}</ul></section>)}</div>
      </> : <>
        <p className="eyebrow">WAS IST NEU · {entry.date}</p>
        <h2 id="whats-new-title">{entry.title}</h2>
        <ul>{entry.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </>}
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-primary" onClick={onClose}>Verstanden</button>
      </div>
    </div>
  </div>, document.body);
}
