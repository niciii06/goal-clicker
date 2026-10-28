'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(change: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}

/** The system wish for less motion, kept current while a match is on screen. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
