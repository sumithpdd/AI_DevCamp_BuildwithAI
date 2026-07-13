"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  logPageView,
  setAnalyticsUser,
  clearAnalyticsUser,
} from "@/lib/analytics";

/**
 * Fires GA4 `page_view` on client-side route changes and attaches non-PII user
 * properties (experience level, cohort status/role, country) for segmentation.
 *
 * The first page view (initial load) is logged by CookieConsentBanner once
 * analytics is enabled; this component logs every subsequent navigation, so we
 * skip its first render to avoid a duplicate. All calls no-op until consent is
 * granted and analytics is active.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const { user, userProfile } = useAuth();
  const isFirstRender = useRef(true);

  // Page views on navigation (skip initial render — banner logs the first one).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    logPageView(pathname);
  }, [pathname]);

  // Identify the user + segmentation properties (no email/name — non-PII only).
  useEffect(() => {
    if (user && userProfile) {
      setAnalyticsUser(user.uid, {
        experience_level: userProfile.experienceLevel,
        role: userProfile.role,
        user_status: userProfile.userStatus,
        country: userProfile.country,
      });
    } else if (!user) {
      clearAnalyticsUser();
    }
  }, [user, userProfile]);

  return null;
}
