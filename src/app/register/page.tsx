"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  AtSign,
  User,
  Mail,
  Lock,
  Globe,
  ChevronLeft,
  ChevronRight,
  Zap,
  Camera,
  MapPin,
  MonitorPlay,
} from "lucide-react";
import LocationPicker from "@/components/ui/LocationPicker";
import SkillsSelector from "@/components/ui/SkillsSelector";
import CopyTextButton from "@/components/ui/CopyTextButton";
import { GithubIcon, LinkedinIcon } from "@/components/icons/SocialBrandIcons";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  getRedirectResult,
} from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebase";
import { loginWithGoogle } from "@/lib/auth";
import {
  ensureProfileOnServer,
  fetchMyPreregisteredRow,
  linkPreregisterRowOnServer,
} from "@/lib/meApi";
import { stripUndefinedForFirestoreClient } from "@/lib/stripUndefinedFirestore";
import {
  kickoffRsvpWritePayload,
  KICKOFF_IN_PERSON_RSVP_POLICY,
  SESSION_SKIP_REGISTER_REDIRECT,
} from "@/lib/kickoffRsvp";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import { firebaseAuthErrorMessage } from "@/lib/firebaseAuthErrors";
import { isRegistrationOpen } from "@/lib/registrationOpen";
import RegistrationClosed from "@/components/RegistrationClosed";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  handle: string;
  displayName: string;
  email: string;
  password: string;
  // Step 2
  photoFile: File | null;
  photoPreview: string;
  roleTitle: string;
  city: string;
  country: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  // Step 3
  bio: string;
  skills: string[];
  expertise: string[];
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
  wantToLearn: string[];
  canOffer: string[];
  agreedToTerms: boolean;
  keepUpdated: boolean;
  /** null = not chosen yet — required on step 2 (23 Apr kick-off RSVP). */
  kickoffInPersonRsvp: boolean | null;
  // Step 4
  projectName: string;
  projectDescription: string;
  projectUrl: string;
}

import { SKILL_TAGS, EXPERTISE_TAGS, WANT_TO_LEARN_TAGS as WANT_TAGS, CAN_OFFER_TAGS as OFFER_TAGS } from "@/data/tags";

const STEPS = [
  { number: 1, title: "Your basics", subtitle: "Name, handle & password" },
  { number: 2, title: "Your profile", subtitle: "Role & location" },
  { number: 3, title: "Almost there", subtitle: "Story & agreement" },
  { number: 4, title: "Learning goal", subtitle: "What are you building?" },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    handle: "",
    displayName: "",
    email: "",
    password: "",
    photoFile: null,
    photoPreview: "",
    roleTitle: "",
    city: "",
    country: "",
    experienceLevel: "beginner",
    bio: "",
    skills: [],
    expertise: [],
    linkedinUrl: "",
    githubUrl: "",
    websiteUrl: "",
    wantToLearn: [],
    canOffer: [],
    agreedToTerms: false,
    keepUpdated: false,
    kickoffInPersonRsvp: null,
    projectName: "",
    projectDescription: "",
    projectUrl: "",
  });

  const GOOGLE_REGISTER_PENDING = "bwai_pending_google_register";

  /** After Google `signInWithRedirect` (mobile), finish registration navigation here — popup path uses `handleGoogle`. */
  const completeGoogleRegistration = useCallback(async () => {
    try {
      const ensured = await ensureProfileOnServer();
      if (!ensured.created && ensured.profileExists) {
        toast.success("Welcome back!");
        router.push("/dashboard");
        return;
      }
      if (ensured.preRegistrationMatched) {
        toast.success("Welcome back! Your registration form has been matched ✓");
      } else {
        toast.success("Welcome to AI DevCamp! 🚀");
      }
      sessionStorage.setItem(SESSION_SKIP_REGISTER_REDIRECT, "1");
      router.push("/register/kickoff");
    } finally {
      sessionStorage.removeItem(GOOGLE_REGISTER_PENDING);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    getRedirectResult(auth).then(async (cred) => {
      if (!cred?.user || cancelled) return;
      setSubmitting(true);
      try {
        await completeGoogleRegistration();
      } catch (err) {
        console.error(err);
        toast.error(firebaseAuthErrorMessage(err));
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [completeGoogleRegistration]);

  // Redirect if already logged in (not when heading to kick-off RSVP)
  useEffect(() => {
    if (loading || !user) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_SKIP_REGISTER_REDIRECT) === "1") return;
    /* Mobile Google redirect: finish `completeGoogleRegistration` before bouncing to dashboard */
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(GOOGLE_REGISTER_PENDING) === "1") return;
    router.push("/dashboard");
  }, [user, loading, router]);

  // Form RSVP defaults are merged from `users/{email}` (via /api/me/preregistered)
  // when the account is created, then appear on the profile for kickoff pre-fill.

  // Handle uniqueness check (via API — Firestore rules deny anonymous reads of others' user docs)
  useEffect(() => {
    if (!form.handle || form.handle.length < 2) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const h = encodeURIComponent(form.handle.toLowerCase());
        const res = await fetch(`/api/public/handle-available?h=${h}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setHandleStatus("idle");
          return;
        }
        const body = (await res.json()) as { ok?: boolean; data?: { available?: boolean } };
        const available = body?.data?.available === true;
        setHandleStatus(available ? "available" : "taken");
      } catch {
        if (!ac.signal.aborted) setHandleStatus("idle");
      }
    }, 500);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [form.handle]);

  const set = (key: keyof FormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleTag = (field: "wantToLearn" | "canOffer", tag: string) => {
    setForm((prev) => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(tag) ? arr.filter((t) => t !== tag) : [...arr, tag],
      };
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.handle.trim()) e.handle = "Handle is required";
      else if (handleStatus === "taken") e.handle = "Handle already taken";
      if (!form.displayName.trim()) e.displayName = "Name is required";
      if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
      if (form.password.length < 8) e.password = "Min. 8 characters";
    }
    if (s === 2) {
      if (form.kickoffInPersonRsvp === null) e.kickoff = "Please choose how you’ll join the 23 April kick-off";
      if (!form.roleTitle.trim()) e.roleTitle = "Role / title is required";
      if (!form.city.trim()) e.city = "City is required";
      if (!form.country.trim()) e.country = "Country is required";
    }
    if (s === 3) {
      if (form.bio.trim().length < 30) e.bio = "Add at least 30 characters";
      if (!form.agreedToTerms) e.terms = "You must agree to the terms";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  // ── Photo ───────────────────────────────────────────────────────────────────

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set("photoFile", file);
    set("photoPreview", URL.createObjectURL(file));
  };

  // ── Google sign-up ──────────────────────────────────────────────────────────

  const handleGoogle = async () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(GOOGLE_REGISTER_PENDING, "1");
    }
    setSubmitting(true);
    try {
      const cred = await loginWithGoogle();
      if (!cred) {
        /* Mobile: browser follows redirect to Google — flag cleared when `completeGoogleRegistration` runs */
        return;
      }
      await completeGoogleRegistration();
    } catch (err) {
      console.error(err);
      toast.error(firebaseAuthErrorMessage(err));
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(GOOGLE_REGISTER_PENDING);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Final submit ─────────────────────────────────────────────────────────────

  const handleFinish = async (skip = false) => {
    setSubmitting(true);
    try {
      // Create Firebase Auth user
      const result = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const { user: newUser } = result;

      // Upload photo if provided
      let photoURL = "";
      if (form.photoFile) {
        const storageRef = ref(storage, `avatars/${newUser.uid}`);
        await uploadBytes(storageRef, form.photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(newUser, {
        displayName: form.displayName,
        photoURL: photoURL || undefined,
      });

      const preReg = await fetchMyPreregisteredRow();

      // Save user document
      const userData = {
        uid: newUser.uid,
        email: form.email,
        displayName: form.displayName,
        handle: form.handle.toLowerCase(),
        photoURL,
        role: "attendee",
        userStatus: "participated",
        registrationSource: "password" as const,
        authProviders: newUser.providerData.map((p) => p.providerId),
        roleTitle: form.roleTitle,
        city: form.city,
        country: form.country,
        location: [form.city, form.country].filter(Boolean).join(", "),
        experienceLevel: form.experienceLevel,
        bio: form.bio,
        linkedinUrl: form.linkedinUrl,
        githubUrl: form.githubUrl,
        websiteUrl: form.websiteUrl,
        skills: form.skills,
        expertise: form.expertise,
        wantToLearn: form.wantToLearn,
        canOffer: form.canOffer,
        keepUpdated: form.keepUpdated,
        registeredSessions: [],
        signedIn: true,
        registered: true,
        ...(preReg && {
          formRole: preReg.formRole,
          yearsOfExperience: preReg.yearsOfExperience,
          priorAIKnowledge: preReg.priorAIKnowledge,
          areasOfInterest: preReg.areasOfInterest,
          whyJoin: preReg.whyJoin,
          formSubmittedAt: preReg.formSubmittedAt,
          knowsProgramming: preReg.knowsProgramming,
          commitment: preReg.commitment,
          preRegistered: true,
        }),
        // Kick-off RSVP overrides any imported joiningInPerson from pre-registration
        ...kickoffRsvpWritePayload(form.kickoffInPersonRsvp!),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const userWrite = stripUndefinedForFirestoreClient(
        userData as unknown as Record<string, unknown>
      );
      await setDoc(doc(db, "users", newUser.uid), userWrite);

      // Send email verification link
      await sendEmailVerification(newUser);

      if (preReg) {
        await linkPreregisterRowOnServer();
      }

      // Save project if not skipped
      if (!skip && form.projectName.trim()) {
        await setDoc(doc(collection(db, "projects")), {
          userId: newUser.uid,
          userName: form.displayName,
          title: form.projectName,
          description: form.projectDescription,
          techStack: [],
          demoUrl: form.projectUrl,
          weekCompleted: 1,
          status: "submitted",
          submittedAt: serverTimestamp(),
        });
      }

      if (preReg) {
        toast.success("Account created! Your form registration has been matched ✓ Check your email to verify.");
      } else {
        toast.success("Welcome to AI DevCamp! 🚀 Check your email to verify your account.");
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === "auth/email-already-in-use") {
        toast.error("Email already registered — please sign in instead");
        setStep(1);
        setErrors({ email: "Already registered" });
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-green-400" size={32} />
      </div>
    );
  }

  const progress = ((step - 1) / 3) * 100;

  if (!isRegistrationOpen()) {
    return <RegistrationClosed />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] flex">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-950 border-r border-white/8 p-8 flex-shrink-0">
        <Link href="/" className="flex items-center gap-3 mb-10">
          <Image src="/logo.png" alt="AI DevCamp" width={36} height={36} className="rounded-xl" />
          <span className="font-mono font-bold text-white text-sm">AI_DEVCAMP</span>
        </Link>

        <nav className="space-y-2">
          {STEPS.map((s) => {
            const done = step > s.number;
            const active = step === s.number;
            return (
              <div
                key={s.number}
                className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-all ${
                  active ? "bg-green-500/10 border border-green-500/30" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 mt-0.5 transition-all ${
                    done
                      ? "bg-green-500 border-green-500 text-gray-950"
                      : active
                        ? "border-green-400 text-green-400"
                        : "border-white/20 text-gray-600"
                  }`}
                >
                  {done ? <CheckCircle2 size={14} /> : s.number}
                </div>
                <div>
                  <p className={`text-sm font-semibold leading-tight ${active ? "text-white" : done ? "text-gray-400" : "text-gray-600"}`}>
                    {s.title}
                  </p>
                  <p className={`text-xs mt-0.5 ${active ? "text-gray-400" : "text-gray-700"}`}>
                    {s.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto">
          <Link href="/" className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors font-mono">
            <ChevronLeft size={14} />
            Back to site
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-5 py-4 border-b border-white/8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="AI DevCamp" width={32} height={32} className="rounded-lg" />
            <span className="font-mono font-bold text-white text-sm">AI_DEVCAMP</span>
          </Link>
          <span className="font-mono text-xs text-gray-500">Step {step} of 4</span>
        </div>

        <div className="flex-1 flex flex-col max-w-xl w-full mx-auto px-5 sm:px-8 py-10">

          {/* Step indicator + progress */}
          <div className="mb-8">
            <p className="font-mono text-xs text-green-500/60 tracking-widest mb-2">
              STEP {step} OF 4
            </p>
            <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progress + 25}%` }}
              />
            </div>
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="flex-1 flex flex-col">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-1 leading-tight">
                Who are <span className="text-green-400">you?</span>
              </h1>
              <p className="text-gray-400 mb-3">
                Your handle and login details — this is how you&apos;ll show up on AI DevCamp.
              </p>
              <p className="text-gray-500 text-sm mb-8">
                You don&apos;t need to have filled the interest form first. If you use the same email you used before, we&apos;ll match your account automatically.
              </p>

              {/* Google button */}
              <button
                onClick={handleGoogle}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 mb-5 text-sm"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : (
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-600 font-mono">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="space-y-4">
                {/* Handle */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Choose your <span className="text-green-400">@handle</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">This is how you&apos;ll be found and searched on AI DevCamp.</p>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <AtSign size={16} />
                    </div>
                    <input
                      value={form.handle}
                      onChange={(e) => set("handle", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="yourhandle"
                      className={`w-full bg-white/5 border rounded-xl px-4 py-3 pl-9 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.handle ? "border-red-500 focus:ring-red-500" :
                        handleStatus === "available" ? "border-green-500/50 focus:ring-green-500" :
                        handleStatus === "taken" ? "border-red-500/50 focus:ring-red-500" :
                        "border-white/10 focus:ring-green-500"
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {handleStatus === "checking" && <Loader2 size={14} className="animate-spin text-gray-500" />}
                      {handleStatus === "available" && <CheckCircle2 size={14} className="text-green-400" />}
                      {handleStatus === "taken" && <span className="text-xs text-red-400">taken</span>}
                    </div>
                  </div>
                  {form.handle && handleStatus === "available" && (
                    <p className="text-xs text-green-400 mt-1 font-mono">
                      ✓ Handle is available · aidevcamp.app/profile/{form.handle}
                    </p>
                  )}
                  {errors.handle && <p className="text-xs text-red-400 mt-1">{errors.handle}</p>}
                </div>

                {/* Display name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    What should we call you?
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Your display name — can be your real name or an alias.</p>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={form.displayName}
                      onChange={(e) => set("displayName", e.target.value)}
                      placeholder="Your name or alias"
                      className={`w-full bg-white/5 border rounded-xl px-4 py-3 pl-9 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${errors.displayName ? "border-red-500" : "border-white/10"}`}
                    />
                  </div>
                  {errors.displayName && <p className="text-xs text-red-400 mt-1">{errors.displayName}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Your email address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@example.com"
                      className={`w-full bg-white/5 border rounded-xl px-4 py-3 pl-9 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${errors.email ? "border-red-500" : "border-white/10"}`}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Create a password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="Min. 8 characters"
                      className={`w-full bg-white/5 border rounded-xl px-4 py-3 pl-9 pr-10 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${errors.password ? "border-red-500" : "border-white/10"}`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.password.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                          form.password.length >= i * 3
                            ? form.password.length < 6 ? "bg-red-500"
                            : form.password.length < 10 ? "bg-yellow-400"
                            : "bg-green-500"
                            : "bg-white/10"
                        }`} />
                      ))}
                    </div>
                  )}
                  {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
                </div>
              </div>

              <div className="mt-6">
                <button onClick={handleNext} className="w-full bg-green-500 hover:bg-green-400 text-gray-950 font-bold py-3.5 rounded-xl font-mono text-sm transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2">
                  CONTINUE <ChevronRight size={18} />
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-5">
                Already have an account?{" "}
                <Link href="/?login=1" className="text-green-400 hover:text-green-300 font-semibold">
                  Sign in
                </Link>
                {" · "}
                <Link href="/?login=1&reset=1" className="text-gray-500 hover:text-green-300">
                  Forgot password?
                </Link>
              </p>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="flex-1 flex flex-col">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-1 leading-tight">
                Your <span className="text-green-400">profile.</span>
              </h1>
              <p className="text-gray-400 mb-8">This is what others will see on your profile.</p>

              <div className="space-y-5">
                {/* Kick-off RSVP — first (23 Apr in-person vs online) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    23 April kick-off — how will you join? <span className="text-red-400">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    {KICKOFF_IN_PERSON_RSVP_POLICY}{" "}
                    <span className="text-amber-400/90">Swag may be available for in-person attendees</span> (while
                    stocks last).
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => set("kickoffInPersonRsvp", true)}
                      className={`w-full text-left flex gap-3 p-4 rounded-xl border-2 transition-all ${
                        form.kickoffInPersonRsvp === true
                          ? "border-green-500 bg-green-500/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <MapPin size={22} className="text-green-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-white">In person — London (RSVP)</div>
                        <div className="text-xs text-gray-400 mt-1">
                          I plan to attend the kick-off at Skyscanner HQ · W1D 4AL · 6:00 PM
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => set("kickoffInPersonRsvp", false)}
                      className={`w-full text-left flex gap-3 p-4 rounded-xl border-2 transition-all ${
                        form.kickoffInPersonRsvp === false
                          ? "border-green-500 bg-green-500/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <MonitorPlay size={22} className="text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-white">Online only</div>
                        <div className="text-xs text-gray-400 mt-1">
                          I’ll follow along remotely (no in-person RSVP for this date)
                        </div>
                      </div>
                    </button>
                  </div>
                  {errors.kickoff && <p className="text-xs text-red-400 mt-2">{errors.kickoff}</p>}
                </div>

                {/* Photo */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Profile photo <span className="text-gray-600">(Optional)</span>
                  </label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-4 bg-white/5 border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 rounded-xl px-5 py-4 transition-all"
                  >
                    {form.photoPreview ? (
                      <Image src={form.photoPreview} alt="Preview" width={48} height={48} className="rounded-full object-cover w-12 h-12 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Camera size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">
                        {form.photoPreview ? "Change photo" : "Upload a photo or logo"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">PNG, JPG or GIF — max 5MB</p>
                    </div>
                  </button>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Your role or title <span className="text-red-400">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Appears at the top of your profile — keep it short and accurate.</p>
                  <input
                    value={form.roleTitle}
                    onChange={(e) => set("roleTitle", e.target.value)}
                    placeholder="e.g. Software Engineer, Student, Data Analyst"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${errors.roleTitle ? "border-red-500" : "border-white/10"}`}
                  />
                  {errors.roleTitle && <p className="text-xs text-red-400 mt-1">{errors.roleTitle}</p>}
                </div>

                {/* Location */}
                <div>
                  <p className="text-xs text-gray-500 mb-3">Helps us connect you with people nearby for IRL events.</p>
                  <LocationPicker
                    city={form.city}
                    country={form.country}
                    onCityChange={(v) => set("city", v)}
                    onCountryChange={(v) => set("country", v)}
                    cityError={errors.city}
                    countryError={errors.country}
                  />
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your AI experience level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => set("experienceLevel", level)}
                        className={`py-3 rounded-xl text-sm font-semibold border-2 capitalize transition-all ${
                          form.experienceLevel === level
                            ? "bg-green-500/15 border-green-500 text-green-300"
                            : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={handleBack} className="flex items-center justify-center gap-1 border-2 border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-mono font-bold px-5 py-3.5 rounded-xl transition-all text-sm">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={handleNext} className="flex-1 bg-green-500 hover:bg-green-400 text-gray-950 font-bold py-3.5 rounded-xl font-mono text-sm transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2">
                  CONTINUE <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="flex-1 flex flex-col">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-1 leading-tight">
                Almost <span className="text-green-400">there.</span>
              </h1>
              <p className="text-gray-400 mb-8">
                Last step — share a bit about yourself and agree to the rules.
              </p>

              <div className="space-y-5">
                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Your LinkedIn profile <span className="text-gray-600">(Optional)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Shown on your profile as a verified link — helps others know you&apos;re real.</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><LinkedinIcon size={16} /></span>
                    <input
                      value={form.linkedinUrl}
                      onChange={(e) => set("linkedinUrl", e.target.value)}
                      placeholder="https://linkedin.com/in/yourname"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-9 pr-11 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <CopyTextButton text={form.linkedinUrl} label="Copy LinkedIn URL" />
                    </div>
                  </div>
                </div>

                {/* GitHub */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Your GitHub <span className="text-gray-600">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><GithubIcon size={16} /></span>
                    <input
                      value={form.githubUrl}
                      onChange={(e) => set("githubUrl", e.target.value)}
                      placeholder="https://github.com/yourname"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-9 pr-11 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <CopyTextButton text={form.githubUrl} label="Copy GitHub URL" />
                    </div>
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Personal website <span className="text-gray-600">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={form.websiteUrl}
                      onChange={(e) => set("websiteUrl", e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-9 pr-11 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <CopyTextButton text={form.websiteUrl} label="Copy website URL" />
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-sm font-medium text-gray-300">
                      Tell us a bit about yourself <span className="text-red-400">*</span>
                    </label>
                    <span className="flex items-center gap-2 shrink-0">
                      <CopyTextButton text={form.bio} label="Copy bio" />
                      <span className="text-xs text-gray-600 font-mono">{form.bio.length} / 300</span>
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={300}
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder="Keep it real — share your background, what drives you, and what you hope to build with AI..."
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none transition-all ${errors.bio ? "border-red-500" : "border-white/10"}`}
                  />
                  {errors.bio
                    ? <p className="text-xs text-red-400 mt-1">{errors.bio}</p>
                    : form.bio.length > 0 && form.bio.length < 30 && (
                      <p className="text-xs text-yellow-400/70 mt-1">Add a bit more — at least 30 characters helps others connect with you.</p>
                    )
                  }
                </div>

                {/* Skills & Expertise */}
                <div className="space-y-5 bg-white/[0.02] border border-white/8 rounded-xl p-5">
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">
                      Skills &amp; Expertise
                      <span className="text-gray-600 font-normal text-xs ml-2">(optional — tap to toggle)</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-4">Tell us what you already know. You can always update these later.</p>

                    <SkillsSelector
                      label="My programming skills"
                      selected={form.skills}
                      onChange={(v) => set("skills", v)}
                      presets={SKILL_TAGS}
                      color="purple"
                    />
                  </div>

                  <div className="border-t border-white/8 pt-5">
                    <SkillsSelector
                      label="My domain expertise"
                      selected={form.expertise}
                      onChange={(v) => set("expertise", v)}
                      presets={EXPERTISE_TAGS}
                      color="orange"
                    />
                  </div>
                </div>

                {/* Learning goals & offering */}
                <div className="space-y-5 bg-white/[0.02] border border-white/8 rounded-xl p-5">
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">
                      AI DevCamp Profile Tags
                      <span className="text-gray-600 font-normal text-xs ml-2">(optional)</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-4">Help others find you and connect on the right topics.</p>

                    <SkillsSelector
                      label="I want to learn"
                      selected={form.wantToLearn}
                      onChange={(v) => set("wantToLearn", v)}
                      presets={WANT_TAGS}
                      color="green"
                    />
                  </div>

                  <div className="border-t border-white/8 pt-5">
                    <SkillsSelector
                      label="I can offer / help with"
                      selected={form.canOffer}
                      onChange={(v) => set("canOffer", v)}
                      presets={OFFER_TAGS}
                      color="blue"
                    />
                  </div>
                </div>

                {/* Terms */}
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-white text-sm">Before you join</h3>
                  <p className="text-xs text-gray-400">
                    AI DevCamp is a curated learning community. By joining you agree to be respectful, collaborative, and keep it high-quality.
                  </p>
                  <label className={`flex items-start gap-3 cursor-pointer ${errors.terms ? "text-red-400" : ""}`}>
                    <input
                      type="checkbox"
                      checked={form.agreedToTerms}
                      onChange={(e) => set("agreedToTerms", e.target.checked)}
                      className="mt-0.5 accent-green-500 w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-300">
                      I&apos;ve read and agree to the{" "}
                      <span className="text-green-400 font-semibold">terms of service</span> and{" "}
                      <span className="text-green-400 font-semibold">privacy policy</span>.{" "}
                      <span className="text-red-400">(Required)</span>
                    </span>
                  </label>
                  {errors.terms && <p className="text-xs text-red-400">{errors.terms}</p>}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.keepUpdated}
                      onChange={(e) => set("keepUpdated", e.target.checked)}
                      className="mt-0.5 accent-green-500 w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-400">
                      Keep me updated — session reminders, drops, and AI DevCamp news.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={handleBack} className="flex items-center justify-center gap-1 border-2 border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-mono font-bold px-5 py-3.5 rounded-xl transition-all text-sm">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={handleNext} className="flex-1 bg-green-500 hover:bg-green-400 text-gray-950 font-bold py-3.5 rounded-xl font-mono text-sm transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2">
                  CONTINUE <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && (
            <div className="flex-1 flex flex-col">
              <p className="font-mono text-xs text-green-500/60 tracking-widest mb-2">STEP 4 OF 4</p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-1 leading-tight">
                What are you <span className="text-green-400">building?</span>
              </h1>
              <p className="text-gray-400 mb-8">
                Share your learning goal or project idea — helps mentors and fellow learners connect with you.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Project / Goal name
                  </label>
                  <input
                    value={form.projectName}
                    onChange={(e) => set("projectName", e.target.value)}
                    placeholder="e.g. Digit Classifier, AI Study Bot"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    One-line description
                  </label>
                  <input
                    value={form.projectDescription}
                    onChange={(e) => set("projectDescription", e.target.value)}
                    placeholder="e.g. An ML model that classifies handwritten digits with 98% accuracy"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Project URL <span className="text-gray-600">(Optional)</span>
                  </label>
                  <input
                    value={form.projectUrl}
                    onChange={(e) => set("projectUrl", e.target.value)}
                    placeholder="https://github.com/yourname/project"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={handleBack} className="flex items-center justify-center gap-1 border-2 border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-mono font-bold px-5 py-3.5 rounded-xl transition-all text-sm">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => handleFinish(false)}
                  disabled={submitting}
                  className="flex-1 bg-green-500 hover:bg-green-400 text-gray-950 font-bold py-3.5 rounded-xl font-mono text-sm transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  CREATE ACCOUNT →
                </button>
              </div>

              <button
                onClick={() => handleFinish(true)}
                disabled={submitting}
                className="mt-3 text-center text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
