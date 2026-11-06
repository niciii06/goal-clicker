// Toasts stay long enough to read and wait their turn: a new message no longer wipes the one on screen, and the
// many small click messages (critical hit, streak) never push an error away.
export type ToastPriority = "error" | "info" | "minor";
export type ToastItem = { text: string; priority: ToastPriority };
export type ToastQueueState = { current: ToastItem | null; queue: ToastItem[] };

export const TOAST_QUEUE_LIMIT = 3;

/** 2.5 s at least, 60 ms per character for longer texts, at most 7 s; small click messages stay short. */
export function toastDuration(item: ToastItem) {
  if (item.priority === "minor") return 1400;
  return Math.min(7000, Math.max(2500, item.text.length * 60));
}

/** Adds a message: shown at once when nothing (or only a small click message) is on screen, else queued. */
export function pushToast(state: ToastQueueState, item: ToastItem): ToastQueueState {
  if (!item.text) return state;
  if (state.current?.text === item.text || state.queue.some((queued) => queued.text === item.text)) return state;
  if (!state.current || (state.current.priority === "minor" && item.priority !== "minor")) return { current: item, queue: state.queue };
  if (item.priority === "minor") return state;
  const queue = item.priority === "error" ? [item, ...state.queue] : [...state.queue, item];
  // When too many wait, the oldest plain message goes first; errors stay.
  while (queue.length > TOAST_QUEUE_LIMIT) {
    const index = queue.findIndex((queued) => queued.priority !== "error");
    queue.splice(index < 0 ? 0 : index, 1);
  }
  return { current: state.current, queue };
}

/** The message on screen ran out: the next one in line takes its place. */
export function nextToast(state: ToastQueueState): ToastQueueState {
  const [current = null, ...queue] = state.queue;
  return { current, queue };
}
