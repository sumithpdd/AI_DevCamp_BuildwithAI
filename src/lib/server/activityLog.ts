import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { ActivityEventType } from "@/types";

export type LogActivityInput = {
  userId: string;
  userEmail?: string;
  type: ActivityEventType;
  sessionId?: string;
  sessionTitle?: string;
  resourceTitle?: string;
  resourceUrl?: string;
  assignmentId?: string;
  projectId?: string;
  meta?: Record<string, string | number | boolean>;
};

export async function logActivityEvent(input: LogActivityInput): Promise<string> {
  const ref = await adminDb().collection("activity_events").add({
    userId: input.userId,
    userEmail: input.userEmail ?? null,
    type: input.type,
    sessionId: input.sessionId ?? null,
    sessionTitle: input.sessionTitle ?? null,
    resourceTitle: input.resourceTitle ?? null,
    resourceUrl: input.resourceUrl ?? null,
    assignmentId: input.assignmentId ?? null,
    projectId: input.projectId ?? null,
    meta: input.meta ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
