/**
 * POST /api/speaker-call/upload-photo
 *
 * Uploads a speaker photo (multipart/form-data, field `file`) to Firebase
 * Storage under `speaker-submissions/` and returns a tokened download URL.
 *
 * Used by the public Call for Speakers form so submitted photos live in
 * Storage rather than as a bare filename.
 *
 * Auth: Public (no auth required — matches the public speaker-call form).
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadImageToStorage } from "@/lib/server/uploadImage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function sanitiseFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "photo";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided (expected form field 'file')." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image (JPG, PNG, etc.)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (max 5MB)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const destination = `speaker-submissions/${Date.now()}-${sanitiseFilename(
      file.name
    )}`;

    const { url } = await uploadImageToStorage({
      buffer,
      destination,
      contentType: file.type,
    });

    return NextResponse.json({ success: true, url }, { status: 201 });
  } catch (error) {
    console.error("Speaker photo upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload photo",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
