// Local notices without a push server: while Goal Clicker is open in a background tab or as installed app, the
// page itself shows a notification when something becomes ready (journey arrived, daily reward, tournament break
// over). Opt in per device; nothing is sent anywhere. The app icon badge shows the number of open actions.
import type { OpenAction, OpenActionId } from "./status";

/** Actions worth a notification; packs and the album come from things the player just did. */
export const NOTIFY_ACTIONS: readonly OpenActionId[] = ["journey", "daily", "tournament", "offer", "press"];

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

/** The actions that newly appeared since the last check and deserve a notification. */
export function newNotifiableActions(previous: ReadonlySet<string>, actions: readonly OpenAction[]) {
  return actions.filter((action) => NOTIFY_ACTIONS.includes(action.id) && !previous.has(action.id));
}

export async function showLocalNotification(title: string, body: string, tag: string) {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions = { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) { await registration.showNotification(title, options); return true; }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/** The number on the icon of the installed app; browsers without it ignore the call. */
export function setAppBadge(count: number) {
  const nav = typeof navigator === "undefined" ? null : navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav?.setAppBadge) return;
  void (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.() ?? nav.setAppBadge(0)).catch(() => undefined);
}
