/**
 * Learning Assistant usage limit
 * ------------------------------
 * WHAT THIS DOES
 *   Stops any one attendee from asking the Learning Assistant more than a set
 *   number of questions per hour (30 by default).
 *
 * WHY WE NEED IT
 *   Every question is answered by Gemini using ONE shared API key. Without a
 *   limit, a single person (or a stuck script) could use up the whole budget
 *   and the assistant would stop working for everyone else.
 *
 * HOW IT WORKS
 *   1. Each attendee has one small record in Firestore:
 *        learning_chat_rate_limits/{userId}  →  { timestamps: [...] }
 *      `timestamps` holds the times of their recent questions.
 *   2. When a new question comes in, we drop any times older than one hour.
 *   3. If what's left is already at the limit, we say "limited" and tell the
 *      caller how long until the oldest question expires.
 *   4. Otherwise we add the current time and let the question through.
 *
 *   We store the count in Firestore (not in server memory) because the site
 *   runs on Vercel, which can start several copies of the server. A count kept
 *   in memory would only see part of the traffic; Firestore is shared by all.
 *
 * WHO IS NOT LIMITED
 *   Admins and moderators, so organisers can always test and help attendees.
 *
 * CHANGING THE LIMIT
 *   Set the environment variable LEARNING_CHAT_HOURLY_LIMIT (e.g. 50) on Vercel.
 *   No code change needed.
 *
 * SECURITY
 *   The collection is only read and written by the server (Admin SDK). The
 *   existing "default deny" rule in firestore.rules already blocks browsers
 *   from reading or editing it, so no rules change is needed.
 */

import { adminDb } from "@/lib/firebase-admin";

/** Firestore collection that stores each user's recent question times. */
export const LEARNING_CHAT_RATE_LIMITS_COLLECTION = "learning_chat_rate_limits";

/** Length of the counting window: one hour, in milliseconds. */
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Questions allowed per user per hour if no environment variable is set. */
const DEFAULT_HOURLY_LIMIT = 30;

/**
 * Returns the hourly limit to use.
 * Reads LEARNING_CHAT_HOURLY_LIMIT if it's a positive number, otherwise 30.
 */
export function learningChatHourlyLimit(): number {
  const fromEnv = Number(process.env.LEARNING_CHAT_HOURLY_LIMIT);
  const isValid = Number.isFinite(fromEnv) && fromEnv > 0;
  return isValid ? Math.floor(fromEnv) : DEFAULT_HOURLY_LIMIT;
}

/**
 * The answer we give back to the chat API:
 * - `{ limited: false }` → let the question through.
 * - `{ limited: true, ... }` → block it, and say when they can try again.
 */
export type LearningChatRateLimitResult =
  | { limited: false }
  | {
      limited: true;
      /** Seconds until the user can ask again. */
      retryAfterSeconds: number;
      /** The limit that was reached (shown in the message to the user). */
      limit: number;
    };

/**
 * Checks whether this user is allowed to ask another question right now,
 * and if they are, counts this question.
 *
 * @param userId - Firebase uid of the signed-in user.
 * @param role   - The user's role: "attendee", "moderator" or "admin".
 */
export async function checkLearningChatRateLimit(
  userId: string,
  role: string
): Promise<LearningChatRateLimitResult> {
  // Organisers are never limited.
  if (role === "admin" || role === "moderator") {
    return { limited: false };
  }

  const limit = learningChatHourlyLimit();
  const userRecord = adminDb()
    .collection(LEARNING_CHAT_RATE_LIMITS_COLLECTION)
    .doc(userId);

  try {
    // A transaction makes "read the count, then update it" happen as one step,
    // so two questions sent at the same moment can't both slip past the limit.
    return await adminDb().runTransaction(async (transaction) => {
      const now = Date.now();
      const snapshot = await transaction.get(userRecord);

      // Read the stored times. Treat a missing or broken record as "no questions yet".
      const storedTimes: unknown = snapshot.exists
        ? snapshot.data()?.timestamps
        : [];
      const allTimes = Array.isArray(storedTimes) ? storedTimes : [];

      // Keep only valid times from the last hour, oldest first.
      const timesInLastHour = allTimes
        .filter(
          (time): time is number =>
            typeof time === "number" && now - time < ONE_HOUR_MS
        )
        .sort((a, b) => a - b);

      // Limit reached: work out when the oldest question drops out of the window.
      if (timesInLastHour.length >= limit) {
        const oldestQuestionTime = timesInLastHour[0];
        const millisecondsToWait = oldestQuestionTime + ONE_HOUR_MS - now;
        const retryAfterSeconds = Math.max(1, Math.ceil(millisecondsToWait / 1000));
        return { limited: true, retryAfterSeconds, limit };
      }

      // Under the limit: record this question and let it through.
      transaction.set(userRecord, {
        timestamps: [...timesInLastHour, now],
        updatedAt: now,
      });
      return { limited: false };
    });
  } catch (error) {
    // If Firestore has a problem, we'd rather let the question through than
    // break the assistant for everyone. The error is logged so it can be fixed.
    console.error("Learning chat rate limit check failed", error);
    return { limited: false };
  }
}
