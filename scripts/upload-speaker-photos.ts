/**
 * Uploads speaker roster photos from `public/speakers/*` to Firebase Storage
 * (`speakers/<filename>`) and writes the tokened download URL back to each
 * `speakers/{id}.photo` document in Firestore.
 *
 * Fixes broken roster images that pointed at local `/speakers/*` paths.
 *
 * Requires Firebase Admin env (same as API routes). From repo root:
 *   npx tsx --env-file=.env.local scripts/upload-speaker-photos.ts
 *
 * Or: npm run upload-speaker-photos
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { SPEAKERS } from "../src/data/speakers";
import { adminDb } from "../src/lib/firebase-admin";

const BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

async function main() {
  if (!BUCKET) {
    throw new Error(
      "Missing storage bucket env. Set FIREBASE_STORAGE_BUCKET or " +
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local."
    );
  }

  const db = adminDb(); // initialises the admin app
  const bucket = getStorage(getApps()[0]).bucket(BUCKET);
  const now = new Date().toISOString();

  const results: { id: string; url: string }[] = [];

  for (const s of SPEAKERS) {
    if (!s.photo) {
      console.warn(`⚠️  ${s.id}: no photo path, skipping`);
      continue;
    }

    const relPath = s.photo.replace(/^\//, ""); // speakers/foo.jpg
    const localPath = path.join(process.cwd(), "public", relPath);
    const filename = path.basename(relPath);
    const destination = `speakers/${filename}`;
    const contentType = contentTypeFor(filename);

    let buffer: Buffer;
    try {
      buffer = await readFile(localPath);
    } catch {
      console.warn(`⚠️  ${s.id}: local file not found (${localPath}), skipping`);
      continue;
    }

    const token = randomUUID();
    await bucket.file(destination).save(buffer, {
      resumable: false,
      contentType,
      metadata: {
        contentType,
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
      destination
    )}?alt=media&token=${token}`;

    await db
      .collection("speakers")
      .doc(s.id)
      .set({ photo: url, updatedAt: now }, { merge: true });

    results.push({ id: s.id, url });
    console.log(`✅ ${s.id} → ${url}`);
  }

  console.log(
    JSON.stringify(
      { ok: true, uploaded: results.length, total: SPEAKERS.length },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
