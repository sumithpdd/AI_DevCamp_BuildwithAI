/**
 * Cookie consent state (analytics/performance cookies).
 *
 * Essential cookies (Firebase auth session) are always allowed and are not
 * governed by this flag. Only optional analytics/performance cookies wait for
 * `granted`. Persisted in localStorage so the choice survives reloads.
 */

export const CONSENT_KEY = "aidevcamp:cookie-consent";

export type ConsentValue = "granted" | "denied";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to consent changes (for `useSyncExternalStore`). */
export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Client snapshot: the stored choice, or `null` if undecided. */
export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** Server snapshot: always undecided (no storage on the server). */
export function getServerConsent(): ConsentValue | null {
  return null;
}

export function setStoredConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private mode / storage disabled — treat as session-only, no persistence.
  }
  listeners.forEach((l) => l());
}
