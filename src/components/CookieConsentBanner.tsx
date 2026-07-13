"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import {
  subscribeConsent,
  getStoredConsent,
  getServerConsent,
  setStoredConsent,
  type ConsentValue,
} from "@/lib/cookieConsent";
import { enableAnalytics, logPageView } from "@/lib/analytics";

/**
 * Cookie consent banner. Analytics/performance cookies stay off until the user
 * accepts; essential login cookies are always allowed. If consent was already
 * granted on a previous visit, analytics is bootstrapped silently on mount.
 *
 * Consent is read via `useSyncExternalStore` so it's SSR-safe (server renders
 * "undecided", hiding the banner until hydration) and updates instantly when
 * the user chooses.
 */
export default function CookieConsentBanner() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getStoredConsent,
    getServerConsent
  );

  // Start analytics whenever consent is (or becomes) granted. Idempotent.
  useEffect(() => {
    if (consent === "granted") {
      void enableAnalytics().then(() => logPageView(window.location.pathname));
    }
  }, [consent]);

  const choose = (value: ConsentValue) => setStoredConsent(value);

  // Hidden once a choice exists (and during SSR, where consent is null but the
  // banner would flash — acceptable: it appears after hydration).
  if (consent !== null) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:bottom-4 z-[90] sm:max-w-sm">
      <div className="rounded-xl border border-white/12 bg-gray-900/95 backdrop-blur p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            This site uses cookies for login and customization, and optional
            analytics to improve the experience.
          </div>
        </div>
        <div className="mt-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 border border-white/12 hover:bg-white/5 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
