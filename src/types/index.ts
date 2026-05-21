export type UserRole = "admin" | "moderator" | "attendee";
export type UserStatus =
  | "pending"
  | "participated"
  | "certified"
  | "outstanding"
  | "not-certified"
  | "failed";

export type AttendanceMarkSource = "admin" | "self_check_in";

/** Per-session audit on `attendance/{uid}` under key `sessionAttendanceAudit`. */
export interface SessionAttendanceAuditEntry {
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  source: AttendanceMarkSource;
}

/**
 * Live self check-in window for a session. Stored in `session_self_checkin/{sessionId}` —
 * not on `sessions/*` (sessions are public-read; the code must stay server- or admin-only).
 */
export interface SessionSelfCheckInDocument {
  code: string;
  opensAt: string;
  closesAt: string;
  updatedAt?: string;
  updatedByUid?: string;
}

export interface AttendanceRecord {
  userId: string;
  [sessionId: string]: boolean | string | Record<string, SessionAttendanceAuditEntry> | undefined;
}

export interface UserProfile {
  /** Firebase Auth UID. Empty for pending (email-only) imports until they sign up. */
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  userStatus: UserStatus;
  registeredSessions: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
  bio?: string;
  roleTitle?: string;
  city?: string;
  country?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  skills?: string[];
  expertise?: string[];
  wantToLearn?: string[];
  canOffer?: string[];
  /** Google Form free-text: prior experience with AI. */
  priorAIKnowledge?: string;
  /** Google Form: areas of interest. */
  areasOfInterest?: string;
  /** Google Form: why join. */
  whyJoin?: string;
  /** Google Form: from programming disclaimer. */
  knowsProgramming?: boolean;
  /** Google Form: commitment disclaimer. */
  commitment?: boolean;
  /** Google Form: role (Current Role) from CSV. */
  formRole?: string;
  /** Google Form. */
  yearsOfExperience?: string;
  /** When the Google Form was submitted (ISO or raw). */
  formSubmittedAt?: string;
  /** Same as form submission time when imported (ISO). */
  registeredAt?: string;
  /** When this profile row was first created in Firestore (import or sign-up). */
  importCreatedAt?: string;
  /** When a pending import was merged to this Auth-backed profile. */
  importLinkedAt?: string;
  /** Normalised tags from the `tags` catalog (e.g. prior-ai-knowledge). Optional alongside free-text fields. */
  priorAIKnowledgeTags?: string[];

  /**
   * When true, other signed-in attendees can discover this profile in DevcampBuddies and send buddy requests.
   * You must enable this (and keep your profile in good shape) to use the buddies directory.
   */
  profilePublic?: boolean;

  /** Denormalised count of accepted DevcampBuddies connections (maintained by API). */
  buddyCount?: number;
  /** RSVP for the 23 Apr kick-off: in person (London) vs online only. */
  kickoffInPersonRsvp?: boolean;
  /**
   * `true` only after the user (or an admin) saves kick-off in-person vs online
   * from this app. Imports / CSV / merged rows must not set this — it keeps the
   * kick-off banner visible until they explicitly confirm, even if `kickoffInPersonRsvp` exists from legacy data.
   */
  kickoffRsvpExplicitInApp?: boolean;
  /**
   * ISO 8601 time when the user last set or changed their 23 Apr kick-off RSVP
   * (`kickoffInPersonRsvp` + `joiningInPerson`), including via admin.
   */
  kickoffRsvpUpdatedAt?: string;
  /**
   * Whether the last kick-off RSVP write came from the app (user) or an admin in Edit user.
   * Older rows may omit this; treat missing as unknown.
   */
  kickoffRsvpSetBy?: "app" | "admin";
  /** Set when `kickoffRsvpSetBy` is `admin` (who last changed kick-off fields). */
  kickoffRsvpSetByAdminUid?: string | null;
  kickoffRsvpSetByAdminEmail?: string | null;
  kickoffRsvpSetByAdminName?: string | null;
  /** Human-readable; use with kickoffInPersonRsvp (e.g. from kickoffRsvp.joiningInPersonLabel). */
  joiningInPerson?: string;
  /**
   * Set only in admin: organiser has manually confirmed in-person attendance (e.g. by email),
   * independent of the user’s in-app kick-off RSVP.
   */
  kickoffInPersonAdminConfirmed?: boolean;
  handle?: string;
  keepUpdated?: boolean;
  /**
   * Programme de-registration: no app login or API access until an admin clears this flag.
   * Also excludes the person from cohort bulk email.
   */
  programOptOut?: boolean;
  /** ISO time when {@link programOptOut} was set to true. */
  programOptOutAt?: string;
  /** Submitted the Google Form (imported or matched at sign-up). */
  preRegistered?: boolean;
  /** Has a Firebase account (app sign-up complete). */
  registered?: boolean;
  /** Whether this row is linked to Firebase Auth. False = pending import, doc id = email. */
  signedIn?: boolean;
  /**
   * When true, the person cannot use the app: ensure-profile, API calls, and client session
   * are rejected; set by admins (e.g. bounced or invalid email).
   */
  accountDisabled?: boolean;
  /** Optional note for admins (e.g. bounce reason). */
  accountDisabledReason?: string;
  /** How the account was first provisioned in Firestore (admin / tooling). */
  registrationSource?: "google" | "password";
  /**
   * Firebase Auth provider IDs, e.g. `google.com`, `password`. Synced on sign-in
   * so admins can see Google vs email/password (including accounts with both linked).
   */
  authProviders?: string[];
  /**
   * How the pending `users/{email}` row was created before first login, e.g. `csv`, `admin`, `bevy`.
   */
  importSource?: string;
  /**
   * When this person was present on a Bevy export; ISO. Used to reconcile the former Bevy
   * registration list with this app. See admin Bevy merge tool.
   */
  bevyRegisteredAt?: string;
  /** Name as on the Bevy export at merge time (audit / name-mismatch review). */
  bevyNameSnapshot?: string;
  /** Set when a moderator created the row from admin before the user signed in. */
  createdByAdmin?: boolean;
  /**
   * Firestore document id when it differs from `uid` (e.g. email-keyed pending import).
   * Omitted in normal app reads; set when listing users in admin.
   */
  firestoreId?: string;
  /**
   * Cached geocode for the admin users map (Nominatim). Valid while
   * {@link registrationMapLabel} matches the current derived label from
   * {@link location} / {@link city} / {@link country}.
   */
  registrationMapLabel?: string;
  registrationMapLat?: number;
  registrationMapLon?: number;
  registrationMapGeocodedAt?: string;
  /** Certifier credential document id (synced from API). */
  certifierCredentialId?: string;
  /** Certifier public id for verify / share link. */
  certifierCredentialPublicId?: string;
  /** Certifier status, e.g. draft | issued. */
  certifierCredentialStatus?: string;
  /** ISO time when credential ids were last synced from Certifier. */
  certifierSyncedAt?: string;
}

export type ActivityEventType =
  | "session_view"
  | "session_video_click"
  | "resource_click"
  | "resources_folder_click"
  | "assignment_submitted"
  | "project_submitted";

/** Server-written row in `activity_events` (Admin SDK only). */
export interface ActivityEvent {
  id?: string;
  userId: string;
  userEmail?: string | null;
  type: ActivityEventType;
  sessionId?: string | null;
  sessionTitle?: string | null;
  resourceTitle?: string | null;
  resourceUrl?: string | null;
  assignmentId?: string | null;
  projectId?: string | null;
  meta?: Record<string, string | number | boolean> | null;
  createdAt?: Date | string;
}

/** One person presenting (session may list several). */
export interface SessionSpeaker {
  name: string;
  title?: string;
  photo?: string;
  linkedinUrl?: string;
}

/** Role flags for the public speakers / mentors roster (`speakers` collection). */
export type SpeakerRole = "speaker" | "mentor";

/** One person in the programme roster — stored in Firestore `speakers/{id}`. */
export interface Speaker {
  id: string;
  name: string;
  title?: string;
  photo?: string;
  linkedinUrl?: string;
  /** Shown on the home page roster; defaults to both when omitted. */
  roles?: SpeakerRole[];
  /** Sort order for listings (ascending). */
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  id: string;
  number: number;
  title: string;
  date: string;
  time: string;
  duration?: string;
  week: number;
  topic: string;
  description: string;
  /** Preferred: roster ids in speaking order (see `speakers` collection). */
  speakerIds?: string[];
  /** Multiple speakers; when set (non-empty), takes precedence over legacy `speaker*` fields for display. */
  speakers?: SessionSpeaker[];
  /** @deprecated Prefer `speakers`; kept for backward compatibility and first-speaker mirror on save. */
  speaker?: string;
  speakerTitle?: string;
  speakerPhoto?: string;
  tags?: string[];
  whatYouWillLearn?: string[];
  buildIdeas?: string[];
  resources?: Resource[];
  videoUrl?: string;
  resourcesFolderUrl?: string;
  isKickoff?: boolean;
  isClosing?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Resource {
  title: string;
  url: string;
}

/**
 * One document per category in the `tags` Firestore collection (doc id = `id`).
 * Used for dropdowns / filters; user documents may store free text (`priorAIKnowledge`)
 * and/or structured tag arrays (`priorAIKnowledgeTags`) aligned with `userField`.
 */
export interface TagCategoryDocument {
  id: string;
  label: string;
  /** Which field on `users` this category relates to (e.g. priorAIKnowledge, skills). */
  userField: string;
  values: string[];
  order: number;
  updatedAt?: string;
}

export interface Assignment {
  id?: string;
  userId: string;
  /** Legacy / optional — new submissions omit this field (use userId + users/{uid} for email). */
  userEmail?: string;
  userName: string;
  weekNumber: number;
  sessionId: string;
  title: string;
  description: string;
  githubUrl?: string;
  demoUrl?: string;
  notebookUrl?: string;
  submittedAt: Date | string;
  /** ISO timestamp written at submit time (client) for reliable display/export. */
  submittedAtClient?: string;
  status: "submitted" | "reviewed" | "approved";
  feedback?: string;
  grade?: string;
}

export interface Project {
  id?: string;
  userId: string;
  /** Legacy / optional — new submissions omit this field (use userId + users/{uid} for email). */
  userEmail?: string;
  userName: string;
  title: string;
  description: string;
  techStack: string[];
  githubUrl?: string;
  demoUrl?: string;
  screenshotUrls?: string[];
  submittedAt: Date | string;
  submittedAtClient?: string;
  status: "submitted" | "reviewed" | "shortlisted" | "winner" | "passed" | "failed";
  feedback?: string;
  weekCompleted: number;
}

/** Row in Firestore `error_logs` (written only via Admin SDK / API). */
export interface AppErrorLog {
  id: string;
  message: string;
  name?: string;
  stack?: string;
  /** e.g. window | unhandledrejection | react | api | test */
  source: string;
  path?: string;
  url?: string;
  userId?: string;
  userEmail?: string;
  userAgent?: string;
  /** ISO 8601 from server */
  createdAt: string;
}

/** Admin: users on map (geocoded from location string) */
export type UserMapPoint = {
  docId: string;
  displayName: string;
  email: string;
  label: string;
  lat: number;
  lon: number;
  userStatus?: string;
};

export type UserMapFailedEntry = {
  displayName: string;
  email: string;
  label: string;
};

export type UserMapPayload = {
  points: UserMapPoint[];
  failed: UserMapFailedEntry[];
  skippedNoLocation: number;
};

/** Organiser-maintained checklist row in `learningTaskTemplates`. */
export interface LearningTaskTemplate {
  id: string;
  sessionKey: string;
  sessionLabel: string;
  /** Numeric ordering for sessions (1 = Session 1). */
  sessionOrder: number;
  title: string;
  category: LearningTaskCategory;
  /** Ordering within the session group. */
  sortOrder: number;
  active: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/** Per-user task in `learningTasks` — never visible to other users. */
export interface LearningTask {
  id: string;
  userId: string;
  sessionKey: string;
  sessionLabel: string;
  sessionOrder: number;
  title: string;
  category: LearningTaskCategory;
  priority: LearningTaskPriority;
  progress: LearningTaskProgress;
  dueDate?: Date | string | null;
  notes?: string;
  /** When copied from a template; used to skip duplicates on import. */
  sourceTemplateId?: string | null;
  sortOrder: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  /** Firebase uid of creator (same as owner for normal creates). */
  createdByUid?: string;
  /** Snapshot display name / email when created (denormalised). */
  createdByLabel?: string;
  updatedByUid?: string;
  updatedByLabel?: string;
}

/** Stored on tasks/templates — presets like `resource` are common; any trimmed label up to 80 chars is allowed. */
export type LearningTaskCategory = string;

export type LearningTaskPriority = "low" | "medium" | "high";

export type LearningTaskProgress = "not_started" | "in_progress" | "done";
