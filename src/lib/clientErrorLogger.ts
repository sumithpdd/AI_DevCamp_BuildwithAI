import { auth } from "./firebase";
import { logAppException } from "./analytics";

export type ClientErrorPayload = {
  message: string;
  name?: string;
  stack?: string;
  source: "window" | "unhandledrejection" | "react" | "report";
};

/**
 * Send a non-throwing error report to `POST /api/log-error` (stored in Firestore).
 * Safe to call from try/catch or listeners.
 */
/** WebKit / Safari IndexedDB flakes; not actionable in error_logs and very noisy on iOS. */
function isNoisyIndexedDbRejectionMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("indexed database server lost") ||
    (m.includes("indexed database") && m.includes("refresh the page"))
  );
}

export async function reportClientError(
  payload: ClientErrorPayload
): Promise<void> {
  if (typeof window === "undefined") return;
  if (
    payload.source === "unhandledrejection" &&
    isNoisyIndexedDbRejectionMessage(payload.message)
  ) {
    return;
  }
  // Mirror to Google Analytics as an `exception` event (behaviour + stability
  // in one place). Full stack traces still go to `error_logs` below.
  logAppException(
    `[${payload.source}] ${payload.name ? payload.name + ": " : ""}${payload.message}`,
    payload.source === "react"
  );
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch("/api/log-error", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        path: window.location?.pathname,
        url: window.location?.href,
      }),
    });
    if (!res.ok) {
      console.error("[reportClientError] /api/log-error failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[reportClientError] request failed", e);
  }
}

export function installGlobalErrorListeners(): void {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __aidev_error_hooks?: boolean }).__aidev_error_hooks) {
    return;
  }
  (window as unknown as { __aidev_error_hooks: boolean }).__aidev_error_hooks = true;

  window.addEventListener("error", (ev) => {
    const err = ev.error;
    const message =
      err?.message || ev.message || "Unknown error";
    const name = err?.name || "Error";
    const stack = typeof err?.stack === "string" ? err.stack : undefined;
    void reportClientError({
      source: "window",
      message: String(message).slice(0, 1_500),
      name: String(name),
      stack: stack ? stack.slice(0, 8_000) : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    const message =
      r instanceof Error
        ? r.message
        : typeof r === "string"
          ? r
          : (() => {
              try {
                return JSON.stringify(r);
              } catch {
                return "Unhandled promise rejection";
              }
            })();
    const stack = r instanceof Error && r.stack ? r.stack : undefined;
    void reportClientError({
      source: "unhandledrejection",
      message: String(message).slice(0, 1_500),
      name: r instanceof Error ? r.name : "UnhandledRejection",
      stack: stack ? stack.slice(0, 8_000) : undefined,
    });
  });
}
