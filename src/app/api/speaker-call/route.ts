/**
 * POST /api/speaker-call
 *
 * Submit a speaker call form for a specific cohort.
 * Stores submission in speakerCallSubmissions/{cohortId}/submissions/{autoId}
 *
 * Auth: Public (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import * as z from "zod";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const speakerCallSchema = z.object({
  cohortId: z.string().min(1, "Cohort ID required"),
  speakerName: z.string().min(2, "Speaker name required"),
  speakerEmail: z.string().email("Valid email required"),
  speakerBio: z.string().min(10, "Biography must be at least 10 characters"),
  speakerPhotoUrl: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().optional().nullable(),
  sessionTitle: z.string().min(3, "Session title required"),
  sessionDescription: z.string().min(20, "Description must be at least 20 characters"),
  sessionTopic: z.string().min(2, "Topic required"),
  recordingLink: z.string().url().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  sessionType: z.enum(["talk", "workshop", "panel", "other"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  skills: z.array(z.string()).optional().default([]),
  expertise: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const validation = speakerCallSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      cohortId,
      speakerName,
      speakerEmail,
      speakerBio,
      speakerPhotoUrl,
      linkedinUrl,
      twitterUrl,
      sessionTitle,
      sessionDescription,
      sessionTopic,
      recordingLink,
      additionalNotes,
      sessionType,
      experienceLevel,
      skills,
      expertise,
    } = validation.data;

    // Check if cohort exists
    const cohortDoc = await db.collection("cohorts").doc(cohortId).get();
    if (!cohortDoc.exists) {
      return NextResponse.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    // Create submission document
    const submission = {
      cohortId,
      speakerName,
      speakerEmail,
      speakerBio,
      speakerPhotoUrl: speakerPhotoUrl || null,
      linkedinUrl: linkedinUrl || null,
      twitterUrl: twitterUrl || null,
      sessionTitle,
      sessionDescription,
      sessionTopic,
      recordingLink: recordingLink || null,
      additionalNotes: additionalNotes || null,
      sessionType,
      experienceLevel: experienceLevel || null,
      skills: skills || [],
      expertise: expertise || [],
      status: "submitted" as const,
      submittedAt: new Date(),
      submittedAtClient: new Date().toISOString(),
    };

    // Store in speakerCallSubmissions/{cohortId}/submissions/{autoId}
    const docRef = await db
      .collection("speakerCallSubmissions")
      .doc(cohortId)
      .collection("submissions")
      .add(submission);

    console.log(`✅ Speaker submission created: ${docRef.id} for cohort ${cohortId}`);

    // Send confirmation email to speaker (optional - implement email service as needed)
    // await sendSpeakerConfirmationEmail(speakerEmail, speakerName, sessionTitle);

    return NextResponse.json(
      {
        success: true,
        submissionId: docRef.id,
        message: `Thank you ${speakerName}! We've received your speaker submission and will review it shortly.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Speaker call submission error:", error);
    return NextResponse.json(
      {
        error: "Failed to submit speaker call",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
