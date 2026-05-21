/**
 * GET /api/me/certificate — certified users: Certifier credential link from profile or live search.
 */

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth, ok, err, isErrorResponse } from "@/lib/api-helpers";
import { logServerRouteException } from "@/lib/server/appErrorLog";
import {
  certifierCredentialViewUrl,
  pickBestCertifierCredential,
  searchCertifierCredentialsByEmail,
} from "@/lib/server/certifier";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (isErrorResponse(auth)) return auth;

  try {
    const snap = await adminDb().collection("users").doc(auth.uid).get();
    if (!snap.exists) return err("Profile not found", 404);
    const data = snap.data()!;
    const userStatus = (data.userStatus as string) || "pending";

    if (userStatus !== "certified") {
      return err("Certificates are available for certified attendees only", 403);
    }

    const email = (data.email as string) || auth.email;
    if (!email) return err("No email on profile", 400);

    let credentialId = data.certifierCredentialId as string | undefined;
    let publicId = data.certifierCredentialPublicId as string | undefined;
    let status = data.certifierCredentialStatus as string | undefined;
    let viewUrl =
      publicId && typeof publicId === "string"
        ? certifierCredentialViewUrl(publicId)
        : null;

    if (!credentialId || !publicId) {
      const found = await searchCertifierCredentialsByEmail(email);
      const best = pickBestCertifierCredential(found);
      if (best) {
        credentialId = best.id;
        publicId = best.publicId;
        status = best.status;
        viewUrl = best.viewUrl;
        await snap.ref.update({
          certifierCredentialId: best.id,
          certifierCredentialPublicId: best.publicId,
          certifierCredentialStatus: best.status,
          certifierSyncedAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (!viewUrl || !credentialId) {
      return ok({
        hasCertificate: false,
        message:
          "No certificate found in Certifier for this email yet. Contact the organisers if you expect one.",
      });
    }

    return ok({
      hasCertificate: true,
      credentialId,
      publicId,
      status: status ?? "unknown",
      viewUrl,
    });
  } catch (e) {
    logServerRouteException("GET /api/me/certificate", e);
    const msg = e instanceof Error ? e.message : "Failed to load certificate";
    if (msg.includes("CERTIFIER_API_TOKEN")) {
      return err("Certificate service is not configured", 503);
    }
    return err(msg, 500);
  }
}
