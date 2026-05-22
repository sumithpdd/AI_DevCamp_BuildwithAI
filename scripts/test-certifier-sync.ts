/**
 * Test Certifier lookup + optional Firestore link for one email.
 *   npx tsx --env-file=.env.local scripts/test-certifier-sync.ts sumithpd@gmail.com
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../src/lib/firebase-admin";
import {
  pickBestCertifierCredential,
  searchCertifierCredentialsByEmail,
} from "../src/lib/server/certifier";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/test-certifier-sync.ts <email>");
  process.exit(1);
}

async function main() {
  const db = adminDb();

  const byEmail = await db.collection("users").where("email", "==", email).get();
  const emailDoc = await db.collection("users").doc(email).get();
  const uidDocs = byEmail.docs.filter((d) => !d.id.includes("@"));

  console.log("\n--- Firestore users ---");
  if (emailDoc.exists) {
    const d = emailDoc.data()!;
    console.log(`  doc id (email): ${emailDoc.id} signedIn=${d.signedIn} status=${d.userStatus}`);
  }
  for (const d of uidDocs) {
    const u = d.data();
    console.log(
      `  uid doc: ${d.id} status=${u.userStatus} certId=${u.certifierCredentialId ?? "—"} publicId=${u.certifierCredentialPublicId ?? "—"}`
    );
  }
  if (!emailDoc.exists && uidDocs.length === 0) {
    console.log("  No user document found for this email.");
  }

  console.log("\n--- Certifier API search ---");
  try {
    const found = await searchCertifierCredentialsByEmail(email);
    if (found.length === 0) {
      const local = email.split("@")[0];
      const broad = await searchCertifierCredentialsByEmail(local + "@");
      if (broad.length > 0) {
        console.log(`  (hint) partial search returned ${broad.length} — check email spelling in Certifier`);
        for (const c of broad.slice(0, 3)) {
          console.log(`    ${c.recipientEmail} → ${c.viewUrl}`);
        }
      }
    }
    console.log(`  Found ${found.length} credential(s)`);
    for (const c of found.slice(0, 5)) {
      console.log(`    ${c.status} id=${c.id} publicId=${c.publicId} view=${c.viewUrl}`);
    }
    const best = pickBestCertifierCredential(found);
    if (!best) {
      console.log("\n  No credential to link. Issue credentials in Certifier for this email first.");
      return;
    }

    const target = uidDocs[0] ?? null;
    if (!target) {
      console.log("\n  Certifier has a credential but no Auth-linked users/{uid} doc. User must sign in first.");
      return;
    }

    await target.ref.update({
      certifierCredentialId: best.id,
      certifierCredentialPublicId: best.publicId,
      certifierCredentialStatus: best.status,
      certifierSyncedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`\n  Linked credential to users/${target.id}`);
    console.log(`  Open: ${best.viewUrl}`);
  } catch (e) {
    console.error("\n  Certifier API error:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
