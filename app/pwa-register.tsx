"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "./pwa";

/** Registers the service worker and keeps the install prompt for later; renders nothing. */
export function PwaRegister() {
  useEffect(() => { registerServiceWorker(); }, []);
  return null;
}
