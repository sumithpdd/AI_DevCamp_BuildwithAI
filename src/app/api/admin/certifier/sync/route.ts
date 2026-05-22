/**
 * POST /api/admin/certifier/sync — sync Certifier credentials for certified attendees (admin only).
 * Body: { uids?: string[] } — optional subset; default all certified attendees with email.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin, ok, err, isErrorResponse } from "@/lib/api-helpers";
import { parseJsonBody } from "@/lib/api/parseJsonBody";
import { logServerRouteException } from "@/lib/server/appErrorLog";
import {
  pickBestCertifierCredential,
  searchCertifierCredentialsByEmail,
} from "@/lib/server/certifier";

const bodySchema = z
  .object({
    uids: z.array(z.string().min(1).max(128)).max(200).optional(),
    /** Sync one user by email (any status) — for testing / manual link. */
    email: z.string().email().max(320).optional(),
    /** When true with no uids/email, sync all users with userStatus=certified (default). */
    certifiedOnly: z.boolean().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  try {
    const parsed = await parseJsonBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const db = adminDb();
    let targets: DocumentSnapshot[] = [];

    if (parsed.data.email) {
      const email = parsed.data.email.trim().toLowerCase();
      const byEmail = await db.collection("users").where("email", "==", email).get();
      const uidDoc = byEmail.docs.find((d) => !d.id.includes("@"));
      if (uidDoc) targets = [uidDoc];
      else {
        const emailDoc = await db.collection("users").doc(email).get();
        if (emailDoc.exists) targets = [emailDoc];
      }
    } else if (parsed.data.uids?.length) {
      const snaps = await Promise.all(
        parsed.data.uids.map((uid) => db.collection("users").doc(uid).get())
      );
      targets = snaps.filter((s) => s.exists);
    } else if (parsed.data.certifiedOnly === false) {
      const q = await db.collection("users").where("role", "==", "attendee").get();
      targets = q.docs.filter((d) => !d.id.includes("@"));
    } else {
      const q = await db
        .collection("users")
        .where("userStatus", "==", "certified")
        .where("role", "==", "attendee")
        .get();
      targets = q.docs;
    }

    const synced: { uid: string; email: string; credentialId: string }[] = [];
    const missing: { uid: string; email: string }[] = [];
    const failed: { uid: string; email: string; error: string }[] = [];

    for (const doc of targets) {
      const data = doc.data();
      if (!data) continue;
      const email = (data.email as string)?.trim();
      if (!email) {
        failed.push({ uid: doc.id, email: "", error: "No email" });
        continue;
      }
      try {
        const found = await searchCertifierCredentialsByEmail(email);
        const best = pickBestCertifierCredential(found);
        if (!best) {
          missing.push({ uid: doc.id, email });
          continue;
        }
        await doc.ref.update({
          certifierCredentialId: best.id,
          certifierCredentialPublicId: best.publicId,
          certifierCredentialStatus: best.status,
          certifierSyncedAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        synced.push({ uid: doc.id, email, credentialId: best.id });
      } catch (e) {
        failed.push({
          uid: doc.id,
          email,
          error: e instanceof Error ? e.message : "sync failed",
        });
      }
    }

    return ok({
      total: targets.length,
      synced: synced.length,
      missing: missing.length,
      failed: failed.length,
      syncedRows: synced,
      missingRows: missing,
      failedRows: failed,
    });
  } catch (e) {
    logServerRouteException("POST /api/admin/certifier/sync", e);
    const msg = e instanceof Error ? e.message : "Sync failed";
    if (msg.includes("CERTIFIER_API_TOKEN")) {
      return err("Set CERTIFIER_API_TOKEN in server environment", 503);
    }
    return err(msg, 500);
  }
}
