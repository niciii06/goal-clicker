// Invite link for a co-op world (Q60) and the desktop keyboard shortcuts (Q61).

/** "https://…/home?join=ABC123" */
export function inviteUrl(origin: string, code: string) {
  return `${origin.replace(/\/$/, "")}/home?join=${encodeURIComponent(code)}`;
}

/** The room code of an invite link, or "" when the address carries none (six letters or digits). */
export function joinCodeFromSearch(search: string) {
  const code = new URLSearchParams(search).get("join")?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

export type ShortcutAction = { kind: "tab"; index: number } | { kind: "penalty"; direction: "left" | "center" | "right" } | null;

/**
 * 1 to 7 open the main tabs; during a shootout the arrow keys aim (left, down for the middle, right). Typing in a
 * field, held modifier keys and repeated keys never trigger anything.
 */
export function shortcutFor(event: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; repeat?: boolean; targetTag?: string; editable?: boolean }, shootout: boolean): ShortcutAction {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.editable) return null;
  const tag = (event.targetTag ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
  if (shootout) return event.key === "ArrowLeft" ? { kind: "penalty", direction: "left" } : event.key === "ArrowRight" ? { kind: "penalty", direction: "right" } : event.key === "ArrowDown" ? { kind: "penalty", direction: "center" } : null;
  if (/^[1-7]$/.test(event.key)) return { kind: "tab", index: Number(event.key) - 1 };
  return null;
}
