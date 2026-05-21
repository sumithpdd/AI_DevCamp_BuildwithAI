import { auth } from "@/lib/firebase";
import type { ActivityEventType } from "@/types";

export type TrackActivityPayload = {
  type: ActivityEventType;
  sessionId?: string;
  sessionTitle?: string;
  resourceTitle?: string;
  resourceUrl?: string;
  assignmentId?: string;
  projectId?: string;
};

export async function trackActivity(payload: TrackActivityPayload): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch("/api/me/activity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking telemetry
  }
}
