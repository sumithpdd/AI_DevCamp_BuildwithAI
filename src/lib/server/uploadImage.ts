/**
 * Server-side image upload to Firebase Storage (Admin SDK).
 *
 * Saves the buffer at `destination` and returns a Firebase download URL that
 * carries a `firebaseStorageDownloadTokens` token. Tokened download URLs are
 * authorised by the token itself, so they work regardless of Storage security
 * rules — the same URL shape the client web SDK's `getDownloadURL()` produces.
 */

import { randomUUID } from "node:crypto";
import { adminStorageBucket } from "@/lib/firebase-admin";

export interface UploadedImage {
  /** Public, tokened download URL. */
  url: string;
  /** Object path within the bucket, e.g. "speakers/foo.jpg". */
  path: string;
}

export async function uploadImageToStorage(opts: {
  buffer: Buffer;
  /** Object path within the bucket, e.g. "speakers/foo.jpg". */
  destination: string;
  contentType: string;
}): Promise<UploadedImage> {
  const bucket = adminStorageBucket();
  const token = randomUUID();
  const file = bucket.file(opts.destination);

  await file.save(opts.buffer, {
    resumable: false,
    contentType: opts.contentType,
    metadata: {
      contentType: opts.contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    opts.destination
  )}?alt=media&token=${token}`;

  return { url, path: opts.destination };
}
