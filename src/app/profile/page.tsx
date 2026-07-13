"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureProfileOnServer } from "@/lib/meApi";
import { stripUndefinedForFirestoreClient } from "@/lib/stripUndefinedFirestore";
import {
  ArrowRight,
  Code2,
  Eye,
  Globe,
  HeartHandshake,
  Lock,
  MessageCircle,
  Save,
  Sparkles,
  User,
  UsersRound,
} from "lucide-react";
import LocationPicker from "@/components/ui/LocationPicker";
import SkillsSelector from "@/components/ui/SkillsSelector";
import { SKILL_TAGS, EXPERTISE_TAGS, WANT_TO_LEARN_TAGS as WANT_TAGS, CAN_OFFER_TAGS as OFFER_TAGS } from "@/data/tags";
import { GithubIcon, LinkedinIcon } from "@/components/icons/SocialBrandIcons";
import Input from "@/components/ui/Input";
import CopyTextButton from "@/components/ui/CopyTextButton";
import Button from "@/components/ui/Button";
import ProfileCompletion from "@/components/ui/ProfileCompletion";
import ProfileCertificate from "@/components/ProfileCertificate";
import toast from "react-hot-toast";
import { unknownErrorMessage } from "@/lib/unknownErrorMessage";
import { logAnalyticsEvent } from "@/lib/analytics";

export default function ProfilePage() {
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    city: "",
    country: "",
    skills: [] as string[],
    expertise: [] as string[],
    wantToLearn: [] as string[],
    canOffer: [] as string[],
    linkedinUrl: "",
    githubUrl: "",
    websiteUrl: "",
    experienceLevel: "beginner" as "beginner" | "intermediate" | "advanced",
    profilePublic: false,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
    if (userProfile) {
      setForm({
        displayName: userProfile.displayName || "",
        bio: userProfile.bio || "",
        city: userProfile.city || "",
        country: userProfile.country || "",
        skills: userProfile.skills || [],
        expertise: userProfile.expertise || [],
        wantToLearn: userProfile.wantToLearn || [],
        canOffer: userProfile.canOffer || [],
        linkedinUrl: userProfile.linkedinUrl || "",
        githubUrl: userProfile.githubUrl || "",
        websiteUrl: userProfile.websiteUrl || "",
        experienceLevel: userProfile.experienceLevel || "beginner",
        profilePublic: userProfile.profilePublic === true,
      });
    }
  }, [user, userProfile, loading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const existing = await getDoc(userRef);
      if (!existing.exists()) {
        await ensureProfileOnServer();
        if (!(await getDoc(userRef)).exists()) {
          throw new Error(
            "No profile document. Try signing out and back in, or check your network."
          );
        }
      }
      const c = (s: string | undefined) => (s == null ? "" : s);
      const strList = (arr: string[] | undefined) =>
        (arr ?? []).filter((x): x is string => typeof x === "string" && x !== undefined);
      const updatePayload: Record<string, unknown> = {
        displayName: c(form.displayName),
        bio: c(form.bio),
        city: c(form.city),
        country: c(form.country),
        location: [c(form.city), c(form.country)].filter(Boolean).join(", "),
        skills: strList(form.skills),
        expertise: strList(form.expertise),
        wantToLearn: strList(form.wantToLearn),
        canOffer: strList(form.canOffer),
        linkedinUrl: c(form.linkedinUrl),
        githubUrl: c(form.githubUrl),
        websiteUrl: c(form.websiteUrl),
        experienceLevel: form.experienceLevel,
        profilePublic: form.profilePublic,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(
        userRef,
        stripUndefinedForFirestoreClient(updatePayload)
      );
      await refreshProfile();
      logAnalyticsEvent("profile_updated", {
        experience_level: form.experienceLevel,
      });
      toast.success("Profile updated!");
    } catch (err) {
      console.error("Profile save failed:", err);
      const msg = unknownErrorMessage(
        err,
        "Failed to update profile. Try again or sign out and back in."
      );
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-gray-400">
            Help mentors and other attendees get to know you.
          </p>
        </div>

        {/* Profile completion indicator */}
        <ProfileCompletion profile={userProfile} variant="full" />

        {userProfile && <ProfileCertificate userProfile={userProfile} />}

        <form
          onSubmit={handleSave}
          className="bg-gray-900 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          {/* DevcampBuddies — high-visibility opt-in */}
          <section
            className={`rounded-2xl overflow-hidden border-2 transition-shadow ${
              form.profilePublic
                ? "border-green-500/50 shadow-[0_0_40px_-8px_rgba(34,197,94,0.35)]"
                : "border-white/10 shadow-lg"
            }`}
          >
            <div className="relative bg-gradient-to-br from-green-950/90 via-gray-900 to-gray-950 px-4 py-5 sm:px-6 sm:py-6">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.12),transparent_55%)] pointer-events-none" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4 min-w-0">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-inner ${
                      form.profilePublic
                        ? "border-green-400/40 bg-green-500/20 text-green-300"
                        : "border-white/10 bg-white/5 text-gray-400"
                    }`}
                  >
                    <HeartHandshake className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        DevcampBuddies
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/35 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-green-300">
                        <UsersRound className="h-3.5 w-3.5" aria-hidden />
                        Networking
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-300 leading-snug">
                      Show up in the buddies directory so others can find you and send buddy requests.
                    </p>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 sm:justify-end lg:flex-col lg:items-end lg:py-4 lg:min-w-[200px]">
                  <div className="text-left lg:text-right">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide font-mono">
                      Public profile
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${
                        form.profilePublic ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {form.profilePublic ? "Visible in directory" : "Hidden from directory"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.profilePublic}
                    aria-label="Toggle public profile for DevcampBuddies"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, profilePublic: !prev.profilePublic }))
                    }
                    className={`relative inline-flex h-9 w-[3.25rem] shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
                      form.profilePublic
                        ? "border-green-400 bg-green-500"
                        : "border-gray-600 bg-gray-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
                        form.profilePublic ? "translate-x-[1.35rem]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div
                className="relative mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                role="note"
              >
                <Save
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <p className="text-sm font-medium leading-snug text-amber-50">
                  Changes apply when you tap{" "}
                  <span className="rounded-md bg-amber-950/50 px-1.5 py-0.5 font-bold text-amber-100 ring-1 ring-amber-400/40">
                    Save Profile
                  </span>{" "}
                  below.
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 bg-gray-950/80 px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500">
                What others see
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                <li className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                  <Eye
                    className="h-5 w-5 shrink-0 text-green-400 mt-0.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-sm text-gray-300 leading-snug">
                    <span className="font-semibold text-white">Everyone (signed in)</span>
                    {" — "}your name, bio, LinkedIn, skills, domain expertise, learning tags, and what you can offer.
                  </span>
                </li>
                <li className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3">
                  <Lock
                    className="h-5 w-5 shrink-0 text-amber-300/90 mt-0.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-sm text-gray-300 leading-snug">
                    <span className="font-semibold text-amber-100/95">Buddies only</span>
                    {" — "}
                    <span className="inline-flex items-center gap-1">
                      <Code2 className="inline h-3.5 w-3.5 text-amber-200/80" aria-hidden />
                      GitHub
                    </span>
                    , website, and submitted projects — after you accept a buddy request.
                  </span>
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-green-500/80" aria-hidden />
                  Discover people under Buddies in the nav
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-green-500/80" aria-hidden />
                  Approve requests from your inbox there
                </span>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/5">
                <Link
                  href="/buddies"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2.5 text-sm font-semibold text-green-300 transition-colors hover:bg-green-500/20 hover:border-green-400/60"
                >
                  Open DevcampBuddies
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-4 pb-5 border-b border-white/10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {(form.displayName || user.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-white font-semibold truncate">
                  {form.displayName || "Your Name"}
                </p>
                {(form.displayName || "").trim() ? (
                  <CopyTextButton text={form.displayName} label="Copy display name" />
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-gray-400 text-sm truncate">{user.email}</p>
                {user.email ? <CopyTextButton text={user.email} label="Copy email" /> : null}
              </div>
              {userProfile?.role && (
                <span className="inline-block mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full capitalize">
                  {userProfile.role}
                </span>
              )}
            </div>
          </div>

          <Input
            id="displayName"
            label="Display Name"
            placeholder="Your full name or alias"
            icon={<User size={16} />}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            trailingSlot={<CopyTextButton text={form.displayName} label="Copy display name" />}
          />

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-sm font-medium text-gray-300">Bio</label>
              <CopyTextButton text={form.bio} label="Copy bio" />
            </div>
            <textarea
              rows={4}
              placeholder="Tell us about yourself — your background, goals, and what excites you about AI..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>

          <LocationPicker
            city={form.city}
            country={form.country}
            onCityChange={(v) => setForm({ ...form, city: v })}
            onCountryChange={(v) => setForm({ ...form, country: v })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Experience Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map(
                (level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setForm({ ...form, experienceLevel: level })}
                    className={`py-2.5 rounded-lg text-sm font-semibold border capitalize transition-all ${
                      form.experienceLevel === level
                        ? "bg-green-600 border-green-500 text-white"
                        : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {level}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Skills & Expertise */}
          <div className="space-y-5 bg-white/[0.02] border border-white/8 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-3">Skills &amp; Expertise</p>

            <SkillsSelector
              label="My programming skills"
              selected={form.skills}
              onChange={(v) => setForm({ ...form, skills: v })}
              presets={SKILL_TAGS}
              color="purple"
            />

            <div className="border-t border-white/8 pt-5">
              <SkillsSelector
                label="My domain expertise"
                selected={form.expertise}
                onChange={(v) => setForm({ ...form, expertise: v })}
                presets={EXPERTISE_TAGS}
                color="orange"
              />
            </div>
          </div>

          {/* Learning & Offering */}
          <div className="space-y-5 bg-white/[0.02] border border-white/8 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-3">AI DevCamp Tags</p>

            <SkillsSelector
              label="I want to learn"
              selected={form.wantToLearn}
              onChange={(v) => setForm({ ...form, wantToLearn: v })}
              presets={WANT_TAGS}
              color="green"
            />

            <div className="border-t border-white/8 pt-5">
              <SkillsSelector
                label="I can offer / help with"
                selected={form.canOffer}
                onChange={(v) => setForm({ ...form, canOffer: v })}
                presets={OFFER_TAGS}
                color="blue"
              />
            </div>
          </div>

          <Input
            id="linkedin"
            label="LinkedIn"
            placeholder="https://linkedin.com/in/yourname"
            icon={<LinkedinIcon />}
            value={form.linkedinUrl}
            onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
            trailingSlot={<CopyTextButton text={form.linkedinUrl} label="Copy LinkedIn URL" />}
          />

          <Input
            id="github"
            label="GitHub"
            placeholder="https://github.com/yourname"
            icon={<GithubIcon />}
            value={form.githubUrl}
            onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
            trailingSlot={<CopyTextButton text={form.githubUrl} label="Copy GitHub URL" />}
          />

          <Input
            id="website"
            label="Personal Website"
            placeholder="https://yourwebsite.com"
            icon={<Globe size={16} />}
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
            trailingSlot={<CopyTextButton text={form.websiteUrl} label="Copy website URL" />}
          />

          <Button type="submit" loading={saving} className="w-full" size="lg">
            <Save size={16} />
            Save Profile
          </Button>
        </form>
      </div>
    </div>
  );
}
