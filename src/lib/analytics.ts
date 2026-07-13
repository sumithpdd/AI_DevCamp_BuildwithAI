/**
 * Google Analytics + Performance Monitoring helpers (browser only,
 * consent-gated).
 *
 * Nothing here touches Analytics until `enableAnalytics()` is called, which the
 * cookie-consent banner does only after the user accepts. Until then every
 * helper is a safe no-op, so no `_ga` cookie is set. All functions are safe to
 * call during SSR/tests.
 *
 * Usage:
 *   import { logAnalyticsEvent } from "@/lib/analytics";
 *   logAnalyticsEvent("assignment_submitted", { sessionId });
 */

import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from "firebase/analytics";
import { getPerformance } from "firebase/performance";
import app from "./firebase";

let analytics: Analytics | null = null;
let enabling: Promise<void> | null = null;

/**
 * Named custom events for key user actions. Keep names snake_case and stable —
 * renaming an event splits its history in the GA dashboard.
 */
export type AppAnalyticsEvent =
  | "login"
  | "sign_up"
  | "profile_updated"
  | "assignment_submitted"
  | "project_created"
  | "buddy_requested"
  | "session_checked_in"
  | "speaker_call_submitted"
  | "learning_task_completed";

/**
 * Initialise Analytics + Performance Monitoring. Idempotent. Call only after
 * cookie consent is granted. No-ops on the server, without a measurementId, or
 * where the browser doesn't support Analytics.
 */
export function enableAnalytics(): Promise<void> {
  if (enabling) return enabling;
  enabling = (async () => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return;
    try {
      if (await isSupported()) {
        analytics = getAnalytics(app);
      }
    } catch {
      analytics = null;
    }
    try {
      // Initialise Performance Monitoring for its side effect (auto-collects
      // web vitals + network latency); no handle needed afterwards.
      getPerformance(app);
    } catch {
      /* Performance Monitoring unavailable — non-fatal. */
    }
  })();
  return enabling;
}

/** True once Analytics has been initialised (consent granted + supported). */
export function isAnalyticsActive(): boolean {
  return analytics !== null;
}

/** Log a custom analytics event. No-ops until analytics is enabled. */
export function logAnalyticsEvent(
  event: AppAnalyticsEvent | string,
  params?: Record<string, unknown>
): void {
  if (!analytics) return;
  try {
    logEvent(analytics, event as string, params);
  } catch {
    // Analytics must never break app flow.
  }
}

/** Log a GA4 page_view for SPA route changes. No-ops until enabled. */
export function logPageView(path: string, title?: string): void {
  if (!analytics) return;
  try {
    logEvent(analytics, "page_view", {
      page_path: path,
      page_location: typeof window !== "undefined" ? window.location.href : path,
      page_title: title ?? (typeof document !== "undefined" ? document.title : undefined),
    });
  } catch {
    /* no-op */
  }
}

/**
 * Associate the current session with a user + segmentation properties
 * (experience level, cohort status/role, country). Use non-PII values only —
 * never set email or display name as a user property.
 */
export function setAnalyticsUser(
  uid: string,
  properties?: Record<string, string | undefined>
): void {
  if (!analytics) return;
  try {
    setUserId(analytics, uid);
    if (properties) {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(properties)) {
        if (typeof v === "string" && v.length > 0) clean[k] = v.slice(0, 36);
      }
      if (Object.keys(clean).length > 0) setUserProperties(analytics, clean);
    }
  } catch {
    /* no-op */
  }
}

/** Clear the associated user on sign-out. */
export function clearAnalyticsUser(): void {
  if (!analytics) return;
  try {
    setUserId(analytics, null);
  } catch {
    /* no-op */
  }
}

/**
 * Log an app error as a GA `exception` event so crashes surface alongside
 * behaviour data. Complements (does not replace) the `error_logs` pipeline in
 * `clientErrorLogger.ts`, which keeps full stack traces.
 */
export function logAppException(description: string, fatal = false): void {
  logAnalyticsEvent("exception", {
    description: description.slice(0, 500),
    fatal,
  });
}
