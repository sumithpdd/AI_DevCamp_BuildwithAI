/**
 * POST /api/learning-chat — signed-in learning tool only (sessions / materials).
 * Every call is written to `learning_chat_logs` (Admin SDK).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, isErrorResponse, ok, err } from "@/lib/api-helpers";
import { processLearningChat } from "@/lib/learning-chat/chatService";
import { logLearningChatCall } from "@/lib/learning-chat/chatLog";
import { getActiveCohortId } from "@/lib/cohorts";
import { logServerRouteException } from "@/lib/server/appErrorLog";
import { logActivityEvent } from "@/lib/server/activityLog";
import { checkLearningChatRateLimit } from "@/lib/server/learningChatRateLimit";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  focusSessionId: z.string().trim().max(120).optional(),
  pathname: z.string().trim().max(200).optional(),
  /** Ignored for authz — server always uses active cohort. Kept for client compat. */
  cohortId: z.string().trim().max(80).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(16)
    .optional(),
});

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (isErrorResponse(auth)) return auth;

  const started = Date.now();
  const cohortId = getActiveCohortId();
  let messagePreview = "";
  let messageLength = 0;
  let historyTurns = 0;
  let focusSessionId: string | undefined;
  let pathname: string | undefined;

  try {
    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      await logLearningChatCall({
        userId: auth.uid,
        userEmail: auth.email,
        cohortId,
        messagePreview: "",
        messageLength: 0,
        historyTurns: 0,
        ok: false,
        error: "Invalid request",
        durationMs: Date.now() - started,
      }).catch(() => undefined);
      return err(parsed.error.issues[0]?.message || "Invalid request");
    }

    const { message, focusSessionId: focus, pathname: path, history } = parsed.data;
    messagePreview = message;
    messageLength = message.length;
    historyTurns = history?.length ?? 0;
    focusSessionId = focus;
    pathname = path;

    // Usage limit: stop one person using up the shared Gemini budget.
    // If they've hit their hourly limit, reply with a friendly message and
    // don't call Gemini. See src/lib/server/learningChatRateLimit.ts.
    const rate = await checkLearningChatRateLimit(auth.uid, auth.role);
    if (rate.limited) {
      const minutes = Math.ceil(rate.retryAfterSeconds / 60);
      const message = `You've reached the limit of ${rate.limit} questions an hour. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;

      // Still record the attempt in the chat log, marked as rate limited.
      await logLearningChatCall({
        userId: auth.uid,
        userEmail: auth.email,
        cohortId,
        focusSessionId,
        pathname,
        messagePreview,
        messageLength,
        historyTurns,
        ok: false,
        error: "Rate limited",
        durationMs: Date.now() - started,
      }).catch(() => undefined);

      // 429 = "Too Many Requests". Retry-After tells the browser when to try again.
      const res = err(message, 429);
      res.headers.set("Retry-After", String(rate.retryAfterSeconds));
      return res;
    }

    const result = await processLearningChat(message, {
      uid: auth.uid,
      email: auth.email,
      role: auth.role,
      cohortId,
      focusSessionId,
      pathname,
      history,
    });

    const durationMs = Date.now() - started;

    await logLearningChatCall({
      userId: auth.uid,
      userEmail: auth.email,
      cohortId,
      focusSessionId,
      pathname,
      messagePreview,
      messageLength,
      historyTurns,
      ok: !result.error,
      refusedOutOfScope: result.refusedOutOfScope,
      error: result.error,
      assistantPreview: result.text,
      toolsUsed: result.toolsUsed,
      durationMs,
    }).catch((e) => console.error("learning_chat_logs write failed", e));

    await logActivityEvent({
      userId: auth.uid,
      userEmail: auth.email,
      type: "learning_chat",
      sessionId: focusSessionId,
      meta: {
        ok: !result.error,
        refusedOutOfScope: Boolean(result.refusedOutOfScope),
        durationMs,
        toolsCount: result.toolsUsed?.length ?? 0,
      },
    }).catch(() => undefined);

    if (result.error) {
      return err(result.error, 502);
    }

    return ok({ text: result.text });
  } catch (e) {
    logServerRouteException("POST /api/learning-chat", e);
    await logLearningChatCall({
      userId: auth.uid,
      userEmail: auth.email,
      cohortId,
      focusSessionId,
      pathname,
      messagePreview,
      messageLength,
      historyTurns,
      ok: false,
      error: "Learning chat failed",
      durationMs: Date.now() - started,
    }).catch(() => undefined);
    return err("Learning chat failed", 500);
  }
}
