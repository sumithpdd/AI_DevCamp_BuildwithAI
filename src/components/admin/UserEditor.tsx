"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, Loader2, Globe, User, Trash2, X, Award, ExternalLink } from "lucide-react";
import { certifierCredentialViewUrl } from "@/lib/certifierLinks";
import { syncCertifierCredentials } from "@/lib/adminService";
import toast from "react-hot-toast";
import { UserProfile, UserRole, UserStatus } from "@/types";
import StatusDropdown from "@/components/admin/StatusDropdown";
import LocationPicker from "@/components/ui/LocationPicker";
import SkillsSelector from "@/components/ui/SkillsSelector";
import Input from "@/components/ui/Input";
import CopyTextButton from "@/components/ui/CopyTextButton";
import {
  joiningInPersonLabel,
  KICKOFF_IN_PERSON_RSVP_POLICY,
  kickoffRsvpAdminAuditFields,
} from "@/lib/kickoffRsvp";
import {
  SKILL_TAGS,
  EXPERTISE_TAGS,
  WANT_TO_LEARN_TAGS,
  CAN_OFFER_TAGS,
} from "@/data/tags";
import { GithubIcon, LinkedinIcon } from "@/components/icons/SocialBrandIcons";

type ExpLevel = "beginner" | "intermediate" | "advanced";

interface UserEditorProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (uid: string, updates: Record<string, unknown>) => Promise<void>;
  /** Remove this row from Firestore; optionally Firebase Auth (admin API). */
  onDeleteUser?: (userDocId: string, options: { deleteAuthUser: boolean }) => Promise<void>;
  /** Who is saving (admin) — used to audit kick-off RSVP changes. */
  adminContext?: { uid: string; email: string; name?: string };
}

export default function UserEditor({ user, onClose, onSave, onDeleteUser, adminContext }: UserEditorProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAuthToo, setDeleteAuthToo] = useState(true);
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [handle, setHandle] = useState(user.handle || "");
  const [roleTitle, setRoleTitle] = useState(user.roleTitle || "");
  const [city, setCity] = useState(user.city || "");
  const [country, setCountry] = useState(user.country || "");
  const [bio, setBio] = useState(user.bio || "");
  const [experienceLevel, setExperienceLevel] = useState<ExpLevel>(
    (user.experienceLevel as ExpLevel) || "beginner"
  );
  const [skills, setSkills] = useState<string[]>(user.skills || []);
  const [expertise, setExpertise] = useState<string[]>(user.expertise || []);
  const [wantToLearn, setWantToLearn] = useState<string[]>(user.wantToLearn || []);
  const [canOffer, setCanOffer] = useState<string[]>(user.canOffer || []);
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedinUrl || "");
  const [githubUrl, setGithubUrl] = useState(user.githubUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl || "");
  const [joiningInPerson, setJoiningInPerson] = useState(user.joiningInPerson || "");
  const [kickoffInPersonRsvp, setKickoffInPersonRsvp] = useState<"" | "yes" | "no">(
    typeof user.kickoffInPersonRsvp === "boolean" ? (user.kickoffInPersonRsvp ? "yes" : "no") : ""
  );
  const [kickoffInPersonAdminConfirmed, setKickoffInPersonAdminConfirmed] = useState(
    user.kickoffInPersonAdminConfirmed === true
  );
  const [userStatus, setUserStatus] = useState<UserStatus>(user.userStatus || "pending");
  const [role, setRole] = useState<UserRole>(user.role || "attendee");
  const [accountDisabled, setAccountDisabled] = useState(user.accountDisabled === true);
  const [accountDisabledReason, setAccountDisabledReason] = useState(user.accountDisabledReason || "");
  const [programOptOut, setProgramOptOut] = useState(user.programOptOut === true);
  const [profilePublic, setProfilePublic] = useState(user.profilePublic === true);
  const [certifierSyncing, setCertifierSyncing] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName || "");
    setHandle(user.handle || "");
    setRoleTitle(user.roleTitle || "");
    setCity(user.city || "");
    setCountry(user.country || "");
    setBio(user.bio || "");
    setExperienceLevel(((user.experienceLevel as ExpLevel) || "beginner") as ExpLevel);
    setSkills(user.skills || []);
    setExpertise(user.expertise || []);
    setWantToLearn(user.wantToLearn || []);
    setCanOffer(user.canOffer || []);
    setLinkedinUrl(user.linkedinUrl || "");
    setGithubUrl(user.githubUrl || "");
    setWebsiteUrl(user.websiteUrl || "");
    setJoiningInPerson(user.joiningInPerson || "");
    setKickoffInPersonRsvp(
      typeof user.kickoffInPersonRsvp === "boolean" ? (user.kickoffInPersonRsvp ? "yes" : "no") : ""
    );
    setKickoffInPersonAdminConfirmed(user.kickoffInPersonAdminConfirmed === true);
    setUserStatus(user.userStatus || "pending");
    setRole(user.role || "attendee");
    setAccountDisabled(user.accountDisabled === true);
    setAccountDisabledReason(user.accountDisabledReason || "");
    setProgramOptOut(user.programOptOut === true);
    setProfilePublic(user.profilePublic === true);
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitDelete = async () => {
    if (!onDeleteUser) return;
    const docId = (user.firestoreId || user.uid) as string;
    const authMsg = deleteAuthToo
      ? " This will also remove their Firebase login."
      : " Their Firebase login will remain.";
    if (
      !window.confirm(
        `Delete this user from the database?${authMsg} This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await onDeleteUser(docId, { deleteAuthUser: deleteAuthToo });
      onClose();
    } catch {
      toast.error("Could not delete user");
    } finally {
      setDeleting(false);
    }
  };

  const submit = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const cityT = (city ?? "").trim();
      const countryT = (country ?? "").trim();
      const derivedLocation = [cityT, countryT].filter(Boolean).join(", ") || null;

      const updates: Record<string, unknown> = {
        displayName: displayName.trim(),
        handle: (() => {
          const h = handle.trim().toLowerCase();
          return h.length >= 1 ? h : user.handle || "";
        })(),
        roleTitle: roleTitle.trim() || null,
        city: cityT || null,
        country: countryT || null,
        location: derivedLocation,
        bio: bio.trim() || null,
        experienceLevel,
        skills,
        expertise,
        wantToLearn,
        canOffer,
        linkedinUrl: linkedinUrl.trim() || null,
        githubUrl: githubUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        userStatus,
        role,
        kickoffInPersonAdminConfirmed,
        accountDisabled,
        accountDisabledReason: accountDisabled ? accountDisabledReason.trim() || null : null,
        programOptOut,
        programOptOutAt: programOptOut
          ? user.programOptOutAt || new Date().toISOString()
          : null,
        profilePublic,
      };

      const rsvpAudit = adminContext
        ? kickoffRsvpAdminAuditFields({
            uid: adminContext.uid,
            email: adminContext.email,
            name: adminContext.name,
          })
        : null;

      if (kickoffInPersonRsvp === "yes") {
        updates.kickoffInPersonRsvp = true;
        updates.joiningInPerson = joiningInPerson.trim() || joiningInPersonLabel(true);
        updates.kickoffRsvpUpdatedAt = new Date().toISOString();
        updates.kickoffRsvpExplicitInApp = true;
        if (rsvpAudit) Object.assign(updates, rsvpAudit);
      } else if (kickoffInPersonRsvp === "no") {
        updates.kickoffInPersonRsvp = false;
        updates.joiningInPerson = joiningInPerson.trim() || joiningInPersonLabel(false);
        updates.kickoffRsvpUpdatedAt = new Date().toISOString();
        updates.kickoffRsvpExplicitInApp = true;
        if (rsvpAudit) Object.assign(updates, rsvpAudit);
      } else if (joiningInPerson.trim()) {
        updates.joiningInPerson = joiningInPerson.trim();
        if (rsvpAudit) {
          updates.kickoffRsvpUpdatedAt = new Date().toISOString();
          Object.assign(updates, rsvpAudit);
        }
      }

      await onSave((user.firestoreId || user.uid) as string, updates);
      onClose();
    } catch {
      toast.error("Could not save user");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 font-mono";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0d1117]/95">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-bold text-white font-mono">Edit user</h2>
            <div className="flex items-center gap-1 max-w-[280px] sm:max-w-md">
              <p className="text-xs text-gray-500 font-mono truncate">{user.email}</p>
              {user.email ? <CopyTextButton text={user.email} label="Copy email" /> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-gray-500 mb-1">Email (read-only)</label>
              <div className="relative">
                <input
                  readOnly
                  value={user.email}
                  className={`${inputCls} opacity-60 cursor-not-allowed pr-10`}
                />
                {user.email ? (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <CopyTextButton text={user.email} label="Copy email" />
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Display name *</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`${inputCls} pl-9 pr-10`}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <CopyTextButton text={displayName} label="Copy display name" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Handle</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Role / title</label>
              <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-green-400 uppercase tracking-widest mb-2">Access</div>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-1">Status</label>
                <StatusDropdown status={userStatus} onChange={setUserStatus} />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className={`${inputCls} w-auto min-w-[140px]`}
                >
                  <option value="attendee">Attendee</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>

          {(userStatus === "certified" || user.certifierCredentialId) && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs uppercase tracking-wider">
                <Award size={14} />
                Certifier certificate
              </div>
              {user.certifierCredentialId ? (
                <p className="text-xs text-gray-400 font-mono break-all">
                  ID: {user.certifierCredentialId}
                  {user.certifierCredentialStatus ? ` · ${user.certifierCredentialStatus}` : ""}
                </p>
              ) : (
                <p className="text-xs text-gray-500">No credential linked yet — sync from Certifier by email.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {user.certifierCredentialPublicId && (
                  <a
                    href={certifierCredentialViewUrl(user.certifierCredentialPublicId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10"
                  >
                    <ExternalLink size={12} />
                    Open certificate
                  </a>
                )}
                <button
                  type="button"
                  disabled={certifierSyncing || !user.uid}
                  onClick={async () => {
                    if (!user.uid) return;
                    setCertifierSyncing(true);
                    try {
                      const r = await syncCertifierCredentials([user.uid]);
                      toast.success(`Certifier sync: ${r.synced} linked, ${r.missing} not found`);
                      onClose();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Sync failed");
                    } finally {
                      setCertifierSyncing(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-gray-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-3 py-1.5 rounded-lg"
                >
                  {certifierSyncing ? <Loader2 size={12} className="animate-spin" /> : null}
                  Sync from Certifier
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-mono text-rose-400 uppercase tracking-widest mb-2">Account lock</div>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-3 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-rose-500">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-gray-900 text-rose-500 focus:ring-rose-500"
                checked={accountDisabled}
                onChange={(e) => setAccountDisabled(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-rose-200/95">Disable account</span>
                <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
                  User cannot sign in, call APIs, or receive bulk email from admin. Use for bounced or invalid
                  addresses.
                </span>
              </span>
            </label>
            {accountDisabled && (
              <div className="mt-3">
                <label className="block text-xs font-mono text-gray-500 mb-1">Reason (optional)</label>
                <input
                  value={accountDisabledReason}
                  onChange={(e) => setAccountDisabledReason(e.target.value)}
                  placeholder="e.g. mailbox not found"
                  className={inputCls}
                />
              </div>
            )}
            <label className="mt-4 flex items-start gap-3 cursor-pointer rounded-lg border border-slate-500/25 bg-slate-500/5 px-3 py-3 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-slate-500">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-gray-900 text-slate-400 focus:ring-slate-500"
                checked={programOptOut}
                onChange={(e) => setProgramOptOut(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-200/95">Left programme (de-registered)</span>
                <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
                  No site login or API access, and excluded from cohort bulk email, until you clear this. Users can
                  de-register from the app; only admins can restore access here.
                </span>
              </span>
            </label>
          </div>

          <div>
            <div className="text-[10px] font-mono text-green-400 uppercase tracking-widest mb-2">
              DevcampBuddies
            </div>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-3 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-green-500">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-gray-900 text-green-500 focus:ring-green-500"
                checked={profilePublic}
                onChange={(e) => setProfilePublic(e.target.checked)}
              />
              <span className="flex gap-2 min-w-0">
                <HeartHandshake className="h-4 w-4 shrink-0 text-green-400 mt-0.5" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-green-100/95">Public profile (directory)</span>
                  <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
                    When enabled, this attendee appears in the DevcampBuddies directory and can send/receive buddy
                    requests (same as if they toggled it on their profile page).
                  </span>
                </span>
              </span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-sm font-medium text-gray-300">Bio</label>
              <CopyTextButton text={bio} label="Copy bio" />
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Background, goals, and what excites you about AI…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y min-h-[100px]"
            />
          </div>

          <div>
            <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-2">Location</div>
            <LocationPicker
              city={city}
              country={country}
              onCityChange={setCity}
              onCountryChange={setCountry}
            />
            <p className="text-xs text-gray-500 mt-2">
              &quot;Location&quot; in the database is set from city and country (same as profile).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Experience level</label>
            <div className="grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setExperienceLevel(level)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border capitalize transition-all ${
                    experienceLevel === level
                      ? "bg-green-600 border-green-500 text-white"
                      : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 bg-white/[0.02] border border-white/8 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-1">Skills &amp; expertise</p>
            <p className="text-xs text-gray-500 mb-2">Same presets as the attendee profile page.</p>
            <SkillsSelector
              label="My programming skills"
              selected={skills}
              onChange={setSkills}
              presets={SKILL_TAGS}
              color="purple"
            />
            <div className="border-t border-white/8 pt-5">
              <SkillsSelector
                label="My domain expertise"
                selected={expertise}
                onChange={setExpertise}
                presets={EXPERTISE_TAGS}
                color="orange"
              />
            </div>
          </div>

          <div className="space-y-5 bg-white/[0.02] border border-white/8 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-1">AI DevCamp tags</p>
            <p className="text-xs text-gray-500 mb-2">I want to learn / I can offer (same as profile).</p>
            <SkillsSelector
              label="I want to learn"
              selected={wantToLearn}
              onChange={setWantToLearn}
              presets={WANT_TO_LEARN_TAGS}
              color="green"
            />
            <div className="border-t border-white/8 pt-5">
              <SkillsSelector
                label="I can offer / help with"
                selected={canOffer}
                onChange={setCanOffer}
                presets={CAN_OFFER_TAGS}
                color="blue"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-orange-400 uppercase tracking-widest mb-2">Links</div>
            <div className="space-y-3">
              <Input
                id="ue-linkedin"
                label="LinkedIn"
                placeholder="https://linkedin.com/in/…"
                icon={<LinkedinIcon />}
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                trailingSlot={<CopyTextButton text={linkedinUrl} label="Copy LinkedIn URL" />}
              />
              <Input
                id="ue-github"
                label="GitHub"
                placeholder="https://github.com/…"
                icon={<GithubIcon />}
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                trailingSlot={<CopyTextButton text={githubUrl} label="Copy GitHub URL" />}
              />
              <Input
                id="ue-website"
                label="Personal website"
                placeholder="https://…"
                icon={<Globe size={16} />}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                trailingSlot={<CopyTextButton text={websiteUrl} label="Copy website URL" />}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">Kick-off (23 Apr)</div>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-3 border border-amber-500/20 bg-amber-500/5 rounded-lg px-3 py-2">
              {KICKOFF_IN_PERSON_RSVP_POLICY}
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-1">RSVP</label>
                <select
                  value={kickoffInPersonRsvp}
                  onChange={(e) => setKickoffInPersonRsvp(e.target.value as "" | "yes" | "no")}
                  className={inputCls}
                >
                  <option value="">Not set</option>
                  <option value="yes">In person</option>
                  <option value="no">Online only</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-gray-500 mb-1">Joining note (optional)</label>
                <input
                  value={joiningInPerson}
                  onChange={(e) => setJoiningInPerson(e.target.value)}
                  className={inputCls}
                  placeholder="Overrides auto label if you type something"
                />
              </div>
            </div>
            <label className="mt-3 flex items-start gap-3 cursor-pointer rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-emerald-500">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                checked={kickoffInPersonAdminConfirmed}
                onChange={(e) => setKickoffInPersonAdminConfirmed(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-emerald-200/95">
                  In person — admin confirmed
                </span>
                <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
                  Use this when they confirmed in person with you outside the app (e.g. email). Independent of
                  the RSVP above.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/8 bg-[#0d1117]/95">
          <div className="flex flex-col gap-2 min-w-[200px]">
            {onDeleteUser ? (
              <>
                <label className="flex items-center gap-2 text-[11px] text-gray-500 font-mono cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-white/20 bg-gray-900"
                    checked={deleteAuthToo}
                    onChange={(e) => setDeleteAuthToo(e.target.checked)}
                  />
                  Also delete Firebase login
                </label>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={submitDelete}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono text-rose-200 border border-rose-500/40 hover:bg-rose-500/10 disabled:opacity-50 w-fit"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Delete user
                </button>
              </>
            ) : null}
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-mono text-gray-400 border border-white/10 hover:border-white/20"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !displayName.trim()}
              onClick={submit}
              className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-green-500 hover:bg-green-400 text-gray-950 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
