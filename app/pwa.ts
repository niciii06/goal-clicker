// Install support for the web app. The browser offers the install prompt once, early during page load, so it is
// kept here until the player opens the account dialog and presses "App installieren".
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event as InstallPromptEvent; notify(); });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; notify(); });
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  // A failed registration only means no offline page; the game itself does not depend on it.
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
}

export function subscribeInstallState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

export function getInstallState(): InstallState {
  if (typeof window === "undefined") return "unavailable";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (deferredPrompt) return "prompt";
  // Safari on iPhone and iPad has no install prompt; the app is added through the share menu.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "unavailable";
}

export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}
