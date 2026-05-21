/**
 * POST /api/me/activity — log session views, resource clicks, submission events.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, ok, err, isErrorResponse } from "@/lib/api-helpers";
import { parseJsonBody } from "@/lib/api/parseJsonBody";
import { logActivityEvent } from "@/lib/server/activityLog";
import { logServerRouteException } from "@/lib/server/appErrorLog";

const bodySchema = z
  .object({
    type: z.enum([
      "session_view",
      "session_video_click",
      "resource_click",
      "resources_folder_click",
      "assignment_submitted",
      "project_submitted",
    ]),
    sessionId: z.string().max(120).optional(),
    sessionTitle: z.string().max(500).optional(),
    resourceTitle: z.string().max(500).optional(),
    resourceUrl: z.string().max(2000).optional(),
    assignmentId: z.string().max(120).optional(),
    projectId: z.string().max(120).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (isErrorResponse(auth)) return auth;

  try {
    const parsed = await parseJsonBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const id = await logActivityEvent({
      userId: auth.uid,
      userEmail: auth.email,
      ...parsed.data,
    });
    return ok({ id });
  } catch (e) {
    logServerRouteException("POST /api/me/activity", e);
    return err("Failed to log activity", 500);
  }
}
