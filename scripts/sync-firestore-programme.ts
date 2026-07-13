/**
 * Upserts default `SPEAKERS` and `SESSIONS` from `src/data/*` into Firestore (merge).
 *
 * Requires Firebase Admin env (same as API routes). From repo root:
 *   npx tsx --env-file=.env.local scripts/sync-firestore-programme.ts
 *
 * Or: npm run sync-firestore-programme
 */

import { SPEAKERS } from "../src/data/speakers";
import { SESSIONS } from "../src/data/sessions";
import { adminDb } from "../src/lib/firebase-admin";

async function main() {
  const db = adminDb();
  const now = new Date().toISOString();

  for (const s of SPEAKERS) {
    // Never overwrite `photo`: live roster photos are Firebase Storage URLs
    // written by `scripts/upload-speaker-photos.ts`. The source `photo` here is
    // a local /public path, so merging it would re-break the roster images.
    const speakerFields: Record<string, unknown> = { ...s };
    delete speakerFields.photo;
    await db
      .collection("speakers")
      .doc(s.id)
      .set({ ...speakerFields, updatedAt: now }, { merge: true });
  }

  for (const sess of SESSIONS) {
    const { id, ...rest } = sess;
    await db
      .collection("sessions")
      .doc(id)
      .set({ ...rest, id, updatedAt: now }, { merge: true });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        speakersWritten: SPEAKERS.length,
        sessionsWritten: SESSIONS.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
